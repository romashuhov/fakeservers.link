<script lang="ts">
	import type { Stats } from "../lib/api";
	import { n, pctNum } from "../lib/format";
	import { t } from "../lib/i18n.svelte";

	let { rules, total, repo }: { rules: Stats["rules"]; total: number; repo: string } = $props();
	const source = $derived(`${repo}/blob/main/apps/api/src/stats.ts`);
</script>

<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:14px">
	{#each rules as r (r.id)}
		<div class="card-sm" style="gap:8px">
			<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
				<div style="font-weight:800;font-size:19px;letter-spacing:-0.02em">
					{t(`rule.${r.id}`)}
					{#if r.id === "identical"}<span class="decides">{t("rules.decides")}</span>{/if}
				</div>
				<div class="num" style="font-weight:800;font-size:19px;letter-spacing:-0.02em;color:var(--red);white-space:nowrap">{pctNum(r.count, total)}%</div>
			</div>
			<div class="lead" style="font-size:15px">{t(`rule.${r.id}.desc`)}</div>
			<div class="mono muted" style="font-size:12px;margin-top:auto">
				{t("rules.listings", { n: n(r.count) })} ·
				<a href={source} target="_blank" rel="noopener">stats.ts · {r.id} →</a>
			</div>
		</div>
	{/each}
</div>

<style>
	.decides {
		display: inline-block;
		vertical-align: middle;
		margin-left: 6px;
		background: var(--red);
		color: #fff;
		border: 2px solid var(--line);
		border-radius: 999px;
		padding: 1px 8px;
		font-family: var(--mono);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transform: rotate(-2deg);
	}
</style>
