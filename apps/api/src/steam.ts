// Steam Web API IGameServersService/GetServerList: the only data source of the site.
//
// The endpoint returns at most 10 000 rows per call and ignores `offset`, so a full list is
// assembled by partitioning: a bucket that comes back capped is split by the next filter
// (region, secure, empty, linux, dedicated, password) and, as the last resort, by map.
import { z } from "zod";

const serverSchema = z
	.object({
		addr: z.string(),
		gameport: z.number().optional(),
		steamid: z.string().optional(),
		name: z.string().optional(),
		appid: z.number().optional(),
		gamedir: z.string().optional(),
		version: z.string().optional(),
		product: z.string().optional(),
		region: z.number().optional(),
		players: z.number().optional(),
		max_players: z.number().optional(),
		bots: z.number().optional(),
		map: z.string().optional(),
		secure: z.boolean().optional(),
		dedicated: z.boolean().optional(),
		os: z.string().optional(),
		gametype: z.string().optional(),
	})
	.loose();

const responseSchema = z.object({
	response: z.object({ servers: z.array(serverSchema).default([]) }).default({ servers: [] }),
});

export type SteamServer = z.infer<typeof serverSchema>;

export type FetchResult = {
	servers: SteamServer[];
	/** Number of API calls the list took. */
	pages: number;
	/** True when some bucket stayed capped after every split: the real total is higher. */
	truncated: boolean;
};

const ENDPOINT = "https://api.steampowered.com/IGameServersService/GetServerList/v1/";
/** Hard limit of the endpoint. A bucket returning this many (or a few less) rows is treated as capped. */
export const API_CAP = 10_000;
const CAP_SLACK = 20;
const REGIONS = [0, 1, 2, 3, 4, 5, 6, 7, 255];
const MAP_SPLIT_SIZE = 25;
const MAX_MAP_ROUNDS = 8;

async function getPage(
	key: string,
	filter: string,
	limit: number,
	timeoutMs = 120_000,
): Promise<SteamServer[]> {
	const url = new URL(ENDPOINT);
	url.searchParams.set("key", key);
	url.searchParams.set("filter", filter);
	url.searchParams.set("limit", String(limit));
	const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
	if (!res.ok) throw new Error(`GetServerList ${res.status} for ${filter}`);
	return responseSchema.parse(await res.json()).response.servers;
}

function isCapped(count: number): boolean {
	return count >= API_CAP - CAP_SLACK;
}

/** Each splitter turns one filter into disjoint sub-filters. Applied in order while a bucket stays capped. */
const SPLITTERS: ((base: string) => string[])[] = [
	(b) => REGIONS.map((r) => `${b}\\region\\${r}`),
	(b) => [`${b}\\secure\\1`, `${b}\\nor\\1\\secure\\1`],
	(b) => [`${b}\\noplayers\\1`, `${b}\\nor\\1\\noplayers\\1`],
	(b) => [`${b}\\linux\\1`, `${b}\\nor\\1\\linux\\1`],
	(b) => [`${b}\\dedicated\\1`, `${b}\\nor\\1\\dedicated\\1`],
	(b) => [`${b}\\password\\0`, `${b}\\nor\\1\\password\\0`],
];

type Collector = { key: string; seen: Map<string, SteamServer>; pages: number; truncated: boolean };

function absorb(c: Collector, rows: SteamServer[]): void {
	for (const s of rows) {
		if (s.addr && !c.seen.has(s.addr)) c.seen.set(s.addr, s);
	}
}

/** Last resort for a bucket that is still capped: split by the maps it contains, then by whatever is left. */
async function splitByMaps(
	c: Collector,
	filter: string,
	sample: SteamServer[],
	round: number,
): Promise<void> {
	const counts = new Map<string, number>();
	for (const s of sample) {
		if (s.map) counts.set(s.map, (counts.get(s.map) ?? 0) + 1);
	}
	const maps = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAP_SPLIT_SIZE)
		.map(([m]) => m);
	if (maps.length === 0 || round >= MAX_MAP_ROUNDS) {
		c.truncated = true;
		return;
	}
	for (const m of maps) {
		const rows = await getPage(c.key, `${filter}\\map\\${m}`, API_CAP);
		c.pages++;
		absorb(c, rows);
		if (isCapped(rows.length)) c.truncated = true; // one map, nothing left to split by
	}
	const rest = `${filter}\\nor\\${maps.length}${maps.map((m) => `\\map\\${m}`).join("")}`;
	const rows = await getPage(c.key, rest, API_CAP);
	c.pages++;
	absorb(c, rows);
	if (isCapped(rows.length)) await splitByMaps(c, rest, rows, round + 1);
}

async function collectBucket(c: Collector, filter: string, depth: number): Promise<void> {
	const rows = await getPage(c.key, filter, API_CAP);
	c.pages++;
	absorb(c, rows);
	if (!isCapped(rows.length)) return;
	const splitter = SPLITTERS[depth];
	if (!splitter) {
		await splitByMaps(c, filter, rows, 0);
		return;
	}
	for (const sub of splitter(filter)) await collectBucket(c, sub, depth + 1);
}

/** Full list for a filter such as `\appid\730`, deduplicated by addr. */
export async function fetchServerList(key: string, filter: string): Promise<FetchResult> {
	const c: Collector = { key, seen: new Map(), pages: 0, truncated: false };
	await collectBucket(c, filter, 0);
	return { servers: [...c.seen.values()], pages: c.pages, truncated: c.truncated };
}

/** One address as the master server currently lists it, any app. */
export async function fetchByAddress(key: string, addr: string): Promise<SteamServer[]> {
	return getPage(key, `\\gameaddr\\${addr}`, 50, 5_000);
}

export function splitAddr(addr: string): { ip: string; port: number } | null {
	const idx = addr.lastIndexOf(":");
	if (idx <= 0) return null;
	const ip = addr.slice(0, idx);
	const port = Number.parseInt(addr.slice(idx + 1), 10);
	if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;
	if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
	return { ip, port };
}

export function subnetOf(ip: string): string {
	return `${ip.slice(0, ip.lastIndexOf("."))}.0/24`;
}

/** False for private, loopback, link-local and reserved ranges: Steam never lists those, no point asking. */
export function isPublicIp(ip: string): boolean {
	const [a, b] = ip.split(".").map(Number);
	if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
	if (a === 172 && b >= 16 && b <= 31) return false;
	if (a === 192 && b === 168) return false;
	if (a === 169 && b === 254) return false;
	if (a === 100 && b >= 64 && b <= 127) return false;
	return true;
}

/** SteamID64 account type: 3 = game server logged in with a token, anything else counts as anonymous. */
export function isAnonymousSteamId(steamid: string | undefined): boolean {
	if (!steamid || steamid === "0") return true;
	try {
		const type = (BigInt(steamid) >> 52n) & 0xfn;
		return type !== 3n;
	} catch {
		return true;
	}
}

export function normalizeName(name: string | undefined): string {
	return (name ?? "").replace(/\s+/g, " ").trim();
}
