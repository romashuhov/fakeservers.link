export type DailyPoint = { date: string; total: number; dup3: number; dup10: number; anonymous: number };

export type Stats = {
	updatedAt: string | null;
	nextUpdateAt: string;
	intervalMin: number;
	trackedDays: number;
	totals: {
		total: number;
		official: number;
		dup3: number;
		dup5: number;
		dup10: number;
		dup100: number;
		anonymous: number;
		largestCluster: number;
		largestClusterName: string | null;
		maxPerIp: number;
		maxPerSubnet: number;
	};
	games: {
		appId: number;
		alias: string;
		name: string;
		updatedAt: string;
		total: number;
		official: number;
		dup3: number;
		dup10: number;
		anonymous: number;
		largestCluster: number;
		truncated: boolean;
		sparkline: { date: string; share: number }[];
	}[];
	daily: DailyPoint[];
	topClusters: {
		appId: number;
		alias: string;
		name: string;
		map: string | null;
		maxPlayers: number | null;
		size: number;
		ips: number;
		subnets: number;
		firstSeen: string;
	}[];
	rules: { id: string; label: string; description: string; count: number }[];
	samples: { label: string; addr: string }[];
};

export type CheckVerdict = "duplicate" | "unique" | "gone" | "not_listed" | "listed_recently" | "official";

export type Check = {
	addr: string;
	verdict: CheckVerdict;
	snapshotAt: string | null;
	listing: {
		appId: number;
		alias: string;
		name: string | null;
		map: string | null;
		players: number | null;
		maxPlayers: number | null;
		anonymous: boolean;
		official: boolean;
		clusterSize: number;
		firstSeen: string;
		lastSeen: string;
		onSameIp: number;
		onSameSubnet: number;
	} | null;
	rules: {
		id: string;
		label: string;
		description: string;
		hit: boolean;
		detail: string | null;
		value: number | null;
	}[];
};

async function json<T>(res: Response): Promise<T> {
	const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
	if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
	if (!body) throw new Error("empty response");
	return body;
}

export function fetchStats(): Promise<Stats> {
	return fetch("/api/stats").then((r) => json<Stats>(r));
}

export function checkServer(addr: string): Promise<Check> {
	return fetch(`/api/check?addr=${encodeURIComponent(addr)}`).then((r) => json<Check>(r));
}

export function sendReport(addr: string, note: string): Promise<{ ok: true }> {
	return fetch("/api/report", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ addr, note: note || undefined }),
	}).then((r) => json<{ ok: true }>(r));
}

export type Farm = {
	id: number;
	appId: number;
	alias: string;
	name: string;
	map: string;
	maxPlayers: number;
	size: number;
	ips: number;
	subnets: number;
	players: number;
	firstSeen: string;
	lastSeen: string;
};

export type FarmsResponse = {
	asOf: string | null;
	total: number;
	totalListings: number;
	farms: Farm[];
	maps: { map: string; farms: number; listings: number }[];
	games: { appId: number; alias: string; farms: number }[];
};

export type FarmSort = "size" | "ips" | "subnets" | "players" | "newest" | "oldest";

export type FarmsParams = {
	game?: number;
	map?: string;
	q?: string;
	ip?: string;
	sort?: FarmSort;
	min?: number;
	offset?: number;
	limit?: number;
};

export type FarmMember = {
	addr: string;
	players: number | null;
	maxPlayers: number | null;
	anonymous: boolean;
	firstSeen: string;
	lastSeen: string;
};

export type FarmDetail = {
	farm: Farm;
	members: FarmMember[];
	membersTotal: number;
	subnets: { subnet: string; count: number }[];
	subnetsTotal: number;
};

export function fetchFarms(p: FarmsParams): Promise<FarmsResponse> {
	const qs = new URLSearchParams();
	if (p.game) qs.set("game", String(p.game));
	if (p.map) qs.set("map", p.map);
	if (p.q) qs.set("q", p.q);
	if (p.ip) qs.set("ip", p.ip);
	if (p.sort) qs.set("sort", p.sort);
	if (p.min) qs.set("min", String(p.min));
	if (p.offset) qs.set("offset", String(p.offset));
	if (p.limit) qs.set("limit", String(p.limit));
	return fetch(`/api/farms?${qs}`).then((r) => json<FarmsResponse>(r));
}

export function fetchFarm(
	id: number,
	page: { offset?: number; limit?: number; soffset?: number; slimit?: number } = {},
): Promise<FarmDetail> {
	const qs = new URLSearchParams();
	for (const [k, v] of Object.entries(page)) if (v !== undefined) qs.set(k, String(v));
	return fetch(`/api/farms/${id}?${qs}`).then((r) => json<FarmDetail>(r));
}
