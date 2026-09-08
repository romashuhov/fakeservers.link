// Page counters, first party and cookie-free. A hit bumps a row in page_views; a visitor is a daily
// salted hash of address plus user agent, which is why no consent banner is needed.
import type { Config } from "./config";
import { db } from "./db";

const BOTS =
	/bot|crawl|spider|slurp|facebookexternalhit|embedly|quora|pinterest|preview|curl|wget|python|java\/|go-http|okhttp|headless|monitor|uptime|scanner|semrush|ahrefs|dataprovider|phantom/i;

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Host only, so the referrer says "reddit.com" and never carries a path or a query. */
function referrerHost(raw: string | null, self: string): string {
	if (!raw) return "";
	try {
		const host = new URL(raw).hostname.replace(/^www\./, "");
		return host === self ? "" : host.slice(0, 80);
	} catch {
		return "";
	}
}

function visitorHash(secret: string, day: string, ip: string, ua: string): string {
	return new Bun.CryptoHasher("sha256").update(`${secret}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** Fire and forget: a counter must never delay or break a page. */
export function recordView(config: Config, request: Request, path: string, ip: string): void {
	const ua = request.headers.get("user-agent") ?? "";
	if (!ua || BOTS.test(ua)) return;
	const day = today();
	const self = config.PUBLIC_URL.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
	const referrer = referrerHost(request.headers.get("referer"), self);
	const country = (request.headers.get("cf-ipcountry") ?? "").slice(0, 2).toUpperCase();
	const visitor = visitorHash(config.DATABASE_URL, day, ip, ua);
	const sql = db();
	void (async () => {
		await sql`
			INSERT INTO page_views (day, path, referrer, country, views)
			VALUES (${day}, ${path}, ${referrer}, ${country}, 1)
			ON CONFLICT (day, path, referrer, country) DO UPDATE SET views = page_views.views + 1
		`;
		await sql`INSERT INTO view_visitors (day, visitor) VALUES (${day}, ${visitor}) ON CONFLICT DO NOTHING`;
	})().catch((e) => console.error("[views]", e instanceof Error ? e.message : e));
}

export type ViewsReport = {
	days: number;
	totals: { views: number; visitors: number };
	daily: { day: string; views: number; visitors: number }[];
	paths: { path: string; views: number }[];
	referrers: { referrer: string; views: number }[];
	countries: { country: string; views: number }[];
};

export async function viewsReport(days = 30): Promise<ViewsReport> {
	const sql = db();
	const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
	const [daily, paths, referrers, countries, visitors] = (await Promise.all([
		sql`SELECT day::text, sum(views)::int AS views FROM page_views WHERE day >= ${since}::date GROUP BY day ORDER BY day`,
		sql`SELECT path, sum(views)::int AS views FROM page_views WHERE day >= ${since}::date GROUP BY path ORDER BY 2 DESC LIMIT 20`,
		sql`SELECT referrer, sum(views)::int AS views FROM page_views WHERE day >= ${since}::date AND referrer <> '' GROUP BY referrer ORDER BY 2 DESC LIMIT 20`,
		sql`SELECT country, sum(views)::int AS views FROM page_views WHERE day >= ${since}::date AND country <> '' GROUP BY country ORDER BY 2 DESC LIMIT 20`,
		sql`SELECT day::text, count(*)::int AS visitors FROM view_visitors WHERE day >= ${since}::date GROUP BY day ORDER BY day`,
	])) as [
		{ day: string; views: number }[],
		{ path: string; views: number }[],
		{ referrer: string; views: number }[],
		{ country: string; views: number }[],
		{ day: string; visitors: number }[],
	];
	const byDay = new Map(visitors.map((v) => [v.day, v.visitors]));
	return {
		days,
		totals: {
			views: daily.reduce((a, d) => a + d.views, 0),
			visitors: visitors.reduce((a, d) => a + d.visitors, 0),
		},
		daily: daily.map((d) => ({ day: d.day, views: d.views, visitors: byDay.get(d.day) ?? 0 })),
		paths,
		referrers,
		countries,
	};
}

export function printViews(r: ViewsReport): void {
	const pad = (s: string | number, n: number) => String(s).padStart(n);
	console.log(`last ${r.days} days: ${r.totals.views} views, ${r.totals.visitors} visitors\n`);
	console.log("day          views  visitors");
	for (const d of r.daily) console.log(`${d.day}  ${pad(d.views, 6)}  ${pad(d.visitors, 8)}`);
	for (const [title, rows] of [
		["paths", r.paths.map((p) => [p.path, p.views] as const)],
		["referrers", r.referrers.map((p) => [p.referrer, p.views] as const)],
		["countries", r.countries.map((p) => [p.country, p.views] as const)],
	] as const) {
		if (rows.length === 0) continue;
		console.log(`\n${title}`);
		for (const [name, views] of rows) console.log(`${pad(views, 8)}  ${name}`);
	}
}
