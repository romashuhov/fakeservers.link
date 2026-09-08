import { z } from "zod";

const schema = z.object({
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	STEAM_WEB_API_KEY: z.string().default(""),
	PORT: z.coerce.number().int().positive().default(4202),
	COLLECT_INTERVAL_MIN: z.coerce.number().int().positive().default(60),
	COLLECT_ON_START: z.coerce.number().int().default(1),
	REPORT_RATE_PER_HOUR: z.coerce.number().int().positive().default(5),
	TRUST_PROXY: z.coerce.number().int().default(0),
	FAKESERVERS_ENV: z.enum(["dev", "prod"]).default("dev"),
	STATIC_DIR: z.string().default(""),
	/** Write data/YYYY/MM/DD.json after each collection (completed days only). */
	DATA_EXPORT: z.coerce.number().int().default(0),
	DATA_DIR: z.string().default(""),
	/** Push daily exports into the repository via the GitHub API: owner/repo, branch, token with Contents: write. */
	DATA_REPO: z.string().default("romashuhov/fakeservers.link"),
	DATA_BRANCH: z.string().default("main"),
	DATA_PUSH_TOKEN: z.string().default(""),
	/** Token for GET /api/views. Empty means the endpoint does not exist. */
	ADMIN_TOKEN: z.string().default(""),
	/** Public origin of the site, used for absolute Open Graph URLs (image, canonical). */
	PUBLIC_URL: z.string().default("https://fakeservers.link"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
	const parsed = schema.safeParse(process.env);
	if (!parsed.success) {
		const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
		throw new Error(`Invalid environment:\n${lines.join("\n")}`);
	}
	return parsed.data;
}

/** Games tracked on the site. Adding one here is enough: the collector picks it up on the next run. */
export const GAMES = [
	{ appId: 730, alias: "cs2", name: "Counter-Strike 2" },
	{ appId: 4465480, alias: "csgo", name: "CS:GO Legacy" },
	{ appId: 240, alias: "css", name: "Counter-Strike: Source" },
	{ appId: 10, alias: "cs16", name: "Counter-Strike 1.6" },
	{ appId: 80, alias: "cscz", name: "Condition Zero" },
] as const;

export const GAME_IDS: number[] = GAMES.map((g) => g.appId);

export type Game = (typeof GAMES)[number];

export function gameByAppId(appId: number): Game | undefined {
	return GAMES.find((g) => g.appId === appId);
}

/**
 * Names that are legitimately identical on many real servers: the engine's default server name and
 * Valve's own official servers. They count in the totals but are never clustered.
 */
const NOT_CLUSTERED_NAMES = new Set(
	[
		"Counter-Strike 2",
		"Counter-Strike: Global Offensive",
		"CS:GO Server",
		"CSGO Server",
		"CSGO",
		"Counter-Strike: Source",
		"Counter-Strike",
		"Half-Life",
	].map((n) => n.toLowerCase()),
);
/** Valve's own servers: "Valve Counter-Strike 2 falkenstein Server (...)", "Valve Matchmaking Server ...". */
const OFFICIAL_PREFIXES = ["valve counter-strike", "valve matchmaking"];

/**
 * Valve's official servers are listed by the master server but are not community servers: they are
 * stored for lookups and excluded from every count. Detected by name or by an address in the Steam
 * Datagram Relay range 100.64.0.0/10, which only Valve's infrastructure announces.
 */
export function isOfficial(name: string, ip: string): boolean {
	const n = name.toLowerCase();
	if (OFFICIAL_PREFIXES.some((p) => n.startsWith(p))) return true;
	const [a, b] = ip.split(".").map(Number);
	return a === 100 && b >= 64 && b <= 127;
}

/** Default engine names are shared by many unrelated real servers and never form a cluster. */
export function isClusterable(name: string): boolean {
	return !NOT_CLUSTERED_NAMES.has(name.toLowerCase());
}
