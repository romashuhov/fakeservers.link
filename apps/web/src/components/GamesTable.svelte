<script lang="ts">
	import type { Stats } from "../lib/api";
	import { n, pctNum } from "../lib/format";
	import { t } from "../lib/i18n.svelte";

	let { games }: { games: Stats["games"] } = $props();

	/** Polyline over the last 26 weekly averages of the duplicate share, 90x24 box. */
	function spark(points: { date: string; share: number }[]): string {
		if (points.length < 2) return "";
		const weeks = new Map<string, { sum: number; k: number }>();
		for (const p of points) {
			const d = new Date(`${p.date}T00:00:00Z`);
			const dow = (d.getUTCDay() + 6) % 7;
			const monday = new Date(d.getTime() - dow * 86_400_000).toISOString().slice(0, 10);
			const w = weeks.get(monday) ?? { sum: 0, k: 0 };
			w.sum += p.share;
			w.k++;
			weeks.set(monday, w);
		}
		const vals = [...weeks.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.slice(-26)
			.map(([, w]) => w.sum / w.k);
		if (vals.length < 2) return "";
		return vals.map((v, i) => `${((i * 90) / (vals.length - 1)).toFixed(1)},${(22 - v * 20).toFixed(1)}`).join(" ");
	}
</script>

<div class="card" style="padding:6px 22px;display:flex;flex-direction:column">
	<div class="row head label" style="border-bottom:2px solid var(--line)">
		<span>{t("games.game")}</span><span style="text-align:right">{t("games.total")}</span><span style="text-align:right">{t("games.fake")}</span><span style="text-align:right">{t("games.share")}</span><span style="text-align:right">{t("games.26wk")}</span>
	</div>
	{#each games as g, i (g.appId)}
		<div class="row num" style="border-bottom:{i === games.length - 1 ? 'none' : '1.5px solid var(--soft)'}">
			<span style="font-weight:700;font-size:18px;letter-spacing:-0.01em;overflow-wrap:anywhere">
				{g.name}
				{#if g.truncated}<span class="mono muted" style="font-size:11px" title={t("games.partial.title")}>{t("games.partial")}</span>{/if}
			</span>
			<span class="mono" style="text-align:right">{n(g.total)}</span>
			<span class="mono" style="text-align:right;color:var(--red);font-weight:700">{n(g.dup3)}</span>
			<span style="text-align:right;font-weight:800;font-size:18px;letter-spacing:-0.02em">{pctNum(g.dup3, g.total)}%</span>
			<svg viewBox="0 0 90 24" style="width:90px;height:24px;display:block;justify-self:end" role="img" aria-label={t("games.26wk")}>
				<polyline points={spark(g.sparkline)} fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
			</svg>
		</div>
	{/each}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: minmax(110px, 1.4fr) 1fr 1fr 0.7fr 90px;
		gap: 12px;
		align-items: center;
		padding: 14px 0;
	}
	.row.head {
		padding: 12px 0 10px;
	}
	@media (max-width: 560px) {
		.row {
			grid-template-columns: minmax(80px, 1.4fr) 1fr 1fr 0.8fr;
			gap: 8px;
			font-size: 14px;
		}
		.row > :last-child {
			display: none;
		}
		.row > :first-child {
			font-size: 15px;
		}
	}
</style>
