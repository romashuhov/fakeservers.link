// Daily export of the aggregates into data/YYYY/MM/DD.json, so the history lives in git and can be
// checked without access to the database. Only completed UTC days are written; today changes hourly.

import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { type Config, GAME_IDS, GAMES, gameByAppId } from "./config";
import { db } from "./db";
import { publishDay, publishEnabled } from "./publish";

const MAX_BACKFILL_DAYS = 400;

/** DATA_DIR from the environment, else the repo's data/ folder next to apps/. */
export function dataDir(configured: string): string {
	return configured || resolve(import.meta.dir, "../../../data");
}

type SnapRow = {
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
	pages: number;
	truncated: boolean;
};

export type DayExport = {
	date: string;
	generatedAt: string;
	/** Last snapshot of the day per game, plus the hourly series behind it. */
	games: {
		appId: number;
		alias: string;
		takenAt: string;
		total: number;
		official: number;
		uniqueIps: number;
		uniqueSubnets: number;
		dup3: number;
		dup5: number;
		dup10: number;
		dup100: number;
		anonymous: number;
		appeared: number;
		disappeared: number;
		largestCluster: number;
		largestClusterName: string | null;
		maxPerIp: number;
		maxPerSubnet: number;
		truncated: boolean;
		hourly: { takenAt: string; total: number; dup3: number; dup10: number; anonymous: number }[];
	}[];
	totals: {
		total: number;
		official: number;
		dup3: number;
		dup5: number;
		dup10: number;
		dup100: number;
		anonymous: number;
	};
	/** Largest identical-listing clusters in the last snapshot of the day, all games. */
	topClusters: {
		alias: string;
		name: string;
		map: string | null;
		maxPlayers: number | null;
		size: number;
		ips: number;
		subnets: number;
	}[];
};

export function dayPath(dir: string, date: string): string {
	const [y, m, d] = date.split("-");
	return resolve(dir, y, m, `${d}.json`);
}

/** Builds the export for one UTC day; null when there is no snapshot that day. */
export async function buildDay(date: string): Promise<DayExport | null> {
	const sql = db();
	const rows = (await sql`
		SELECT * FROM snapshots
		WHERE taken_at >= ${`${date}T00:00:00Z`}::timestamptz AND taken_at < ${`${date}T00:00:00Z`}::timestamptz + interval '1 day'
			AND app_id IN (SELECT jsonb_array_elements_text(${GAME_IDS}::jsonb)::int)
		ORDER BY app_id, taken_at
	`) as SnapRow[];
	if (rows.length === 0) return null;

	const byApp = new Map<number, SnapRow[]>();
	for (const r of rows) byApp.set(r.app_id, [...(byApp.get(r.app_id) ?? []), r]);

	const games: DayExport["games"] = [];
	const lastIds: number[] = [];
	for (const g of GAMES) {
		const list = byApp.get(g.appId);
		if (!list || list.length === 0) continue;
		const last = list[list.length - 1];
		lastIds.push(last.id);
		games.push({
			appId: g.appId,
			alias: g.alias,
			takenAt: last.taken_at.toISOString(),
			total: last.total,
			official: last.official,
			uniqueIps: last.unique_ips,
			uniqueSubnets: last.unique_subnets,
			dup3: last.dup3,
			dup5: last.dup5,
			dup10: last.dup10,
			dup100: last.dup100,
			anonymous: last.anonymous,
			appeared: last.appeared,
			disappeared: last.disappeared,
			largestCluster: last.largest_cluster,
			largestClusterName: last.largest_cluster_name,
			maxPerIp: last.max_per_ip,
			maxPerSubnet: last.max_per_subnet,
			truncated: last.truncated,
			hourly: list.map((s) => ({
				takenAt: s.taken_at.toISOString(),
				total: s.total,
				dup3: s.dup3,
				dup10: s.dup10,
				anonymous: s.anonymous,
			})),
		});
	}

	const clusters = (await sql`
		SELECT c.name, c.map, c.max_players, c.size, c.ips, c.subnets, s.app_id
		FROM clusters c JOIN snapshots s ON s.id = c.snapshot_id
		WHERE c.snapshot_id IN (SELECT jsonb_array_elements_text(${lastIds}::jsonb)::bigint)
		ORDER BY c.size DESC, c.name
		LIMIT 100
	`) as {
		name: string;
		map: string | null;
		max_players: number | null;
		size: number;
		ips: number;
		subnets: number;
		app_id: number;
	}[];

	const sum = (pick: (g: DayExport["games"][number]) => number) => games.reduce((a, g) => a + pick(g), 0);
	return {
		date,
		generatedAt: new Date().toISOString(),
		games,
		totals: {
			total: sum((g) => g.total),
			official: sum((g) => g.official),
			dup3: sum((g) => g.dup3),
			dup5: sum((g) => g.dup5),
			dup10: sum((g) => g.dup10),
			dup100: sum((g) => g.dup100),
			anonymous: sum((g) => g.anonymous),
		},
		topClusters: clusters.map((c) => ({
			alias: gameByAppId(c.app_id)?.alias ?? String(c.app_id),
			name: c.name,
			map: c.map,
			maxPlayers: c.max_players,
			size: c.size,
			ips: c.ips,
			subnets: c.subnets,
		})),
	};
}

export async function exportDay(dir: string, date: string, force = false, config?: Config): Promise<boolean> {
	const path = dayPath(dir, date);
	if (!force && existsSync(path)) return false;
	const day = await buildDay(date);
	if (!day) return false;
	const text = `${JSON.stringify(day, null, "\t")}\n`;
	await mkdir(resolve(path, ".."), { recursive: true });
	await writeFile(path, text);
	if (config && publishEnabled(config)) {
		try {
			await publishDay(config, date, text);
			console.log(`[export] pushed ${date} to ${config.DATA_REPO}`);
		} catch (e) {
			// The local file is the "done" marker; drop it so the next run retries the push.
			await rm(path, { force: true });
			throw e;
		}
	}
	return true;
}

function utcDate(t: number): string {
	return new Date(t).toISOString().slice(0, 10);
}

/** Writes every completed UTC day that has snapshots and no file yet. Today is skipped. */
export async function exportCompletedDays(dir: string, config?: Config): Promise<string[]> {
	const first = (await db()`SELECT min(taken_at) AS at FROM snapshots`) as { at: Date | null }[];
	const firstAt = first[0]?.at;
	if (!firstAt) return [];
	const today = utcDate(Date.now());
	const written: string[] = [];
	let cursor = Math.max(firstAt.getTime(), Date.now() - MAX_BACKFILL_DAYS * 86_400_000);
	for (; utcDate(cursor) < today; cursor += 86_400_000) {
		const date = utcDate(cursor);
		if (await exportDay(dir, date, false, config)) written.push(date);
	}
	return written;
}
