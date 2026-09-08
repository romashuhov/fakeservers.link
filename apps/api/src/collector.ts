// One collector run: pull every tracked game from GetServerList, cluster identical listings,
// upsert the current state into listings, and write one snapshot row per game.
import { type Config, GAMES, isClusterable, isOfficial } from "./config";
import { db } from "./db";
import {
	fetchServerList,
	isAnonymousSteamId,
	normalizeName,
	type SteamServer,
	splitAddr,
	subnetOf,
} from "./steam";

export type SnapshotSummary = {
	appId: number;
	total: number;
	official: number;
	dup3: number;
	dup5: number;
	dup10: number;
	dup100: number;
	anonymous: number;
	appeared: number;
	disappeared: number;
	largestCluster: number;
	largestClusterName: string | null;
	pages: number;
	truncated: boolean;
	durationMs: number;
};

type Row = {
	app_id: number;
	addr: string;
	ip: string;
	port: number;
	name: string | null;
	map: string | null;
	players: number | null;
	max_players: number | null;
	bots: number | null;
	steamid: string | null;
	anonymous: boolean;
	official: boolean;
	secure: boolean | null;
	gametype: string | null;
	version: string | null;
	region: number | null;
	cluster_size: number;
};

type Cluster = {
	name: string;
	map: string | null;
	maxPlayers: number | null;
	addrs: string[];
	ips: Set<string>;
	subnets: Set<string>;
};

const CHUNK = 10_000;
const TOP_CLUSTERS = 100;
/** Advisory lock so two collectors (the API's scheduler and a manual `collect`) never run at once. */
const COLLECT_LOCK = 7241003;

/** Identical listing = same name, map and max_players. Player count is left out: it changes between calls. */
function clusterKey(name: string, map: string | undefined, maxPlayers: number | undefined): string {
	return `${name} ${map ?? ""} ${maxPlayers ?? ""}`;
}

function clusterServers(servers: SteamServer[]): Map<string, Cluster> {
	const map = new Map<string, Cluster>();
	for (const s of servers) {
		const name = normalizeName(s.name);
		if (!name || !isClusterable(name)) continue;
		const parts = splitAddr(s.addr);
		if (!parts) continue;
		const key = clusterKey(name, s.map, s.max_players);
		let c = map.get(key);
		if (!c) {
			c = {
				name,
				map: s.map ?? null,
				maxPlayers: s.max_players ?? null,
				addrs: [],
				ips: new Set(),
				subnets: new Set(),
			};
			map.set(key, c);
		}
		c.addrs.push(s.addr);
		c.ips.add(parts.ip);
		c.subnets.add(subnetOf(parts.ip));
	}
	return map;
}

