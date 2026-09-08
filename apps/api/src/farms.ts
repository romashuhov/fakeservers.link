// Farms page: every identical-listing cluster of the latest run, filterable and sortable, with the
// member addresses on demand. Everything is read from `farms` (one row per cluster) and `listings`.
import { z } from "zod";
import { GAME_IDS, gameByAppId } from "./config";
import { db } from "./db";

export const farmsQuery = z.object({
	game: z.coerce.number().int().optional(),
	map: z.string().max(100).optional(),
	q: z.string().max(100).optional(),
	/** An address, IP, or prefix ("1.2.3.4:27015", "1.2.3.4", "1.2.3", "1.2.3.0/24"): farms with a member inside it. */
	ip: z.string().max(40).optional(),
	sort: z.enum(["size", "ips", "subnets", "players", "newest", "oldest"]).default("size"),
	min: z.coerce.number().int().min(3).max(100000).default(3),
	offset: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type FarmsQuery = z.infer<typeof farmsQuery>;

export type Farm = {
	id: number;
	appId: number;
	alias: string;
	name: string;
	map: string;
	maxPlayers: number;
	size: number;
	ips: number;
	subnets: number;
	players: number;
	firstSeen: string;
	lastSeen: string;
};

export type FarmsResponse = {
	asOf: string | null;
	total: number;
	totalListings: number;
	farms: Farm[];
	maps: { map: string; farms: number; listings: number }[];
	games: { appId: number; alias: string; farms: number }[];
};

type FarmRow = {
	id: number;
	app_id: number;
	name: string;
	map: string;
	max_players: number;
	size: number;
	ips: number;
	subnets: number;
	players: number;
	first_seen: Date;
	last_seen: Date;
};

const ORDER: Record<FarmsQuery["sort"], string> = {
	size: "size DESC, ips DESC, name",
	ips: "ips DESC, size DESC, name",
	subnets: "subnets DESC, size DESC, name",
	players: "players DESC, size DESC, name",
	newest: "first_seen DESC, size DESC, name",
	oldest: "first_seen ASC, size DESC, name",
};

function toFarm(r: FarmRow): Farm {
	return {
		id: r.id,
		appId: r.app_id,
		alias: gameByAppId(r.app_id)?.alias ?? String(r.app_id),
		name: r.name,
		map: r.map,
		maxPlayers: r.max_players,
		size: r.size,
		ips: r.ips,
		subnets: r.subnets,
		players: r.players,
		firstSeen: r.first_seen.toISOString(),
		lastSeen: r.last_seen.toISOString(),
	};
}

/** Farms present in the latest run of their game, with facets for the filters. */
export async function listFarms(q: FarmsQuery): Promise<FarmsResponse> {
	const sql = db();
	const like = q.q ? `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
	const gameFilter = q.game && GAME_IDS.includes(q.game) ? q.game : null;
	const mapFilter = q.map ?? null;
	const cidr = q.ip ? toCidr(q.ip) : null;
	const rows = (await sql`
		WITH cur AS (
			SELECT DISTINCT ON (app_id) app_id, taken_at FROM snapshots
			WHERE app_id IN (SELECT jsonb_array_elements_text(${GAME_IDS}::jsonb)::int)
			ORDER BY app_id, taken_at DESC
		),
		live AS (
			SELECT f.* FROM farms f JOIN cur ON cur.app_id = f.app_id AND cur.taken_at = f.last_seen
			WHERE f.size >= ${q.min}
				AND (${gameFilter}::int IS NULL OR f.app_id = ${gameFilter}::int)
				AND (${mapFilter}::text IS NULL OR f.map = ${mapFilter}::text)
				AND (${like}::text IS NULL OR f.name ILIKE ${like}::text)
				AND (${cidr}::cidr IS NULL OR (f.app_id, f.name, f.map, f.max_players) IN (
					SELECT l.app_id, l.name, coalesce(l.map, ''), coalesce(l.max_players, 0)
					FROM listings l WHERE l.ip <<= ${cidr}::cidr AND l.cluster_size >= 3
				))
		)
		SELECT (SELECT count(*)::int FROM live) AS total,
			(SELECT coalesce(sum(size), 0)::int FROM live) AS total_listings,
			(SELECT max(taken_at) FROM cur) AS as_of,
			(SELECT coalesce(jsonb_agg(m ORDER BY lower(m.map)), '[]'::jsonb) FROM (
				SELECT map, count(*)::int AS farms, sum(size)::int AS listings FROM live GROUP BY map ORDER BY 3 DESC LIMIT 80
			) m) AS maps,
			(SELECT coalesce(jsonb_agg(g ORDER BY g.farms DESC), '[]'::jsonb) FROM (
				SELECT app_id, count(*)::int AS farms FROM live GROUP BY app_id
			) g) AS games,
			(SELECT coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM (
				SELECT * FROM live ORDER BY ${sql.unsafe(ORDER[q.sort])} OFFSET ${q.offset} LIMIT ${q.limit}
			) p) AS page
	`) as {
		total: number;
		total_listings: number;
		as_of: Date | null;
		maps: { map: string; farms: number; listings: number }[];
		games: { app_id: number; farms: number }[];
		page: (Omit<FarmRow, "first_seen" | "last_seen"> & { first_seen: string; last_seen: string })[];
	}[];
	const r = rows[0];
	return {
		asOf: r?.as_of ? new Date(r.as_of).toISOString() : null,
		total: r?.total ?? 0,
		totalListings: r?.total_listings ?? 0,
		farms: (r?.page ?? []).map((p) =>
			toFarm({ ...p, first_seen: new Date(p.first_seen), last_seen: new Date(p.last_seen) }),
		),
		maps: r?.maps ?? [],
		games: (r?.games ?? []).map((g) => ({
			appId: g.app_id,
			alias: gameByAppId(g.app_id)?.alias ?? String(g.app_id),
			farms: g.farms,
		})),
	};
}

export type FarmMember = {
	addr: string;
	players: number | null;
	maxPlayers: number | null;
	anonymous: boolean;
	firstSeen: string;
	lastSeen: string;
};

export type FarmDetail = {
	farm: Farm;
	members: FarmMember[];
	membersTotal: number;
	/** /24 subnets the farm announces from, largest first (paged). */
	subnets: { subnet: string; count: number }[];
	subnetsTotal: number;
};

export type DetailPage = { offset: number; limit: number; subnetOffset: number; subnetLimit: number };

export async function farmDetail(id: number, page: DetailPage): Promise<FarmDetail | null> {
	const sql = db();
	const farms = (await sql`SELECT * FROM farms WHERE id = ${id}`) as FarmRow[];
	const f = farms[0];
	if (!f) return null;
	const members = (await sql`
		SELECT l.addr, l.players, l.max_players, l.anonymous, l.first_seen, l.last_seen
		FROM listings l
		WHERE l.app_id = ${f.app_id} AND l.name = ${f.name} AND coalesce(l.map, '') = ${f.map}
			AND coalesce(l.max_players, 0) = ${f.max_players} AND l.last_seen = ${f.last_seen} AND NOT l.official
		ORDER BY l.ip, l.port
		OFFSET ${page.offset} LIMIT ${page.limit}
	`) as {
		addr: string;
		players: number | null;
		max_players: number | null;
		anonymous: boolean;
		first_seen: Date;
		last_seen: Date;
	}[];
	const subnets = (await sql`
		SELECT host(network(set_masklen(l.ip, 24))) || '/24' AS subnet, count(*)::int AS count
		FROM listings l
		WHERE l.app_id = ${f.app_id} AND l.name = ${f.name} AND coalesce(l.map, '') = ${f.map}
			AND coalesce(l.max_players, 0) = ${f.max_players} AND l.last_seen = ${f.last_seen} AND NOT l.official
		GROUP BY 1 ORDER BY 2 DESC, 1
		OFFSET ${page.subnetOffset} LIMIT ${page.subnetLimit}
	`) as { subnet: string; count: number }[];
	const subnetsTotal = (await sql`
		SELECT count(*)::int AS n FROM (
			SELECT 1 FROM listings l
			WHERE l.app_id = ${f.app_id} AND l.name = ${f.name} AND coalesce(l.map, '') = ${f.map}
				AND coalesce(l.max_players, 0) = ${f.max_players} AND l.last_seen = ${f.last_seen} AND NOT l.official
			GROUP BY network(set_masklen(l.ip, 24))
		) t
	`) as { n: number }[];
	return {
		farm: toFarm(f),
		members: members.map((m) => ({
			addr: m.addr,
			players: m.players,
			maxPlayers: m.max_players,
			anonymous: m.anonymous,
			firstSeen: m.first_seen.toISOString(),
			lastSeen: m.last_seen.toISOString(),
		})),
		membersTotal: f.size,
		subnets,
		subnetsTotal: subnetsTotal[0]?.n ?? subnets.length,
	};
}

/** "1.2.3.4:27015" → 1.2.3.4/32, "1.2.3" → 1.2.3.0/24, "1.2" → 1.2.0.0/16, "1.2.3.0/24" as is; null when not an IP. */
export function toCidr(input: string): string | null {
	const s = input.trim().replace(/:\d+$/, "");
	const m = /^(\d{1,3})(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?(?:\/(\d{1,2}))?$/.exec(s);
	if (!m) return null;
	const parts = [m[1], m[2], m[3], m[4]].filter((x): x is string => x !== undefined).map(Number);
	if (parts.some((x) => x > 255)) return null;
	const given = parts.length;
	while (parts.length < 4) parts.push(0);
	const mask = m[5] !== undefined ? Number(m[5]) : given * 8;
	if (mask > 32) return null;
	return `${parts.join(".")}/${mask}`;
}
