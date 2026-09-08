import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Elysia } from "elysia";
import { z } from "zod";
import { scheduleCollector } from "./collector";
import { loadConfig } from "./config";
import { db } from "./db";
import { dataDir, exportCompletedDays } from "./export";
import { farmDetail, farmsQuery, listFarms } from "./farms";
import { headline, ogImage } from "./og";
import { checkAddress, getStats, refreshStats } from "./stats";
import { splitAddr } from "./steam";

const config = loadConfig();
const collector = scheduleCollector(config, () => {
	void refreshStats(config, collector.nextRunAt).catch((e) =>
		console.error("[stats] refresh failed:", e instanceof Error ? e.message : e),
	);
	if (config.DATA_EXPORT) {
		exportCompletedDays(dataDir(config.DATA_DIR), config)
			.then((days) => {
				if (days.length > 0) console.log(`[export] wrote ${days.join(", ")}`);
			})
			.catch((e) => console.error("[export] failed:", e instanceof Error ? e.message : e));
	}
});
// Warm the stats cache so the first visitor after a restart is not the one paying for it.
await refreshStats(config, collector.nextRunAt).catch((e) =>
	console.error("[stats] warm-up failed:", e instanceof Error ? e.message : e),
);

// --- rate limiting for reports: a sliding hour per client -------------------------------------
const reportHits = new Map<string, number[]>();
function allowReport(client: string): boolean {
	const now = Date.now();
	const hits = (reportHits.get(client) ?? []).filter((t) => now - t < 3_600_000);
	if (hits.length >= config.REPORT_RATE_PER_HOUR) {
		reportHits.set(client, hits);
		return false;
	}
	hits.push(now);
	reportHits.set(client, hits);
	return true;
}

function clientIp(request: Request, direct: string | undefined): string {
	if (config.TRUST_PROXY) {
		const cf = request.headers.get("cf-connecting-ip");
		if (cf) return cf;
		const xff = request.headers.get("x-forwarded-for");
		if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
	}
	return direct ?? "unknown";
}

function hashClient(ip: string): string {
	return new Bun.CryptoHasher("sha256").update(`fakeservers:${ip}`).digest("hex").slice(0, 32);
}

const reportBody = z.object({
	addr: z.string().min(9).max(21),
	note: z.string().max(500).optional(),
});

// --- static SPA (prod): dist next to the api, or STATIC_DIR --------------------------------------
const staticDir = config.STATIC_DIR || resolve(import.meta.dir, "../../web/dist");
const serveStatic = config.FAKESERVERS_ENV === "prod" && existsSync(staticDir);

const app = new Elysia()
	.get("/api/health", async () => {
		await db()`SELECT 1`;
		return { ok: true };
	})
	.get("/api/stats", async ({ set }) => {
		set.headers["cache-control"] = "public, max-age=60";
		return getStats(config, collector.nextRunAt);
	})
	.get("/api/check", async ({ query, set }) => {
		const addr = String(query.addr ?? "").trim();
		if (!splitAddr(addr)) {
			set.status = 400;
			return { error: "addr must look like 1.2.3.4:27015" };
		}
		return checkAddress(config, addr);
	})
	.get("/og.png", async ({ set }) => {
		const stats = await getStats(config, collector.nextRunAt);
		set.headers["content-type"] = "image/png";
		set.headers["cache-control"] = "public, max-age=600";
		return new Uint8Array(await ogImage(stats));
	})
	.get("/api/farms", async ({ query, set }) => {
		const parsed = farmsQuery.safeParse(query);
		if (!parsed.success) {
			set.status = 400;
			return { error: "bad query" };
		}
		set.headers["cache-control"] = "public, max-age=60";
		return listFarms(parsed.data);
	})
	.get("/api/farms/:id", async ({ params, query, set }) => {
		const id = Number.parseInt(params.id, 10);
		const num = (v: unknown, fallback: number, max: number) =>
			Math.min(max, Math.max(0, Number.parseInt(String(v ?? fallback), 10) || fallback));
		if (!Number.isInteger(id) || id <= 0) {
			set.status = 400;
			return { error: "bad id" };
		}
		const detail = await farmDetail(id, {
			offset: num(query.offset, 0, 1_000_000),
			limit: Math.max(1, num(query.limit, 50, 100)),
			subnetOffset: num(query.soffset, 0, 1_000_000),
			subnetLimit: Math.max(1, num(query.slimit, 10, 100)),
		});
		if (!detail) {
			set.status = 404;
			return { error: "no such farm" };
		}
		set.headers["cache-control"] = "public, max-age=60";
		return detail;
	})
	.post("/api/report", async ({ body, request, server, set }) => {
		const parsed = reportBody.safeParse(body);
		if (!parsed.success || !splitAddr(parsed.data.addr)) {
			set.status = 400;
			return { error: "addr must look like 1.2.3.4:27015, note up to 500 characters" };
		}
		const ip = clientIp(request, server?.requestIP(request)?.address);
		if (!allowReport(ip)) {
			set.status = 429;
			return { error: "too many reports from this address, try again later" };
		}
		await db()`INSERT INTO reports (addr, note, client_hash)
			VALUES (${parsed.data.addr}, ${parsed.data.note ?? null}, ${hashClient(ip)})`;
		return { ok: true };
	});

// --- link previews: the shell gets live Open Graph text before it leaves the server ------------
const publicUrl = config.PUBLIC_URL.replace(/\/+$/, "");
function setMeta(html: string, key: string, value: string): string {
	const re = new RegExp(`(<meta (?:property|name)="${key}" content=")[^"]*(")`);
	return html.replace(re, `$1${value.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}$2`);
}
async function shellFor(path: string): Promise<string> {
	let html = await Bun.file(resolve(staticDir, "index.html")).text();
	const stats = await getStats(config, collector.nextRunAt);
	const h = headline(stats);
	const title = stats.updatedAt
		? `${h.pct}% of Counter-Strike servers in the Steam browser are fake`
		: "fakeservers.link — fake servers in the Steam browser, counted";
	const description = stats.updatedAt
		? `At least ${h.fake} of ${h.total} community listings are clones of each other. Counted every hour from the Steam Web API, Valve's own servers excluded. Updated ${h.updated}.`
		: "Live count of fake and mirror servers in the Counter-Strike server browser, updated hourly from the Steam Web API.";
	const image = `${publicUrl}/og.png?v=${stats.updatedAt ? Date.parse(stats.updatedAt) : 0}`;
	for (const k of ["og:title", "twitter:title"]) html = setMeta(html, k, title);
	for (const k of ["og:description", "twitter:description", "description"])
		html = setMeta(html, k, description);
	for (const k of ["og:image", "twitter:image"]) html = setMeta(html, k, image);
	html = setMeta(html, "og:url", `${publicUrl}${path}`);
	return html;
}

if (serveStatic) {
	app.get("/*", async ({ params, set, path }) => {
		const rel = (params["*"] ?? "").replace(/\.\./g, "");
		const file = Bun.file(resolve(staticDir, rel));
		if (rel && (await file.exists())) {
			if (rel.startsWith("assets/")) set.headers["cache-control"] = "public, max-age=31536000, immutable";
			return file;
		}
		set.headers["content-type"] = "text/html; charset=utf-8";
		set.headers["cache-control"] = "public, max-age=60";
		return shellFor(path === "/farms" ? "/farms" : "/");
	});
}

app.listen({ hostname: "0.0.0.0", port: config.PORT });
console.log(
	`[api] listening on http://0.0.0.0:${config.PORT} (${config.FAKESERVERS_ENV}${serveStatic ? ", serving static" : ""})`,
);
