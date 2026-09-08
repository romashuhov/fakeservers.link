// Pushes a daily export into the repository through the GitHub Contents API, so the history lands
// in git without git, ssh or cron on the server. Needs a fine-grained token with "Contents: write".
import type { Config } from "./config";

const API = "https://api.github.com";

async function github(config: Config, method: string, path: string, body?: unknown): Promise<Response> {
	return fetch(`${API}${path}`, {
		method,
		headers: {
			authorization: `Bearer ${config.DATA_PUSH_TOKEN}`,
			accept: "application/vnd.github+json",
			"x-github-api-version": "2022-11-28",
			"content-type": "application/json",
			"user-agent": "fakeservers-export",
		},
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(30_000),
	});
}

export function publishEnabled(config: Config): boolean {
	return config.DATA_PUSH_TOKEN !== "" && config.DATA_REPO !== "";
}

/** Creates or updates data/YYYY/MM/DD.json on the configured branch. One commit per file. */
export async function publishDay(config: Config, date: string, content: string): Promise<void> {
	const [y, m, d] = date.split("-");
	const path = `data/${y}/${m}/${d}.json`;
	const encoded = encodeURI(path);
	const branch = config.DATA_BRANCH;

	let sha: string | undefined;
	const existing = await github(
		config,
		"GET",
		`/repos/${config.DATA_REPO}/contents/${encoded}?ref=${branch}`,
	);
	if (existing.ok) sha = ((await existing.json()) as { sha?: string }).sha;
	else if (existing.status !== 404) throw new Error(`GitHub GET ${path}: ${existing.status}`);

	const res = await github(config, "PUT", `/repos/${config.DATA_REPO}/contents/${encoded}`, {
		message: `data: ${date}`,
		content: Buffer.from(content, "utf8").toString("base64"),
		branch,
		sha,
		committer: { name: "fakeservers export", email: "export@fakeservers.link" },
	});
	if (!res.ok) throw new Error(`GitHub PUT ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
}
