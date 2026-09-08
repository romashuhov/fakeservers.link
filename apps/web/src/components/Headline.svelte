<script lang="ts">
	import type { Stats } from "../lib/api";
	import { ago, n, pctNum } from "../lib/format";
	import { t } from "../lib/i18n.svelte";

	let { stats }: { stats: Stats } = $props();
	const tot = $derived(stats.totals);
</script>

<section class="section">
	<div class="card" style="position:relative;padding:36px 32px 32px;display:flex;flex-direction:column;gap:4px;overflow:visible">
		<div class="badge">{t("headline.live", { ago: ago(stats.updatedAt) })}</div>
		<div class="mono muted" style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">{t("headline.atLeast")}</div>
		<div class="big num">{pctNum(tot.dup3, tot.total)}<span style="font-size:0.38em;letter-spacing:-0.02em;margin-left:0.06em">%</span></div>
		<div style="font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;text-wrap:pretty">{t("headline.line")}</div>
		<div class="mono muted" style="font-size:15px;margin-top:6px">{t("headline.fraction", { fake: n(tot.dup3), total: n(tot.total) })}</div>
		<div class="lead" style="font-size:14px;margin-top:10px;max-width:520px">{t("headline.floor", { n: n(tot.official) })}</div>
	</div>
	<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:12px">
		<div class="card-sm">
			<div class="stat num">{n(tot.dup100)}</div>
			<div class="stat-label">{t("stat.farm100")}</div>
		</div>
		<div class="card-sm">
			<div class="stat num">{n(tot.largestCluster)}</div>
			<div class="stat-label">{t("stat.largest", { n: tot.largestCluster })}</div>
		</div>
		<div class="card-sm">
			<div class="stat num">{n(stats.trackedDays)}</div>
			<div class="stat-label">{t("stat.days", { n: stats.trackedDays })}</div>
		</div>
	</div>

	<div class="card fix">
		<h2 class="h2" style="font-size:28px">{t("fix.title")}</h2>
		<p class="lead" style="font-size:16px">{t("fix.p1")}</p>
		<p class="lead" style="font-size:16px">{t("fix.p2")}</p>
		<p style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;text-wrap:pretty">
			<span class="highlight">{t("fix.tagline")}</span>
		</p>
	</div>
</section>

<style>
	.fix {
		padding: 26px 28px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.badge {
		position: absolute;
		top: -14px;
		left: 24px;
		background: var(--red);
		color: #fff;
		border: 2px solid var(--line);
		border-radius: 999px;
		padding: 3px 12px;
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		transform: rotate(-2deg);
	}
	.big {
		font-size: clamp(96px, 20vw, 176px);
		line-height: 0.9;
		font-weight: 800;
		letter-spacing: -0.06em;
		color: var(--red);
		font-variation-settings: "opsz" 96;
	}
	.stat {
		font-size: 40px;
		font-weight: 800;
		letter-spacing: -0.04em;
		line-height: 1;
	}
	.stat-label {
		font-size: 14px;
		color: var(--muted);
		font-weight: 500;
		text-wrap: pretty;
	}
</style>
