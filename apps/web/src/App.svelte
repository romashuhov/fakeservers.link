<script lang="ts">
	import { fetchStats, type Stats } from "./lib/api";
	import { dateTime, inFuture, n } from "./lib/format";
	import { i18n, LOCALES, type Locale, setLocale, t } from "./lib/i18n.svelte";
	import { link, route } from "./lib/route.svelte";
	import BackToTop from "./components/BackToTop.svelte";
	import Calendar from "./components/Calendar.svelte";
	import CheckServer from "./components/CheckServer.svelte";
	import DailyChart from "./components/DailyChart.svelte";
	import FarmsPage from "./components/FarmsPage.svelte";
	import GamesTable from "./components/GamesTable.svelte";
	import Headline from "./components/Headline.svelte";
	import Rules from "./components/Rules.svelte";
	import TopFarms from "./components/TopFarms.svelte";

	const REPO = "https://github.com/romashuhov/fakeservers.link";

	let stats = $state<Stats | null>(null);
	let error = $state<string | null>(null);
	let effective = $state<"light" | "dark">("light");

	function readTheme(): "light" | "dark" {
		const set = document.documentElement.getAttribute("data-theme");
		if (set === "dark" || set === "light") return set;
		return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	}

	function toggleTheme() {
		const next = effective === "dark" ? "light" : "dark";
		document.documentElement.setAttribute("data-theme", next);
		try {
			localStorage.setItem("fakeservers-theme", next);
		} catch {
			// private mode, fine
		}
		effective = next;
	}

	function pickLocale(e: Event) {
		void setLocale((e.currentTarget as HTMLSelectElement).value as Locale, true);
	}

	$effect(() => {
		effective = readTheme();
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => (effective = readTheme());
		mq.addEventListener("change", onChange);
		fetchStats()
			.then((s) => (stats = s))
			.catch((e: Error) => (error = e.message));
		return () => mq.removeEventListener("change", onChange);
	});
</script>

<BackToTop />