async function collectGame(config: Config, appId: number, takenAt: Date): Promise<SnapshotSummary> {
	const started = Date.now();
	const sql = db();
	const { servers, pages, truncated } = await fetchServerList(config.STEAM_WEB_API_KEY, `\\appid\\${appId}`);

	// Valve's own servers are stored (so a lookup can say what they are) but count nowhere.
	const community: SteamServer[] = [];
	const officialAddrs = new Set<string>();
	for (const s of servers) {
		const parts = splitAddr(s.addr);
		if (!parts) continue;
		if (isOfficial(normalizeName(s.name), parts.ip)) officialAddrs.add(s.addr);
		else community.push(s);
	}

	const clusters = clusterServers(community);
	const sizeByAddr = new Map<string, number>();
	let largest: Cluster | null = null;
	for (const c of clusters.values()) {
		for (const a of c.addrs) sizeByAddr.set(a, c.addrs.length);
		if (!largest || c.addrs.length > largest.addrs.length) largest = c;
	}

	const perIp = new Map<string, number>();
	const perSubnet = new Map<string, number>();
	const rows: Row[] = [];
	let anonymous = 0;
	for (const s of servers) {
		const parts = splitAddr(s.addr);
		if (!parts) continue;
		const official = officialAddrs.has(s.addr);
		const anon = isAnonymousSteamId(s.steamid);
		if (!official) {
			const subnet = subnetOf(parts.ip);
			perIp.set(parts.ip, (perIp.get(parts.ip) ?? 0) + 1);
			perSubnet.set(subnet, (perSubnet.get(subnet) ?? 0) + 1);
			if (anon) anonymous++;
		}
		rows.push({
			app_id: appId,
			addr: s.addr,
			ip: parts.ip,
			port: parts.port,
			name: normalizeName(s.name) || null,
			map: s.map ?? null,
			players: s.players ?? null,
			max_players: s.max_players ?? null,
			bots: s.bots ?? null,
			steamid: s.steamid ?? null,
			anonymous: anon,
			official,
			secure: s.secure ?? null,
			gametype: s.gametype ?? null,
			version: s.version ?? null,
			region: s.region ?? null,
			cluster_size: official ? 1 : (sizeByAddr.get(s.addr) ?? 1),
		});
	}

	const total = rows.length - officialAddrs.size;
	const dupAtLeast = (n: number) => rows.filter((r) => !r.official && r.cluster_size >= n).length;

	const prev = (await sql`SELECT max(taken_at) AS at FROM snapshots WHERE app_id = ${appId}`) as {
		at: Date | null;
	}[];
	const prevAt = prev[0]?.at ?? null;

	// Bun.sql serialises a JS array straight to json, so the chunk is passed as is, not stringified.
	let appeared = 0;
	for (let i = 0; i < rows.length; i += CHUNK) {
		const chunk = rows.slice(i, i + CHUNK);
		const res = (await sql`
			WITH ins AS (
				INSERT INTO listings (app_id, addr, ip, port, name, map, players, max_players, bots, steamid, anonymous,
					official, secure, gametype, version, region, cluster_size, first_seen, last_seen)
				SELECT r.app_id, r.addr, r.ip::inet, r.port, r.name, r.map, r.players, r.max_players, r.bots, r.steamid,
					r.anonymous, r.official, r.secure, r.gametype, r.version, r.region, r.cluster_size, ${takenAt}, ${takenAt}
				FROM jsonb_to_recordset(${chunk}::jsonb) AS r(app_id int, addr text, ip text, port int, name text,
					map text, players int, max_players int, bots int, steamid text, anonymous boolean, official boolean,
					secure boolean, gametype text, version text, region int, cluster_size int)
				ON CONFLICT (app_id, addr) DO UPDATE SET
					name = EXCLUDED.name, map = EXCLUDED.map, players = EXCLUDED.players,
					max_players = EXCLUDED.max_players, bots = EXCLUDED.bots, steamid = EXCLUDED.steamid,
					anonymous = EXCLUDED.anonymous, official = EXCLUDED.official, secure = EXCLUDED.secure,
					gametype = EXCLUDED.gametype, version = EXCLUDED.version, region = EXCLUDED.region,
					cluster_size = EXCLUDED.cluster_size, last_seen = EXCLUDED.last_seen
				RETURNING (xmax = 0) AS inserted, official
			)
			SELECT count(*) FILTER (WHERE inserted AND NOT official)::int AS inserted FROM ins
		`) as { inserted: number }[];
		appeared += res[0]?.inserted ?? 0;
	}

	let disappeared = 0;
	if (prevAt) {
		const gone = (await sql`
			SELECT count(*)::int AS n FROM listings
			WHERE app_id = ${appId} AND last_seen = ${prevAt} AND NOT official
		`) as { n: number }[];
		disappeared = gone[0]?.n ?? 0;
	}

	const durationMs = Date.now() - started;
	const maxPerIp = perIp.size > 0 ? Math.max(...perIp.values()) : 0;
	const maxPerSubnet = perSubnet.size > 0 ? Math.max(...perSubnet.values()) : 0;
	const snap = (await sql`
		INSERT INTO snapshots (app_id, taken_at, total, official, unique_ips, unique_subnets, dup3, dup5, dup10, dup100,
			anonymous, appeared, disappeared, largest_cluster, largest_cluster_name, max_per_ip, max_per_subnet,
			pages, truncated, duration_ms)
		VALUES (${appId}, ${takenAt}, ${total}, ${officialAddrs.size}, ${perIp.size}, ${perSubnet.size},
			${dupAtLeast(3)}, ${dupAtLeast(5)}, ${dupAtLeast(10)}, ${dupAtLeast(100)}, ${anonymous}, ${appeared},
			${disappeared}, ${largest?.addrs.length ?? 0}, ${largest?.name ?? null}, ${maxPerIp}, ${maxPerSubnet},
			${pages}, ${truncated}, ${durationMs})
		RETURNING id
	`) as { id: number }[];
	const snapshotId = snap[0]?.id;

	const playersByAddr = new Map<string, number>();
	for (const s of community) playersByAddr.set(s.addr, s.players ?? 0);
	const allFarms = [...clusters.values()]
		.filter((c) => c.addrs.length >= 3)
		.sort((a, b) => b.addrs.length - a.addrs.length);

	// farms: one row per cluster, upserted so first_seen survives and last_seen marks the current ones.
	for (let i = 0; i < allFarms.length; i += CHUNK) {
		const chunk = allFarms.slice(i, i + CHUNK).map((c) => ({
			app_id: appId,
			name: c.name,
			map: c.map ?? "",
			max_players: c.maxPlayers ?? 0,
			size: c.addrs.length,
			ips: c.ips.size,
			subnets: c.subnets.size,
			players: c.addrs.reduce((a, addr) => a + (playersByAddr.get(addr) ?? 0), 0),
		}));
		await sql`
			INSERT INTO farms (app_id, name, map, max_players, size, ips, subnets, players, first_seen, last_seen)
			SELECT r.app_id, r.name, r.map, r.max_players, r.size, r.ips, r.subnets, r.players, ${takenAt}, ${takenAt}
			FROM jsonb_to_recordset(${chunk}::jsonb)
				AS r(app_id int, name text, map text, max_players int, size int, ips int, subnets int, players int)
			ON CONFLICT (app_id, name, map, max_players) DO UPDATE SET
				size = EXCLUDED.size, ips = EXCLUDED.ips, subnets = EXCLUDED.subnets, players = EXCLUDED.players,
				last_seen = EXCLUDED.last_seen
		`;
	}

	const top = allFarms.slice(0, TOP_CLUSTERS).map((c) => ({
		snapshot_id: snapshotId,
		name: c.name,
		map: c.map,
		max_players: c.maxPlayers,
		size: c.addrs.length,
		ips: c.ips.size,
		subnets: c.subnets.size,
	}));
	if (top.length > 0) {
		await sql`
			INSERT INTO clusters (snapshot_id, name, map, max_players, size, ips, subnets)
			SELECT r.snapshot_id, r.name, r.map, r.max_players, r.size, r.ips, r.subnets
			FROM jsonb_to_recordset(${top}::jsonb)
				AS r(snapshot_id bigint, name text, map text, max_players int, size int, ips int, subnets int)
		`;
	}

	return {
		appId,
		total,
		official: officialAddrs.size,
		dup3: dupAtLeast(3),
		dup5: dupAtLeast(5),
		dup10: dupAtLeast(10),
		dup100: dupAtLeast(100),
		anonymous,
		appeared,
		disappeared,
		largestCluster: largest?.addrs.length ?? 0,
		largestClusterName: largest?.name ?? null,
		pages,
		truncated,
		durationMs,
	};
}

