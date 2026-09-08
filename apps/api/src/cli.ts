// CLI: migrate up|status|verify|repair-checksums, collect, export [YYYY-MM-DD]
import { collectAll } from "./collector";
import { loadConfig } from "./config";
import { closeDb } from "./db";
import { dataDir, exportCompletedDays, exportDay } from "./export";
import { migrateRepairChecksums, migrateStatus, migrateUp, migrateVerify } from "./migrate";

const [cmd, sub] = process.argv.slice(2);

async function main(): Promise<number> {
	switch (cmd) {
		case "migrate": {
			switch (sub ?? "up") {
				case "up":
					await migrateUp();
					return 0;
				case "status":
					await migrateStatus();
					return 0;
				case "verify":
					return (await migrateVerify()) ? 0 : 1;
				case "repair-checksums":
					await migrateRepairChecksums();
					return 0;
				default:
					console.error(`unknown migrate command: ${sub}`);
					return 2;
			}
		}
		case "collect": {
			const config = loadConfig();
			const res = await collectAll(config);
			return res.length > 0 ? 0 : 1;
		}
		case "export": {
			const config = loadConfig();
			const dir = dataDir(config.DATA_DIR);
			if (sub) {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(sub)) {
					console.error("export takes a date as YYYY-MM-DD");
					return 2;
				}
				const ok = await exportDay(dir, sub, true, config);
				console.log(ok ? `wrote ${sub}` : `no snapshots on ${sub}`);
				return ok ? 0 : 1;
			}
			const written = await exportCompletedDays(dir, config);
			console.log(written.length > 0 ? `wrote ${written.join(", ")}` : "nothing new to export");
			return 0;
		}
		default:
			console.error(
				"usage: cli.ts migrate [up|status|verify|repair-checksums] | collect | export [YYYY-MM-DD]",
			);
			return 2;
	}
}

main()
	.then(async (code) => {
		await closeDb();
		process.exit(code);
	})
	.catch(async (e) => {
		console.error(e instanceof Error ? e.message : e);
		await closeDb();
		process.exit(1);
	});
