// Tiny i18n: English is the source of truth, other languages are loaded on demand and fall back
// to English key by key. The choice lives in a cookie (a year), the first visit follows the browser.
import en, { type Dict, type Entry } from "../locales/en";

export const LOCALES = [
	{ code: "en", name: "English" },
	{ code: "ru", name: "Русский" },
	{ code: "uk", name: "Українська" },
	{ code: "pl", name: "Polski" },
	{ code: "de", name: "Deutsch" },
	{ code: "fr", name: "Français" },
	{ code: "es", name: "Español" },
	{ code: "pt", name: "Português" },
	{ code: "tr", name: "Türkçe" },
	{ code: "ro", name: "Română" },
	{ code: "cs", name: "Čeština" },
	{ code: "zh", name: "中文" },
] as const;
export type Locale = (typeof LOCALES)[number]["code"];

const COOKIE = "lang";
const loaders: Record<string, () => Promise<{ default: Dict }>> = {
	ru: () => import("../locales/ru"),
	uk: () => import("../locales/uk"),
	pl: () => import("../locales/pl"),
	de: () => import("../locales/de"),
	fr: () => import("../locales/fr"),
	es: () => import("../locales/es"),
	pt: () => import("../locales/pt"),
	tr: () => import("../locales/tr"),
	ro: () => import("../locales/ro"),
	cs: () => import("../locales/cs"),
	zh: () => import("../locales/zh"),
};
const dicts: Record<string, Dict> = { en };

export const i18n = $state({ locale: "en" as Locale, ready: true });

function isLocale(x: string | undefined | null): x is Locale {
	return !!x && LOCALES.some((l) => l.code === x);
}

function fromCookie(): Locale | null {
	const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([a-z]{2})`));
	return m && isLocale(m[1]) ? m[1] : null;
}

function fromBrowser(): Locale {
	for (const tag of navigator.languages ?? [navigator.language]) {
		const code = tag.toLowerCase().split("-")[0];
		if (isLocale(code)) return code;
	}
	return "en";
}

export async function setLocale(code: Locale, remember: boolean): Promise<void> {
	if (!dicts[code] && loaders[code]) {
		i18n.ready = false;
		dicts[code] = (await loaders[code]()).default;
	}
	i18n.locale = code;
	i18n.ready = true;
	document.documentElement.lang = code;
	if (remember) document.cookie = `${COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Cookie wins, then the browser's languages, then English. Call once at startup. */
export function initLocale(): Promise<void> {
	return setLocale(fromCookie() ?? fromBrowser(), false);
}

const rules: Record<string, Intl.PluralRules> = {};
function pluralForm(n: number): Intl.LDMLPluralRule {
	const l = i18n.locale;
	rules[l] ??= new Intl.PluralRules(l);
	return rules[l].select(n);
}

/** t("key", { n: 3 }): looks the key up in the current language, then English; picks a plural form by `n`. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
	const entry: Entry | undefined = dicts[i18n.locale]?.[key] ?? en[key];
	if (entry === undefined) return key;
	let text: string;
	if (typeof entry === "string") text = entry;
	else {
		const n = typeof vars.n === "number" ? vars.n : Number(vars.n ?? 0);
		text = entry[pluralForm(n)] ?? entry.other;
	}
	return text.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}