export async function collectAll(config: Config): Promise<SnapshotSummary[]> {
	if (!config.STEAM_WEB_API_KEY) throw new Error("STEAM_WEB_API_KEY is not set; the collector cannot run");
	const reserved = await db().reserve();
	try {
		const lock = (await reserved`SELECT pg_try_advisory_lock(${COLLECT_LOCK}) AS ok`) as { ok: boolean }[];
		if (!lock[0]?.ok) {
			console.log("[collect] another collector is running, skipping this run");
			return [];
		}
		try {
			return await collectUnlocked(config);
		} finally {
			await reserved`SELECT pg_advisory_unlock(${COLLECT_LOCK})`;
		}
	} finally {
		reserved.release();
	}
}

async function collectUnlocked(config: Config): Promise<SnapshotSummary[]> {
	const takenAt = new Date();
	takenAt.setMilliseconds(0);
	const out: SnapshotSummary[] = [];
	for (const g of GAMES) {
		try {
			const s = await collectGame(config, g.appId, takenAt);
			out.push(s);
			console.log(
				`[collect] ${g.alias}: total=${s.total} official=${s.official} dup3=${s.dup3} dup10=${s.dup10} ` +
					`anon=${s.anonymous} +${s.appeared} -${s.disappeared} largest=${s.largestCluster} pages=${s.pages}` +
					`${s.truncated ? " TRUNCATED" : ""} ${s.durationMs}ms`,
			);
		} catch (e) {
			console.error(`[collect] ${g.alias} failed:`, e instanceof Error ? e.message : e);
		}
	}
	return out;
}

/** Runs collectAll now (optional) and then on every interval boundary; `onDone` fires after each run. */
export function scheduleCollector(config: Config, onDone?: () => void): { nextRunAt: () => Date } {
	const intervalMs = config.COLLECT_INTERVAL_MIN * 60_000;
	let next = new Date(Math.ceil(Date.now() / intervalMs) * intervalMs);
	let running = false;
	const run = async () => {
		if (running) return;
		running = true;
		try {
			await collectAll(config);
			onDone?.();
		} catch (e) {
			console.error("[collect] run failed:", e instanceof Error ? e.message : e);
		} finally {
			running = false;
		}
	};
	const tick = () => {
		const delay = Math.max(1000, next.getTime() - Date.now());
		setTimeout(async () => {
			await run();
			next = new Date(Math.ceil((Date.now() + 1000) / intervalMs) * intervalMs);
			tick();
		}, delay);
	};
	if (config.COLLECT_ON_START) void run();
	tick();
	return { nextRunAt: () => next };
}
