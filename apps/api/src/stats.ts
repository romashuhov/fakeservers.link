// Read side: everything the site shows, computed from snapshots/listings and cached for a minute.
import { type Config, GAME_IDS, GAMES, gameByAppId } from "./config";
import { db } from "./db";
import { fetchByAddress, isPublicIp, splitAddr, subnetOf } from "./steam";

export const RULES = [
	{
		id: "identical",
		label: "Clone army",
		description: "Same name, same map, same max players on three or more addresses. One config, many ports.",
		threshold: 3,
	},
	{
		id: "farm",
		label: "Farm-sized",
		description: "Part of a cluster of 100 or more identical listings. Very efficient hardware.",
		threshold: 100,
	},
	{
		id: "anonymous",
		label: "No token",
		description:
			"Logged in to Steam without a game server login token. Normal for GoldSrc-era games, a shortcut for farms elsewhere.",
	},
	{
		id: "dense-ip",
		label: "IP stack",
		description: "Ten or more listings announcing from one IP address.",
		threshold: 10,
	},
	{
		id: "dense-subnet",
		label: "Subnet stack",
		description: "Fifty or more listings announcing from the same /24. One operator, many addresses.",
		threshold: 50,
	},
] as const;

export type RuleId = (typeof RULES)[number]["id"];

type SnapshotRow = {
	id: number;
	app_id: number;
	taken_at: Date;
	total: number;
	official: number;
	unique_ips: number;
	unique_subnets: number;
	dup3: number;
	dup5: number;
	dup10: number;
	dup100: number;
	anonymous: number;
	appeared: number;
	disappeared: number;
	largest_cluster: number;
	largest_cluster_name: string | null;
	max_per_ip: number;
	max_per_subnet: number;
	truncated: boolean;
};

export type DailyPoint = { date: string; total: number; dup3: number; dup10: number; anonymous: number };

export type StatsResponse = {
	updatedAt: string | null;
	nextUpdateAt: string;
	intervalMin: number;
	trackedDays: number;
	totals: {
		total: number;
		official: number;
		dup3: number;
		dup5: number;
		dup10: number;
		dup100: number;
		anonymous: number;
		largestCluster: number;
		largestClusterName: string | null;
		maxPerIp: number;
		maxPerSubnet: number;
	};
	games: {
		appId: number;
		alias: string;
		name: string;
		updatedAt: string;
		total: number;
		official: number;
		dup3: number;
		dup10: number;
		anonymous: number;
		largestCluster: number;
		truncated: boolean;
		sparkline: { date: string; share: number }[];
	}[];
	daily: DailyPoint[];
	topClusters: {
		appId: number;
		alias: string;
		name: string;
		map: string | null;
		maxPlayers: number | null;
		size: number;
		ips: number;
		subnets: number;
		firstSeen: string;
	}[];
	rules: { id: RuleId; label: string; description: string; count: number }[];
	/** Addresses worth trying in the checker: one from a farm, one that looks real, one that does not exist. */
	samples: { label: string; addr: string }[];
};

const CACHE_MS = 60_000;
let cache: { at: number; value: StatsResponse } | null = null;
let refreshing: Promise<StatsResponse> | null = null;

