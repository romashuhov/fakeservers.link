<script lang="ts">
	import { type Farm, type FarmDetail, type FarmSort, type FarmsResponse, fetchFarm, fetchFarms } from "../lib/api";
	import { ago, dateLong, n } from "../lib/format";
	import { t } from "../lib/i18n.svelte";
	import { route, setSearch } from "../lib/route.svelte";

	const PAGE = 50;
	const MEMBERS = 50;
	const SUBNETS = 10;
	const GAME: Record<string, string> = { cs2: "CS2", csgo: "CS:GO Legacy", css: "CS:Source", cs16: "CS 1.6", cscz: "CZ" };
	const SORTS: FarmSort[] = ["size", "ips", "subnets", "players", "newest", "oldest"];
	/** "1.2.3.4:27015", "1.2.3.4", "1.2.3" or "1.2.3.0/24" in the search box means an address search. */
	const IPISH = /^\d{1,3}(\.\d{1,3}){0,3}(\/\d{1,2})?(:\d+)?$/;

	// Filters live in the URL so a view can be shared.
	const initial = new URLSearchParams(route.search);
	let q = $state(initial.get("q") ?? initial.get("ip") ?? "");
	let game = $state(Number(initial.get("game")) || 0);
	let map = $state(initial.get("map") ?? "");
	let sort = $state<FarmSort>((initial.get("sort") as FarmSort) || "size");
	let min = $state(Number(initial.get("min")) || 3);

	let data = $state<FarmsResponse | null>(null);
	let farms = $state<Farm[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let open = $state<Record<number, FarmDetail | "loading" | undefined>>({});
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let seq = 0;

	const byIp = $derived(IPISH.test(q.trim()));

	function params(offset: number) {
		const text = q.trim();
		return {
			q: text && !byIp ? text : undefined,
			ip: text && byIp ? text : undefined,
			game: game || undefined,
			map: map || undefined,
			sort,
			min,
			offset,
			limit: PAGE,
		};
	}

	async function load(reset: boolean) {
		const mine = ++seq;
		loading = true;
		error = null;
		try {
			const res = await fetchFarms(params(reset ? 0 : farms.length));
			if (mine !== seq) return;
			data = res;
			farms = reset ? res.farms : [...farms, ...res.farms];
			if (reset) open = {};
		} catch (e) {
			if (mine === seq) error = e instanceof Error ? e.message : String(e);
		} finally {
			if (mine === seq) loading = false;
		}
	}

	function sync() {
		const p = new URLSearchParams();
		const text = q.trim();
		if (text) p.set(byIp ? "ip" : "q", text);
		if (game) p.set("game", String(game));
		if (map) p.set("map", map);
		if (sort !== "size") p.set("sort", sort);
		if (min !== 3) p.set("min", String(min));
		setSearch(p);
		void load(true);
	}

	function onQuery() {
		clearTimeout(debounce);
		debounce = setTimeout(sync, 250);
	}

	async function toggle(f: Farm) {
		if (open[f.id]) {
			const next = { ...open };
			delete next[f.id];
			open = next;
			return;
		}
		open = { ...open, [f.id]: "loading" };
		try {
			const d = await fetchFarm(f.id, { limit: MEMBERS, slimit: SUBNETS });
			open = { ...open, [f.id]: d };
		} catch {
			const next = { ...open };
			delete next[f.id];
			open = next;
		}
	}

	async function moreMembers(f: Farm) {
		const d = open[f.id];
		if (!d || d === "loading") return;
		const page = await fetchFarm(f.id, { offset: d.members.length, limit: MEMBERS, slimit: 1 });
		open = { ...open, [f.id]: { ...d, members: [...d.members, ...page.members] } };
	}

	async function moreSubnets(f: Farm) {
		const d = open[f.id];
		if (!d || d === "loading") return;
		const page = await fetchFarm(f.id, { limit: 1, soffset: d.subnets.length, slimit: SUBNETS });
		open = { ...open, [f.id]: { ...d, subnets: [...d.subnets, ...page.subnets] } };
	}

	$effect(() => {
		void load(true);
	});
</script>

<section class="section">
	<div class="section-head">
		<h2 class="h2" style="font-size:40px">{t("farms.title")}</h2>
		<p class="lead">{t("farms.lead")}</p>
	</div>

	<div class="filters">
		<input class="field mono" placeholder={t("farms.search")} bind:value={q} oninput={onQuery} spellcheck="false" />
		<label class="sel">
			<select class="field" bind:value={game} onchange={sync}>
				<option value={0}>{t("farms.allGames")}</option>
				{#each data?.games ?? [] as g (g.appId)}
					<option value={g.appId}>{GAME[g.alias] ?? g.alias} · {n(g.farms)}</option>
				{/each}
			</select>
		</label>
		<label class="sel">
			<select class="field" bind:value={map} onchange={sync}>
				<option value="">{t("farms.allMaps")}</option>
				{#if map && !(data?.maps ?? []).some((m) => m.map === map)}<option value={map}>{map}</option>{/if}
				{#each data?.maps ?? [] as m (m.map)}
					<option value={m.map}>{m.map || t("farms.noMap")} · {n(m.listings)}</option>
				{/each}
			</select>
		</label>
		<label class="sel">
			<select class="field" bind:value={sort} onchange={sync}>
				{#each SORTS as s (s)}<option value={s}>{t(`farms.sort.${s}`)}</option>{/each}
			</select>
		</label>
		<label class="sel">
			<select class="field" bind:value={min} onchange={sync}>
				{#each [3, 10, 100] as m (m)}<option value={m}>{t("farms.min", { n: m })}</option>{/each}
			</select>
		</label>
	</div>

	{#if error}
		<p class="mono" style="color:var(--red)">{error}</p>
	{:else if data}
		<p class="mono muted" style="margin:0;font-size:13px">
			{t("farms.count", { n: data.total })} · {t("farms.listings", { n: data.totalListings })}
			{#if byIp && q.trim()}· {t("farms.withIp", { ip: q.trim() })}{/if}
			{#if data.asOf}· {t("farms.asOf", { ago: ago(data.asOf) })}{/if}
		</p>
	{/if}

	<div style="display:flex;flex-direction:column;gap:10px">
		{#each farms as f, i (f.id)}
			{@const d = open[f.id]}
			<div class="card" style="padding:0;overflow:hidden">
				<button class="row" type="button" onclick={() => toggle(f)} aria-expanded={!!d}>
					<span class="mono muted rank">{i + 1}</span>
					<span class="main">
						<span class="mono name">{f.name}</span>
						<span class="mono muted meta">{f.map || t("farms.noMap")} · {GAME[f.alias] ?? f.alias} · {t("farms.meta", { max: f.maxPlayers, ips: f.ips, subnets: f.subnets, players: n(f.players), date: dateLong(f.firstSeen) })}</span>
					</span>
					<span class="copies num">{n(f.size)}</span>
					<span class="mono muted chev">{d ? "▴" : "▾"}</span>
				</button>
				{#if d === "loading"}
					<div class="detail mono muted">{t("farms.loading")}</div>
				{:else if d}
					<div class="detail">
						<div class="label" style="margin-bottom:6px">{t("farms.announcing", { n: d.subnetsTotal })}</div>
						<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:16px">
							{#each d.subnets as s (s.subnet)}
								<span class="chip mono">{s.subnet} × {n(s.count)}</span>
							{/each}
							{#if d.subnets.length < d.subnetsTotal}
								<button class="chip mono more" type="button" onclick={() => moreSubnets(f)}>
									{t("farms.more", { n: Math.min(SUBNETS, d.subnetsTotal - d.subnets.length) })}
								</button>
							{/if}
						</div>
						<div class="label" style="margin-bottom:6px">{t("farms.addresses", { n: d.membersTotal })}</div>
						<div class="members">
							<div class="label">{t("farms.col.address")}</div><div class="label" style="text-align:right">{t("farms.col.players")}</div><div class="label">{t("farms.col.token")}</div><div class="label">{t("farms.col.firstSeen")}</div>
							{#each d.members as m (m.addr)}
								<div class="mono">{m.addr}</div>
								<div class="mono" style="text-align:right">{m.players ?? "?"} / {m.maxPlayers ?? "?"}</div>
								<div class="mono muted">{m.anonymous ? t("farms.token.none") : t("farms.token.gslt")}</div>
								<div class="muted">{dateLong(m.firstSeen)}</div>
							{/each}
						</div>
						{#if d.members.length < d.membersTotal}
							<button class="pill" type="button" style="margin-top:14px" onclick={() => moreMembers(f)}>
								{t("farms.showMore", { n: Math.min(MEMBERS, d.membersTotal - d.members.length), rest: n(d.membersTotal - d.members.length) })}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if data && farms.length < data.total}
		<button class="btn" type="button" style="align-self:flex-start" disabled={loading} onclick={() => load(false)}>
			{loading ? t("home.loading") : t("farms.loadMore", { n: Math.min(PAGE, data.total - farms.length) })}
		</button>
	{:else if loading}
		<p class="mono muted">{t("home.loading")}</p>
	{:else if data && farms.length === 0}
		<p class="lead">{t("farms.nothing")}</p>
	{/if}
</section>

<style>
	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
		gap: 8px;
	}
	.field {
		width: 100%;
		min-width: 0;
		padding: 10px 12px;
		font-size: 14px;
		background: var(--paper);
		border: 2px solid var(--line);
		border-radius: 10px;
		box-shadow: var(--shadow);
		box-sizing: border-box;
	}
	.row {
		width: 100%;
		display: grid;
		grid-template-columns: 32px 1fr auto 18px;
		gap: 12px;
		align-items: center;
		padding: 14px 18px;
		background: transparent;
		border: 0;
		text-align: left;
		cursor: pointer;
	}
	.row:hover {
		background: var(--soft);
	}
	.rank {
		font-size: 12px;
	}
	.main {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.name {
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	.meta {
		font-size: 11px;
	}
	.copies {
		font-weight: 800;
		font-size: 22px;
		letter-spacing: -0.02em;
		color: var(--red);
		white-space: nowrap;
	}
	.chev {
		font-size: 12px;
		text-align: right;
	}
	.detail {
		border-top: 2px dashed var(--soft);
		padding: 16px 18px 18px;
		font-size: 13px;
	}
	.chip {
		border: 1.5px solid var(--soft);
		border-radius: 999px;
		padding: 2px 9px;
		font-size: 12px;
		background: transparent;
		color: var(--ink);
	}
	.chip.more {
		border-color: var(--line);
		cursor: pointer;
	}
	.chip.more:hover {
		background: var(--hi);
		color: #0f1a2a;
	}
	.members {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) auto auto auto;
		gap: 6px 16px;
		align-items: baseline;
	}
	@media (max-width: 520px) {
		.row {
			grid-template-columns: 1fr auto;
		}
		.rank,
		.chev {
			display: none;
		}
		.members {
			grid-template-columns: 1fr auto;
		}
		.members > :nth-child(4n + 3),
		.members > :nth-child(4n + 4) {
			display: none;
		}
	}
</style>