<div class="page">
	<header style="display:flex;flex-direction:column;gap:18px">
		<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
			<div style="display:flex;align-items:center;gap:14px">
				<div class="logo">fs</div>
				<h1 style="margin:0;font-size:30px;font-weight:800;letter-spacing:-0.03em;line-height:1">
					fakeservers<span style="color:var(--red)">.link</span>
				</h1>
			</div>
			<nav style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
				<a class="pill" class:pill-on={route.page === "home"} href="/" onclick={link}>{t("nav.stats")}</a>
				<a class="pill" class:pill-on={route.page === "farms"} href="/farms" onclick={link}>{t("nav.farms")}</a>
				<a class="pill" href={REPO} target="_blank" rel="noopener">GitHub</a>
				<a class="pill" href="https://csbro.net" target="_blank" rel="noopener" title={t("nav.csbro")}>csbro</a>
				<button class="pill pill-dark" type="button" title={t("theme.toggle")} onclick={toggleTheme}>
					{effective === "dark" ? t("theme.light") : t("theme.dark")}
				</button>
				<label class="sel sel-pill" title={t("lang.label")}>
					<select value={i18n.locale} onchange={pickLocale} aria-label={t("lang.label")}>
						{#each LOCALES as l (l.code)}
							<option value={l.code}>{l.name}</option>
						{/each}
					</select>
				</label>
			</nav>
		</div>
		<p style="margin:0;font-size:24px;font-weight:500;letter-spacing:-0.01em;line-height:1.3;text-wrap:pretty;max-width:600px">
			{t("header.tagline")}
			<span class="highlight">{t("header.tagline.hi")}</span>
		</p>
	</header>

	{#if route.page === "farms"}
		<FarmsPage />
	{:else if error}
		<div class="card" style="padding:24px 28px">
			<div class="h2" style="font-size:26px">{t("home.error")}</div>
			<p class="lead" style="margin-top:6px">{error}</p>
		</div>
	{:else if !stats}
		<p class="lead mono">{t("home.loading")}</p>
	{:else if stats.updatedAt === null}
		<div class="card" style="padding:24px 28px">
			<div class="h2" style="font-size:26px">{t("home.empty")}</div>
			<p class="lead" style="margin-top:6px">{t("home.empty.text")}</p>
		</div>
	{:else}
		<Headline {stats} />

		<section id="check" class="section" style="gap:18px">
			<div class="section-head">
				<h2 class="h2">{t("check.title")}</h2>
				<p class="lead">{t("check.lead")}</p>
			</div>
			<CheckServer samples={stats.samples} />
		</section>

		<section class="section">
			<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap">
				<h2 class="h2">{t("chart.title")}</h2>
				<div class="mono" style="display:flex;gap:14px;font-size:13px;font-weight:500">
					<span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:var(--ink)"></span>{t("chart.all")}</span>
					<span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:50%;background:var(--red)"></span>{t("chart.fake")}</span>
				</div>
			</div>
			<DailyChart daily={stats.daily} />
			<p class="lead" style="font-size:14px">{t("chart.note")}</p>
		</section>

		<section class="section">
			<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap">
				<h2 class="h2">{t("cal.title")}</h2>
				<div class="mono" style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:500">
					<span style="margin-right:4px">{t("cal.less")}</span>
					{#each [0.2, 0.4, 0.6, 0.8, 1] as op (op)}
						<span style="width:12px;height:12px;border-radius:3px;background:var(--red);opacity:{op}"></span>
					{/each}
					<span style="margin-left:4px">{t("cal.more")}</span>
				</div>
			</div>
			<Calendar daily={stats.daily} />
		</section>

		<section class="section">
			<h2 class="h2">{t("games.title")}</h2>
			<GamesTable games={stats.games} />
		</section>

		<section class="section">
			<div class="section-head">
				<h2 class="h2">{t("top.title")}</h2>
				<p class="lead">
					{t("top.lead")}
					<a href="/farms" onclick={link}>{t("top.all")}</a>
				</p>
			</div>
			<TopFarms clusters={stats.topClusters} />
		</section>

		<section id="how" class="section">
			<div class="section-head">
				<h2 class="h2">{t("how.title")}</h2>
				<p class="lead">{t("how.lead1", { n: stats.rules.length, official: n(stats.totals.official) })}</p>
				<p class="lead">
					{t("how.lead2a")}
					<a href="https://csbro.net" target="_blank" rel="noopener">csbro.net</a>
					{t("how.lead2b")}
				</p>
			</div>
			<Rules rules={stats.rules} total={stats.totals.total} repo={REPO} />
		</section>

		<footer style="display:flex;flex-direction:column;gap:14px;border-top:2px solid var(--line);padding-top:24px;font-size:15px;font-weight:500">
			<div class="mono muted" style="font-size:13px">
				{t("footer.updated", { date: dateTime(stats.updatedAt), t: inFuture(stats.nextUpdateAt) })}
			</div>
			<div style="display:flex;gap:16px;flex-wrap:wrap">
				<a href="/farms" onclick={link}>{t("nav.farms")}</a>
				<a href="#how">{t("footer.methodology")}</a>
				<a href={REPO} target="_blank" rel="noopener">{t("footer.source")}</a>
				<a href="https://github.com/ValveSoftware/csgo-osx-linux/issues/3810" target="_blank" rel="noopener">{t("footer.issue")}</a>
			</div>
			<p class="lead">
				{t("footer.csbro1")}
				<a href="https://csbro.net" target="_blank" rel="noopener">csbro.net</a>{t("footer.csbro2")}
			</p>
			<p class="lead">{t("footer.disclaimer")}</p>
			<p class="lead">{t("footer.gabe")}</p>
		</footer>
	{/if}
</div>

<style>
	.logo {
		width: 52px;
		height: 52px;
		border: 2px solid var(--line);
		border-radius: 12px;
		background: var(--hi);
		box-shadow: var(--shadow);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 20px;
		color: #0f1a2a;
		transform: rotate(-4deg);
	}
</style>
