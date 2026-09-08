import { SQL } from "bun";

let instance: SQL | undefined;

export function db(): SQL {
	if (!instance) {
		const url = process.env.DATABASE_URL;
		if (!url) throw new Error("DATABASE_URL is not set");
		instance = new SQL(url, { max: 8 });
	}
	return instance;
}

export async function closeDb(): Promise<void> {
	if (instance) {
		await instance.close();
		instance = undefined;
	}
}
