// Runs a command with variables from the repo-root .env (UTF-8) applied to its environment.
// Needed because `bun --cwd apps/x` changes the working directory before Bun's own .env loading.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const envPath = resolve(root, ".env");
const extra: Record<string, string> = {};
try {
	for (const raw of readFileSync(envPath, "utf8").split("\n")) {
		const line = raw.replace(/\r$/, "").trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) extra[key] = value;
	}
} catch {
	console.error(`with-env-run: no .env at ${envPath}, running with the current environment only`);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
	console.error("usage: bun scripts/with-env-run.ts <command> [args...]");
	process.exit(2);
}
const child = spawn(cmd, args, {
	cwd: root,
	stdio: "inherit",
	shell: process.platform === "win32",
	env: { ...process.env, ...extra, LANG: process.env.LANG ?? "C.UTF-8" },
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
