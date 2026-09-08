<script lang="ts">
	import type { Stats } from "../lib/api";
	import { dateLong, n } from "../lib/format";
	import { t } from "../lib/i18n.svelte";

	let { clusters }: { clusters: Stats["topClusters"] } = $props();
	const GAME: Record<string, string> = { cs2: "CS2", csgo: "CS:GO Legacy", css: "CS:Source", cs16: "CS 1.6", cscz: "CZ" };
</script>

<div class="card" style="padding:6px 22px 10px">
	{#if clusters.length === 0}
		<p class="lead" style="padding:14px 0">{t("top.empty")}</p>
	{:else}
		<table>
			<thead>
				<tr class="label" style="text-align:left">
					<th class="rank">#</th>
					<th>{t("top.cluster")}</th>
					<th style="text-align:right">{t("top.copies")}</th>
					<th class="game">{t("top.game")}</th>
					<th class="first" style="padding-right:0">{t("top.firstSeen")}</th>
				</tr>
			</thead>
			<tbody>
				{#each clusters as c, i (`${c.appId}|${c.name}|${c.map ?? ""}|${c.maxPlayers ?? ""}|${i}`)}
					<tr>
						<td class="rank mono muted">{i + 1}</td>
						<td class="mono" style="font-size:14px;overflow-wrap:anywhere">
							{c.name}<span class="muted"> · {c.map ?? "?"}</span>
							<span class="small muted">{GAME[c.alias] ?? c.alias} · {t("top.since", { date: dateLong(c.firstSeen) })}</span>
						</td>
						<td class="num" style="text-align:right;font-weight:800;font-size:18px;letter-spacing:-0.02em;color:var(--red)">{n(c.size)}</td>
						<td class="game" style="white-space:nowrap;font-weight:600">{GAME[c.alias] ?? c.alias}</td>
						<td class="first muted" style="white-space:nowrap;padding-right:0">{dateLong(c.firstSeen)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 15px;
		table-layout: fixed;
	}
	th {
		font-weight: 500;
		padding: 12px 8px 10px 0;
		border-bottom: 2px solid var(--line);
	}
	td {
		padding: 11px 8px 11px 0;
		border-bottom: 1.5px solid var(--soft);
		vertical-align: top;
	}
	tbody tr:last-child td {
		border-bottom: none;
	}
	.rank {
		width: 28px;
	}
	.game {
		width: 110px;
	}
	.first {
		width: 110px;
	}
	th:nth-child(3),
	td:nth-child(3) {
		width: 76px;
	}
	.small {
		display: none;
		font-size: 12px;
		margin-top: 2px;
	}
	@media (max-width: 600px) {
		.rank,
		.game,
		.first {
			display: none;
		}
		.small {
			display: block;
		}
	}
</style>
