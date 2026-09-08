// Forward-only SQL migrator: files in migrations/ applied in name order inside a transaction,
// registry in _migrations with a checksum, advisory lock so two instances never race.
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SQL } from "bun";
import { db } from "./db";

const MIGRATIONS_DIR = resolve(import.meta.dir, "../../../migrations");
const LOCK_KEY = 7241002; // arbitrary, unique to this project

type Applied = { name: string; checksum: string; applied_at: Date };
type MigrationFile = { name: string; text: string; checksum: string };

function checksum(text: string): string {
	return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

async function listFiles(): Promise<MigrationFile[]> {
	const names = (await readdir(MIGRATIONS_DIR)).filter((n) => n.endsWith(".sql")).sort();
	const out: MigrationFile[] = [];
	for (const name of names) {
		const text = await readFile(resolve(MIGRATIONS_DIR, name), "utf8");
		out.push({ name, text, checksum: checksum(text) });
	}
	return out;
}

async function ensureRegistry(sql: SQL): Promise<void> {
	await sql`CREATE TABLE IF NOT EXISTS _migrations (
		name text PRIMARY KEY,
		checksum text NOT NULL,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`;
}

async function withLock<T>(fn: (sql: SQL) => Promise<T>): Promise<T> {
	const reserved = await db().reserve();
	const sql = reserved as unknown as SQL;
	try {
		await sql`SELECT pg_advisory_lock(${LOCK_KEY})`;
		try {
			return await fn(sql);
		} finally {
			await sql`SELECT pg_advisory_unlock(${LOCK_KEY})`;
		}
	} finally {
		reserved.release();
	}
}

async function applied(sql: SQL): Promise<Map<string, Applied>> {
	const rows = (await sql`SELECT name, checksum, applied_at FROM _migrations ORDER BY name`) as Applied[];
	return new Map(rows.map((r) => [r.name, r]));
}

export async function migrateUp(): Promise<number> {
	return withLock(async (sql) => {
		await ensureRegistry(sql);
		const done = await applied(sql);
		const files = await listFiles();
		let count = 0;
		for (const f of files) {
			const prev = done.get(f.name);
			if (prev) {
				if (prev.checksum !== f.checksum) {
					throw new Error(
						`${f.name} changed after it was applied (checksum mismatch). Run "migrate repair-checksums" if that was intended.`,
					);
				}
				continue;
			}
			await sql.begin(async (tx) => {
				await tx.unsafe(f.text);
				await tx`INSERT INTO _migrations (name, checksum) VALUES (${f.name}, ${f.checksum})`;
			});
			console.log(`applied ${f.name}`);
			count++;
		}
		if (count === 0) console.log("nothing to apply");
		return count;
	});
}

export async function migrateStatus(): Promise<void> {
	await withLock(async (sql) => {
		await ensureRegistry(sql);
		const done = await applied(sql);
		for (const f of await listFiles()) {
			const prev = done.get(f.name);
			const state = !prev ? "pending" : prev.checksum === f.checksum ? "applied" : "CHANGED";
			const when = prev ? `  ${new Date(prev.applied_at).toISOString()}` : "";
			console.log(`${state.padEnd(8)} ${f.name}${when}`);
		}
	});
}

export async function migrateVerify(): Promise<boolean> {
	return withLock(async (sql) => {
		await ensureRegistry(sql);
		const done = await applied(sql);
		const files = await listFiles();
		let ok = true;
		for (const f of files) {
			const prev = done.get(f.name);
			if (!prev) {
				console.log(`pending  ${f.name}`);
				ok = false;
			} else if (prev.checksum !== f.checksum) {
				console.log(`CHANGED  ${f.name}`);
				ok = false;
			}
		}
		const names = new Set(files.map((f) => f.name));
		for (const name of done.keys()) {
			if (!names.has(name)) {
				console.log(`MISSING  ${name} (applied, file no longer exists)`);
				ok = false;
			}
		}
		console.log(ok ? "verify: ok" : "verify: problems found");
		return ok;
	});
}

export async function migrateRepairChecksums(): Promise<void> {
	await withLock(async (sql) => {
		await ensureRegistry(sql);
		const done = await applied(sql);
		for (const f of await listFiles()) {
			const prev = done.get(f.name);
			if (prev && prev.checksum !== f.checksum) {
				await sql`UPDATE _migrations SET checksum = ${f.checksum} WHERE name = ${f.name}`;
				console.log(`repaired ${f.name}`);
			}
		}
	});
}