function dayKey(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/**
 * Serves from memory and refreshes in the background, so a request never waits for the heavy
 * queries except the very first one after boot (and index.ts warms that up before listening).
 */
export async function getStats(config: Config, nextRunAt: () => Date): Promise<StatsResponse> {
	if (!cache) await refreshStats(config, nextRunAt);
	else if (Date.now() - cache.at >= CACHE_MS) void refreshStats(config, nextRunAt);
	const value = cache as { at: number; value: StatsResponse };
	return { ...value.value, nextUpdateAt: nextRunAt().toISOString() };
}

export function refreshStats(config: Config, nextRunAt: () => Date): Promise<StatsResponse> {
	if (!refreshing) {
		refreshing = computeStats(config, nextRunAt)
			.then((value) => {
				cache = { at: Date.now(), value };
				return value;
			})
			.finally(() => {
				refreshing = null;
			});
	}
	return refreshing;
}

async function computeStats(config: Config, nextRunAt: () => Date): Promise<StatsResponse> {
	const sql = db();

	const latest = (await sql`
		SELECT DISTINCT ON (app_id) * FROM snapshots
		WHERE app_id IN (SELECT jsonb_array_elements_text(${GAME_IDS}::jsonb)::int)
		ORDER BY app_id, taken_at DESC
	`) as SnapshotRow[];

	const daily = (await sql`
		SELECT DISTINCT ON (app_id, day) app_id, day, total, dup3, dup10, anonymous
		FROM (
			SELECT app_id, (taken_at AT TIME ZONE 'UTC')::date AS day, taken_at, total, dup3, dup10, anonymous
			FROM snapshots
			WHERE taken_at >= now() - interval '366 days'
				AND app_id IN (SELECT jsonb_array_elements_text(${GAME_IDS}::jsonb)::int)
		) s
		ORDER BY app_id, day, taken_at DESC
	`) as { app_id: number; day: Date; total: number; dup3: number; dup10: number; anonymous: number }[];

	const first = (await sql`SELECT min(taken_at) AS at FROM snapshots
		WHERE app_id IN (SELECT jsonb_array_elements_text(${GAME_IDS}::jsonb)::int)`) as { at: Date | null }[];
	const firstAt = first[0]?.at ?? null;

	const latestIds = latest.map((s) => s.id);
	const topClusters =
		latestIds.length === 0
			? []
			: ((await sql`
				SELECT c.name, c.map, c.max_players, c.size, c.ips, c.subnets, s.app_id,
					(SELECT min(s2.taken_at) FROM clusters c2 JOIN snapshots s2 ON s2.id = c2.snapshot_id
						WHERE c2.name = c.name AND s2.app_id = s.app_id) AS first_seen
				FROM clusters c JOIN snapshots s ON s.id = c.snapshot_id
				WHERE c.snapshot_id IN (SELECT jsonb_array_elements_text(${latestIds}::jsonb)::bigint)
				ORDER BY c.size DESC
				LIMIT 10
			`) as {
					name: string;
					map: string | null;
					max_players: number | null;
					size: number;
					ips: number;
					subnets: number;
					app_id: number;
					first_seen: Date;
				}[]);

	const density =
		latestIds.length === 0
			? { dense_ip: 0, dense_subnet: 0 }
			: ((
					(await sql`
				WITH cur AS (SELECT DISTINCT ON (app_id) app_id, taken_at FROM snapshots ORDER BY app_id, taken_at DESC),
				live AS (
					SELECT l.ip FROM listings l JOIN cur ON cur.app_id = l.app_id AND cur.taken_at = l.last_seen
					WHERE NOT l.official
				),
				by_ip AS (SELECT count(*) AS c FROM live GROUP BY ip),
				by_subnet AS (SELECT count(*) AS c FROM live GROUP BY network(set_masklen(ip, 24)))
				SELECT (SELECT coalesce(sum(c), 0) FROM by_ip WHERE c >= 10)::int AS dense_ip,
					(SELECT coalesce(sum(c), 0) FROM by_subnet WHERE c >= 50)::int AS dense_subnet
			`) as { dense_ip: number; dense_subnet: number }[]
				)[0] ?? { dense_ip: 0, dense_subnet: 0 });

	const samples: { label: string; addr: string }[] = [];
	if (latestIds.length > 0) {
		// Prefer CS2 (app 730): the primary-key prefix keeps this to one game's rows.
		const preferred = GAMES[0].appId;
		const picks = (await sql`
			WITH cur AS (SELECT DISTINCT ON (app_id) app_id, taken_at FROM snapshots ORDER BY app_id, taken_at DESC),
			live AS (
				SELECT l.addr, l.app_id, l.cluster_size, l.anonymous, l.players, l.max_players
				FROM listings l JOIN cur ON cur.app_id = l.app_id AND cur.taken_at = l.last_seen
				WHERE NOT l.official
			)
			(SELECT 'farm' AS kind, addr FROM live WHERE cluster_size >= 100
				ORDER BY (app_id = ${preferred}) DESC, cluster_size DESC, addr LIMIT 1)
			UNION ALL
			(SELECT 'real' AS kind, addr FROM live
				WHERE cluster_size = 1 AND NOT anonymous AND players > 0 AND players < max_players
				ORDER BY (app_id = ${preferred}) DESC, players DESC, addr LIMIT 1)
		`) as { kind: string; addr: string }[];
		for (const p of picks) samples.push({ label: p.addr, addr: p.addr });
	}
	samples.push({ label: "10.0.0.1:27015", addr: "10.0.0.1:27015" });

	const sum = (pick: (s: SnapshotRow) => number) => latest.reduce((a, s) => a + pick(s), 0);
	const largest = latest.reduce<SnapshotRow | null>(
		(best, s) => (!best || s.largest_cluster > best.largest_cluster ? s : best),
		null,
	);

	const byDay = new Map<string, DailyPoint>();
	const perGameDaily = new Map<number, { date: string; share: number }[]>();
	for (const r of daily) {
		const date = dayKey(new Date(r.day));
		const p = byDay.get(date) ?? { date, total: 0, dup3: 0, dup10: 0, anonymous: 0 };
		p.total += r.total;
		p.dup3 += r.dup3;
		p.dup10 += r.dup10;
		p.anonymous += r.anonymous;
		byDay.set(date, p);
		const list = perGameDaily.get(r.app_id) ?? [];
		list.push({ date, share: r.total > 0 ? r.dup3 / r.total : 0 });
		perGameDaily.set(r.app_id, list);
	}

	const updatedAt = latest.length > 0 ? new Date(Math.max(...latest.map((s) => s.taken_at.getTime()))) : null;

	const value: StatsResponse = {
		updatedAt: updatedAt?.toISOString() ?? null,
		nextUpdateAt: nextRunAt().toISOString(),
		intervalMin: config.COLLECT_INTERVAL_MIN,
		trackedDays: firstAt ? Math.max(1, Math.ceil((Date.now() - firstAt.getTime()) / 86_400_000)) : 0,
		totals: {
			total: sum((s) => s.total),
			official: sum((s) => s.official),
			dup3: sum((s) => s.dup3),
			dup5: sum((s) => s.dup5),
			dup10: sum((s) => s.dup10),
			dup100: sum((s) => s.dup100),
			anonymous: sum((s) => s.anonymous),
			largestCluster: largest?.largest_cluster ?? 0,
			largestClusterName: largest?.largest_cluster_name ?? null,
			maxPerIp: Math.max(0, ...latest.map((s) => s.max_per_ip)),
			maxPerSubnet: Math.max(0, ...latest.map((s) => s.max_per_subnet)),
		},
		games: GAMES.flatMap((g) => {
			const s = latest.find((x) => x.app_id === g.appId);
			if (!s) return [];
			return [
				{
					appId: g.appId,
					alias: g.alias,
					name: g.name,
					updatedAt: s.taken_at.toISOString(),
					total: s.total,
					official: s.official,
					dup3: s.dup3,
					dup10: s.dup10,
					anonymous: s.anonymous,
					largestCluster: s.largest_cluster,
					truncated: s.truncated,
					sparkline: (perGameDaily.get(g.appId) ?? []).slice(-30),
				},
			];
		}),
		daily: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
		samples,
		topClusters: topClusters.map((c) => ({
			appId: c.app_id,
			alias: gameByAppId(c.app_id)?.alias ?? String(c.app_id),
			name: c.name,
			map: c.map,
			maxPlayers: c.max_players,
			size: c.size,
			ips: c.ips,
			subnets: c.subnets,
			firstSeen: new Date(c.first_seen).toISOString(),
		})),
		rules: [
			{ ...RULES[0], count: sum((s) => s.dup3) },
			{ ...RULES[1], count: sum((s) => s.dup100) },
			{ ...RULES[2], count: sum((s) => s.anonymous) },
			{ ...RULES[3], count: density.dense_ip },
			{ ...RULES[4], count: density.dense_subnet },
		].map(({ id, label, description, count }) => ({ id, label, description, count })),
	};
	cache = { at: Date.now(), value };
	return value;
}

export function invalidateStats(): void {
	cache = null;
}

export type CheckVerdict = "duplicate" | "unique" | "gone" | "not_listed" | "listed_recently" | "official";

export type CheckResponse = {
	addr: string;
	verdict: CheckVerdict;
	snapshotAt: string | null;
	listing: {
		appId: number;
		alias: string;
		name: string | null;
		map: string | null;
		players: number | null;
		maxPlayers: number | null;
		anonymous: boolean;
		official: boolean;
		clusterSize: number;
		firstSeen: string;
		lastSeen: string;
		onSameIp: number;
		onSameSubnet: number;
	} | null;
	rules: {
		id: RuleId;
		label: string;
		description: string;
		hit: boolean;
		detail: string | null;
		value: number | null;
	}[];
};

const CHECK_CACHE_MS = 60_000;
const checkCache = new Map<string, { at: number; value: CheckResponse }>();

export async function checkAddress(config: Config, addr: string): Promise<CheckResponse> {
	const hit = checkCache.get(addr);
	if (hit && Date.now() - hit.at < CHECK_CACHE_MS) return hit.value;
	const value = await computeCheck(config, addr);
	if (checkCache.size > 5000) checkCache.clear();
	checkCache.set(addr, { at: Date.now(), value });
	return value;
}

async function computeCheck(config: Config, addr: string): Promise<CheckResponse> {
	const parts = splitAddr(addr);
	if (!parts) throw new Error("addr must look like 1.2.3.4:27015");
	const sql = db();
	const rows = (await sql`
		WITH cur AS (SELECT DISTINCT ON (app_id) app_id, taken_at FROM snapshots ORDER BY app_id, taken_at DESC)
		SELECT l.*, cur.taken_at AS snapshot_at,
			(SELECT count(*)::int FROM listings x JOIN cur c2 ON c2.app_id = x.app_id AND c2.taken_at = x.last_seen
				WHERE x.ip = l.ip) AS on_same_ip,
			(SELECT count(*)::int FROM listings x JOIN cur c2 ON c2.app_id = x.app_id AND c2.taken_at = x.last_seen
				WHERE x.ip << ${subnetOf(parts.ip)}::cidr) AS on_same_subnet
		FROM listings l LEFT JOIN cur ON cur.app_id = l.app_id
		WHERE l.addr = ${addr}
		ORDER BY l.last_seen DESC
		LIMIT 1
	`) as {
		app_id: number;
		name: string | null;
		map: string | null;
		players: number | null;
		max_players: number | null;
		anonymous: boolean;
		official: boolean;
		cluster_size: number;
		first_seen: Date;
		last_seen: Date;
		snapshot_at: Date | null;
		on_same_ip: number;
		on_same_subnet: number;
	}[];

	const snapshotAt = rows[0]?.snapshot_at ?? null;
	const baseRules = RULES.map((r) => ({
		id: r.id,
		label: r.label,
		description: r.description,
		hit: false,
		detail: null as string | null,
		value: null as number | null,
	}));

	if (rows.length === 0) {
		let verdict: CheckVerdict = "not_listed";
		if (config.STEAM_WEB_API_KEY && isPublicIp(parts.ip)) {
			try {
				const live = await fetchByAddress(config.STEAM_WEB_API_KEY, addr);
				if (live.length > 0) verdict = "listed_recently";
			} catch {
				// live lookup is best effort
			}
		}
		return { addr, verdict, snapshotAt: snapshotAt?.toISOString() ?? null, listing: null, rules: baseRules };
	}

	const r = rows[0];
	const current = snapshotAt !== null && r.last_seen.getTime() === snapshotAt.getTime();
	const hits: Record<RuleId, string | null> = {
		identical:
			r.cluster_size >= 3 ? `${r.cluster_size} addresses share this name, map and max players` : null,
		farm: r.cluster_size >= 100 ? `cluster of ${r.cluster_size} identical listings` : null,
		anonymous: r.anonymous ? "no game server login token" : null,
		"dense-ip": r.on_same_ip >= 10 ? `${r.on_same_ip} listings on this IP` : null,
		"dense-subnet": r.on_same_subnet >= 50 ? `${r.on_same_subnet} listings in this /24` : null,
	};
	const values: Record<RuleId, number> = {
		identical: r.cluster_size,
		farm: r.cluster_size,
		anonymous: r.anonymous ? 1 : 0,
		"dense-ip": r.on_same_ip,
		"dense-subnet": r.on_same_subnet,
	};
	const rules = baseRules.map((b) => ({
		...b,
		hit: hits[b.id] !== null,
		detail: hits[b.id],
		value: hits[b.id] !== null ? values[b.id] : null,
	}));
	const verdict: CheckVerdict = r.official
		? "official"
		: !current
			? "gone"
			: r.cluster_size >= 3
				? "duplicate"
				: "unique";
	return {
		addr,
		verdict,
		snapshotAt: snapshotAt?.toISOString() ?? null,
		listing: {
			appId: r.app_id,
			alias: gameByAppId(r.app_id)?.alias ?? String(r.app_id),
			name: r.name,
			map: r.map,
			players: r.players,
			maxPlayers: r.max_players,
			anonymous: r.anonymous,
			official: r.official,
			clusterSize: r.cluster_size,
			firstSeen: r.first_seen.toISOString(),
			lastSeen: r.last_seen.toISOString(),
			onSameIp: r.on_same_ip,
			onSameSubnet: r.on_same_subnet,
		},
		rules,
	};
}
