<script lang="ts">
	import type { DailyPoint } from "../lib/api";
	import { dateLong, monthShort, n, pctNum } from "../lib/format";
	import { t } from "../lib/i18n.svelte";

	let { daily }: { daily: DailyPoint[] } = $props();

	const DAY = 86_400_000;
	const L = 44;
	const R = 712;
	const T = 12;
	const B = 216;

	const today = $derived.by(() => {
		const d = new Date();
		return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	});
	const start = $derived(today - 364 * DAY);

	type Pt = { x: number; yt: number; yf: number; d: DailyPoint };

	const yMax = $derived.by(() => {
		const max = Math.max(1, ...daily.map((p) => p.total));
		const step = 10 ** Math.floor(Math.log10(max));
		return Math.ceil(max / step) * step;
	});
	const x = (t: number) => L + ((R - L) * (t - start)) / (364 * DAY);
	const y = (v: number) => B - ((B - T) * v) / yMax;

	const pts = $derived.by(() => {
		const out: Pt[] = [];
		for (const d of daily) {
			const t = Date.parse(`${d.date}T00:00:00Z`);
			if (t < start || t > today) continue;
			out.push({ x: +x(t).toFixed(1), yt: +y(d.total).toFixed(1), yf: +y(d.dup3).toFixed(1), d });
		}
		return out;
	});
	const ticks = $derived([0, 1 / 3, 2 / 3, 1].map((f) => ({ v: Math.round(yMax * f), y: y(yMax * f) })));
	const months = $derived.by(() => {
		const out: { x: number; label: string }[] = [];
		for (let i = 7; i <= 364; i++) {
			const at = start + i * DAY;
			const dt = new Date(at);
			if (dt.getUTCDate() === 1) out.push({ x: x(at), label: monthShort(dt) });
		}
		return out;
	});
	const k = (v: number) => (v === 0 ? "0" : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

	let hover = $state<Pt | null>(null);

	function move(e: MouseEvent) {
		const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
		const vx = ((e.clientX - r.left) / r.width) * 720;
		let best: Pt | null = null;
		let bd = 12;
		for (const p of pts) {
			const dd = Math.abs(p.x - vx);
			if (dd < bd) {
				bd = dd;
				best = p;
			}
		}
		hover = best;
	}
</script>

<div class="card" style="padding:20px 20px 12px">
	<div style="position:relative">
		<svg viewBox="0 0 720 240" role="img" aria-label="Listings per day" style="width:100%;height:auto;display:block;overflow:visible;cursor:crosshair" onmousemove={move} onmouseleave={() => (hover = null)}>
			{#each ticks as t (t.v)}
				<line x1={L} x2={R} y1={t.y} y2={t.y} stroke="var(--soft)" stroke-width="1.5" stroke-dasharray="2 4" />
				<text x="38" y={t.y + 4} text-anchor="end" font-size="11" font-family="var(--mono)" fill="var(--muted)">{k(t.v)}</text>
			{/each}
			{#each months as m (m.x)}
				<text x={m.x} y="234" font-size="11" font-family="var(--mono)" fill="var(--muted)">{m.label}</text>
			{/each}
			{#each pts as p (p.d.date)}
				<circle cx={p.x} cy={p.yt} r="2.4" fill="var(--ink)" />
				<circle cx={p.x} cy={p.yf} r="2.4" fill="var(--red)" />
			{/each}
			{#if hover}
				<line x1={hover.x} x2={hover.x} y1={T} y2={B} stroke="var(--ink)" stroke-width="1" stroke-dasharray="3 3" />
				<circle cx={hover.x} cy={hover.yt} r="5" fill="var(--ink)" stroke="var(--paper)" stroke-width="2" />
				<circle cx={hover.x} cy={hover.yf} r="5" fill="var(--red)" stroke="var(--paper)" stroke-width="2" />
			{/if}
		</svg>
		{#if hover}
			<div class="tip" style="position:absolute;top:0;left:{((hover.x / 720) * 100).toFixed(2)}%;transform:translate({hover.x < 150 ? '0%' : hover.x > 570 ? '-100%' : '-50%'},-8px);z-index:2">
				<div style="font-weight:700">{dateLong(hover.d.date)}</div>
				<div>{t("chart.servers", { n: hover.d.total })}</div>
				<div><span style="color:var(--red)">{t("chart.fakeN", { n: n(hover.d.dup3) })}</span> · {pctNum(hover.d.dup3, hover.d.total)}%</div>
			</div>
		{/if}
	</div>
</div>
