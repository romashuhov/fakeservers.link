<script lang="ts">
	import { type Check, checkServer, sendReport, type Stats } from "../lib/api";
	import { ago, dateLong, dateTime, n, subnetOf } from "../lib/format";
	import { t } from "../lib/i18n.svelte";
	import { link } from "../lib/route.svelte";

	let { samples }: { samples: Stats["samples"] } = $props();

	let query = $state("");
	let busy = $state(false);
	let error = $state<string | null>(null);
	let result = $state<Check | null>(null);
	let note = $state("");
	let reportState = $state<"idle" | "sending" | "sent" | "failed">("idle");

	const COLOR: Record<Check["verdict"], string> = {
		duplicate: "var(--red)",
		unique: "var(--green)",
		gone: "var(--muted)",
		not_listed: "var(--muted)",
		listed_recently: "var(--muted)",
		official: "var(--green)",
	};

	const hits = $derived(result ? result.rules.filter((r) => r.hit).length : 0);

	// Only the latest request may touch the screen: a slow earlier answer must not overwrite a newer one.
	let seq = 0;

	async function run(addr: string) {
		const mine = ++seq;
		error = null;
		result = null;
		reportState = "idle";
		note = "";
		busy = true;
		try {
			const r = await checkServer(addr);
			if (mine === seq) result = r;
		} catch (err) {
			if (mine === seq) error = err instanceof Error ? err.message : String(err);
		} finally {
			if (mine === seq) busy = false;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (q) void run(q);
	}

	function pick(addr: string) {
		query = addr;
		void run(addr);
	}

	async function report() {
		if (!result) return;
		reportState = "sending";
		try {
			await sendReport(result.addr, note.trim());
			reportState = "sent";
		} catch {
			reportState = "failed";
		}
	}
</script>

<form onsubmit={submit} style="display:flex;gap:10px;flex-wrap:wrap">
	<input class="field mono" bind:value={query} placeholder={t("check.placeholder")} spellcheck="false" autocomplete="off" required />
	<button class="btn" type="submit" disabled={busy}>{busy ? t("check.checking") : t("check.button")}</button>
</form>

<div class="mono muted" style="display:flex;gap:6px 12px;flex-wrap:wrap;font-size:13px;align-items:center">
	<span>{t("check.try")}</span>
	{#each samples as s (s.addr)}
		<button class="chip" type="button" onclick={() => pick(s.addr)}>{s.label}</button>
	{/each}
</div>

{#if error}
	<p class="mono" style="margin:0;color:var(--red);font-size:14px">{error}</p>
{/if}

{#if result}
	{@const color = COLOR[result.verdict]}
	<div class="card" style="padding:28px 28px 24px;display:flex;flex-direction:column;gap:28px">
		<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">
			<div class="mono muted" style="font-size:13px">
				{result.addr}
				{#if result.snapshotAt}· {t("check.snapshot", { ago: ago(result.snapshotAt) })}{/if}
			</div>
			<div class="verdict" style="color:{color};border-color:{color}">{t(`verdict.${result.verdict}`)}</div>
			{#if result.verdict === "duplicate" && result.listing?.name}
				<a class="mono" style="font-size:13px" href={`/farms?q=${encodeURIComponent(result.listing.name)}`} onclick={link}>{t("check.seeFarm", { n: n(result.listing.clusterSize) })}</a>
			{/if}
			<div style="font-size:16px;font-weight:500;text-wrap:pretty;max-width:520px">
				{#if result.verdict === "gone" && result.listing}
					{t("check.gone", { ago: ago(result.listing.lastSeen), date: dateTime(result.listing.lastSeen), first: dateLong(result.listing.firstSeen) })}
				{:else if result.listing && result.verdict !== "official"}
					{t("check.hits", { hits, total: result.rules.length })}
				{/if}
				{t(`verdict.${result.verdict}.note`)}
			</div>
		</div>

		{#if result.listing && result.verdict !== "official"}
			<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px">
				{#each result.rules as r (r.id)}
					<li class="rule" class:hit={r.hit}>
						<span class="box">{r.hit ? "✓" : ""}</span>
						<span style="display:flex;flex-direction:column;gap:1px">
							<span style="font-size:16px;font-weight:{r.hit ? 700 : 500}">{t(`rule.${r.id}`)}</span>
							{#if r.hit}
								<span class="mono muted" style="font-size:14px">{t(`rule.${r.id}.detail`, { n: n(r.value ?? 0) })}</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if result.listing}
			<div class="details">
				<div style="grid-column:1 / -1;display:flex;flex-direction:column;gap:2px">
					<div class="label">{t("field.name")}</div>
					<div style="font-size:18px;font-weight:700;overflow-wrap:anywhere">{result.listing.name ?? "—"}</div>
				</div>
				<div><div class="label">{t("field.map")}</div><div class="mono">{result.listing.map ?? "—"}</div></div>
				<div><div class="label">{t("field.players")}</div><div class="mono">{result.listing.players ?? "?"} / {result.listing.maxPlayers ?? "?"}</div></div>
				<div><div class="label">{t("field.game")}</div><div style="font-weight:600">{result.listing.alias}</div></div>
				<div><div class="label">{t("field.subnet")}</div><div class="mono">{subnetOf(result.addr)}</div></div>
				<div><div class="label">{t("field.copies")}</div><div class="mono">{n(result.listing.clusterSize)}</div></div>
				<div><div class="label">{t("field.onIp")}</div><div class="mono">{n(result.listing.onSameIp)} / {n(result.listing.onSameSubnet)}</div></div>
				<div><div class="label">{t("field.firstSeen")}</div><div style="font-weight:600">{dateLong(result.listing.firstSeen)}</div></div>
				<div><div class="label">{t("field.lastSeen")}</div><div style="font-weight:600">{ago(result.listing.lastSeen)}</div></div>
			</div>
		{/if}

		<div style="border-top:2px dashed var(--soft);padding-top:18px">
			{#if reportState === "sent"}
				<p class="lead" style="font-size:14px">{t("report.thanks")}</p>
			{:else}
				<p class="lead" style="font-size:14px">{t("report.prompt")}</p>
				<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
					<input class="field" style="padding:10px 12px;font-size:14px" placeholder={t("report.placeholder")} maxlength="500" bind:value={note} />
					<button class="pill" type="button" onclick={report} disabled={reportState === "sending"}>{t("report.button")}</button>
				</div>
				{#if reportState === "failed"}
					<p class="mono" style="margin:8px 0 0;color:var(--red);font-size:13px">{t("report.failed")}</p>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.field {
		flex: 1 1 260px;
		min-width: 0;
		padding: 14px 16px;
		font-size: 16px;
		background: var(--paper);
		border: 2px solid var(--line);
		border-radius: 12px;
		box-shadow: var(--shadow);
	}
	.chip {
		background: var(--paper);
		border: 1.5px solid var(--soft);
		border-radius: 999px;
		padding: 3px 10px;
		cursor: pointer;
		color: var(--ink);
		font-family: var(--mono);
		font-size: 12px;
	}
	.chip:hover {
		border-color: var(--line);
		background: var(--hi);
		color: #0f1a2a;
	}
	.verdict {
		display: inline-block;
		font-size: clamp(40px, 8vw, 64px);
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1;
		text-transform: uppercase;
		border: 3px solid;
		border-radius: 10px;
		padding: 8px 18px 10px;
		transform: rotate(-2deg);
		transform-origin: left center;
		margin: 6px 0 4px 2px;
	}
	.rule {
		display: grid;
		grid-template-columns: 22px 1fr;
		gap: 12px;
		align-items: start;
		color: var(--muted);
	}
	.rule.hit {
		color: var(--ink);
	}
	.box {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		border-radius: 5px;
		border: 2px solid var(--soft);
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 800;
		color: #fff;
		line-height: 1;
		box-sizing: border-box;
	}
	.rule.hit .box {
		border-color: var(--red);
		background: var(--red);
	}
	.details {
		border-top: 2px dashed var(--soft);
		padding-top: 20px;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
		gap: 14px 24px;
		font-size: 14px;
	}
	.details > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
</style>
