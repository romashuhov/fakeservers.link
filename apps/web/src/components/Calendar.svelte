<script lang="ts">
	import type { DailyPoint } from "../lib/api";
	import { dateLong, monthShort, n, pctNum } from "../lib/format";
	import { t } from "../lib/i18n.svelte";

	let { daily }: { daily: DailyPoint[] } = $props();

	const DAY = 86_400_000;
	// 52 weeks at step 12 fit the 760px page with the card padding; step 13 needed a scrollbar.
	const CELL = 10;
	const GAP = 2;
	const STEP = CELL + GAP;
	const LABELS = 30 + 4; // weekday column plus grid gap
	const MAX_WEEKS = 52;
	const MIN_WEEKS = 8;

	type Cell = { t: number; point: DailyPoint | undefined; future: boolean; opacity: number };

	// The grid never scrolls: as many whole weeks as the card is wide, fewer on phones.
	let width = $state(0);
	const weeks = $derived(
		width > 0 ? Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, Math.floor((width - LABELS + GAP) / STEP))) : MAX_WEEKS,
	);

	const byDate = $derived(new Map(daily.map((d) => [d.date, d])));
	const firstDate = $derived(daily.length > 0 ? Date.parse(`${daily[0].date}T00:00:00Z`) : Number.POSITIVE_INFINITY);

	const grid = $derived.by(() => {
		const now = new Date();
		const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
		const dow = (new Date(today).getUTCDay() + 6) % 7; // Monday = 0
		const lastMonday = today - dow * DAY;
		const firstMonday = lastMonday - (weeks - 1) * 7 * DAY;
		const cols: Cell[][] = [];
		const months: { left: number; label: string }[] = [];
		let lastMonth = -1;
		for (let w = 0; w < weeks; w++) {
			const col: Cell[] = [];
			for (let d = 0; d < 7; d++) {
				const t = firstMonday + (w * 7 + d) * DAY;
				const dt = new Date(t);
				if (d === 0) {
					const m = dt.getUTCMonth();
					if (m !== lastMonth) {
						if (dt.getUTCDate() <= 7 && w > 0) {
							months.push({ left: w * STEP, label: monthShort(dt) });
						}
						lastMonth = m;
					}
				}
				const point = byDate.get(dt.toISOString().slice(0, 10));
				const share = point && point.total > 0 ? point.dup3 / point.total : 0;
				const opacity = share < 0.2 ? 0.2 : share < 0.4 ? 0.4 : share < 0.6 ? 0.6 : share < 0.8 ? 0.8 : 1;
				col.push({ t, point, future: t > today, opacity });
			}
			cols.push(col);
		}
		return { cols, months };
	});

	let hover = $state<{ cell: Cell; x: number; y: number } | null>(null);

	function enter(e: MouseEvent, cell: Cell) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		hover = { cell, x: r.left + r.width / 2, y: r.top };
	}
</script>

<div class="card" style="padding:20px">
	<div bind:clientWidth={width}>
		<div style="position:relative;display:grid;grid-template-columns:30px 1fr;gap:0 4px;width:max-content;max-width:100%;padding-top:18px" onmouseleave={() => (hover = null)} role="presentation">
			<div class="mono muted" style="position:absolute;left:34px;top:0;height:14px;font-size:11px;font-weight:500">
				{#each grid.months as m (m.left)}
					<span style="position:absolute;left:{m.left}px;top:0;white-space:nowrap">{m.label}</span>
				{/each}
			</div>
			<div class="mono muted" style="display:flex;flex-direction:column;gap:{GAP}px;font-size:10px;line-height:{CELL}px">
				<span style="height:{CELL}px">{t("cal.mon")}</span><span style="height:{CELL}px"></span><span style="height:{CELL}px">{t("cal.wed")}</span><span style="height:{CELL}px"></span><span style="height:{CELL}px">{t("cal.fri")}</span><span style="height:{CELL}px"></span><span style="height:{CELL}px"></span>
			</div>
			<div style="display:flex;gap:{GAP}px">
				{#each grid.cols as col, w (w)}
					<div style="display:flex;flex-direction:column;gap:{GAP}px">
						{#each col as cell (cell.t)}
							<div
								class="cell"
								class:on={hover?.cell === cell && !!cell.point}
								style="opacity:{cell.point ? cell.opacity : 1};background:{cell.future ? 'transparent' : cell.point ? 'var(--red)' : 'var(--soft)'}"
								onmouseenter={(e) => enter(e, cell)}
								role="presentation"
							></div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
	{#if weeks < MAX_WEEKS}
		<p class="mono muted" style="margin:14px 0 0;font-size:11px">{t("cal.weeks", { n: weeks })}</p>
	{/if}
</div>

{#if hover}
	{@const c = hover.cell}
	<div class="tip" style="position:fixed;left:{hover.x}px;top:{hover.y - 6}px;transform:translate(-50%,-100%);z-index:50;line-height:1.4;padding:6px 10px">
		<div style="font-weight:700">{dateLong(new Date(c.t).toISOString())}</div>
		<div>
			{#if c.point}
				{t("cal.line", { total: n(c.point.total), fake: n(c.point.dup3), pct: pctNum(c.point.dup3, c.point.total) })}
			{:else if c.future}
				{t("cal.notYet")}
			{:else if c.t < firstDate}
				{t("cal.before")}
			{:else}
				{t("cal.noData")}
			{/if}
		</div>
	</div>
{/if}

<style>
	.cell {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		outline: none;
		outline-offset: 1px;
	}
	.cell.on {
		outline: 2px solid var(--ink);
	}
</style>
