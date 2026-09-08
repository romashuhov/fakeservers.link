// Link preview image (Open Graph, 1200x630) with the live headline figure, rendered from SVG to PNG
// with resvg. Fonts are bundled in apps/api/fonts (OFL). Re-rendered only when the stats change.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { StatsResponse } from "./stats";

const FONTS_DIR = resolve(import.meta.dir, "../fonts");
const FONT_FILES = [
	"BricolageGrotesque-ExtraBold.ttf",
	"BricolageGrotesque-Medium.ttf",
	"JetBrainsMono-Bold.ttf",
	"JetBrainsMono-Medium.ttf",
];

// Sky palette, light theme, same values as apps/web/src/app.css.
const BG = "#d8ecff";
const PAPER = "#f3f9ff";
const INK = "#0f1a2a";
const MUTED = "#4f6480";
const RED = "#ff4d2e";
const HI = "#8fd0ff";

let ready: Promise<Uint8Array[]> | null = null;
let cached: { key: string; png: Uint8Array } | null = null;

async function fonts(): Promise<Uint8Array[]> {
	if (!ready) {
		ready = (async () => {
			const wasm = resolve(dirname(Bun.resolveSync("@resvg/resvg-wasm", import.meta.dir)), "index_bg.wasm");
			await initWasm(await readFile(wasm));
			return Promise.all(FONT_FILES.map(async (f) => new Uint8Array(await readFile(resolve(FONTS_DIR, f)))));
		})();
	}
	return ready;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (v: number) => new Intl.NumberFormat("en-US").format(v);

export function headline(stats: StatsResponse): {
	pct: string;
	fake: string;
	total: string;
	updated: string;
} {
	const t = stats.totals;
	const pct = t.total > 0 ? ((t.dup3 / t.total) * 100).toFixed(1) : "0.0";
	const d = stats.updatedAt ? new Date(stats.updatedAt) : null;
	const updated = d
		? `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`
		: "not yet";
	return { pct, fake: num(t.dup3), total: num(t.total), updated };
}

function svg(stats: StatsResponse): string {
	const h = headline(stats);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
	<rect width="1200" height="630" fill="${BG}"/>
	<!-- card with the hard ink shadow -->
	<rect x="72" y="72" width="1056" height="486" rx="28" fill="${INK}"/>
	<rect x="60" y="60" width="1056" height="486" rx="28" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>
	<!-- badge -->
	<g transform="translate(96 42) rotate(-2)">
		<rect x="0" y="0" width="150" height="40" rx="20" fill="${RED}" stroke="${INK}" stroke-width="4"/>
		<text x="75" y="27" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="17" letter-spacing="1.6" fill="#ffffff">AT LEAST</text>
	</g>
	<!-- the number -->
	<text x="100" y="330" font-family="Bricolage Grotesque" font-weight="800" font-size="250" letter-spacing="-16" fill="${RED}">${esc(h.pct)}<tspan font-size="96" dx="10" letter-spacing="-2">%</tspan></text>
	<text x="104" y="410" font-family="Bricolage Grotesque" font-weight="500" font-size="42" letter-spacing="-1" fill="${INK}">of Counter-Strike servers in the Steam browser</text>
	<text x="104" y="462" font-family="Bricolage Grotesque" font-weight="500" font-size="42" letter-spacing="-1" fill="${INK}">are fake or mirrors</text>
	<text x="104" y="512" font-family="JetBrains Mono" font-weight="500" font-size="22" fill="${MUTED}">${esc(h.fake)} fake / ${esc(h.total)} total · updated ${esc(h.updated)}</text>
	<!-- logo -->
	<g transform="translate(980 96) rotate(-4)">
		<rect x="6" y="6" width="72" height="72" rx="16" fill="${INK}"/>
		<rect x="0" y="0" width="72" height="72" rx="16" fill="${HI}" stroke="${INK}" stroke-width="4"/>
		<text x="36" y="47" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="30" fill="${INK}">fs</text>
	</g>
	<text x="1116" y="596" text-anchor="end" font-family="JetBrains Mono" font-weight="700" font-size="26" fill="${INK}">fakeservers<tspan fill="${RED}">.link</tspan></text>
</svg>`;
}

/** PNG for the current stats; rendered once per stats update. */
export async function ogImage(stats: StatsResponse): Promise<Uint8Array> {
	const key = stats.updatedAt ?? "none";
	if (cached?.key === key) return cached.png;
	const fontBuffers = await fonts();
	const r = new Resvg(svg(stats), {
		fitTo: { mode: "width", value: 1200 },
		font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: "Bricolage Grotesque" },
	});
	const png = r.render().asPng();
	cached = { key, png };
	return png;
}
