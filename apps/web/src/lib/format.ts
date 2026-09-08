import { i18n, t } from "./i18n.svelte";

export function n(value: number): string {
	return new Intl.NumberFormat(i18n.locale).format(value);
}

export function pctNum(part: number, whole: number, digits = 1): string {
	if (whole <= 0) return (0).toFixed(digits);
	return ((part / whole) * 100).toFixed(digits);
}

export function pct(part: number, whole: number, digits = 1): string {
	return `${pctNum(part, whole, digits)}%`;
}

export function ago(iso: string | null): string {
	if (!iso) return t("time.never");
	const diff = Date.now() - new Date(iso).getTime();
	const min = Math.round(diff / 60_000);
	if (min < 1) return t("time.justNow");
	if (min < 60) return t("time.mAgo", { n: min });
	const h = Math.floor(min / 60);
	if (h < 48) return t("time.hAgo", { n: h });
	return t("time.dAgo", { n: Math.round(h / 24) });
}

export function inFuture(iso: string): string {
	const diff = new Date(iso).getTime() - Date.now();
	const min = Math.max(0, Math.round(diff / 60_000));
	if (min < 1) return t("time.moment");
	const h = Math.floor(min / 60);
	const m = min % 60;
	return h > 0 ? t("time.hm", { h, m }) : t("time.m", { m });
}

/** "Sep 8, 2026" in the current language */
export function dateLong(iso: string): string {
	return new Date(iso).toLocaleDateString(i18n.locale, {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

/** "Sep 8, 2026, 06:00 UTC" */
export function dateTime(iso: string): string {
	const d = new Date(iso);
	const date = d.toLocaleDateString(i18n.locale, {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mm = String(d.getUTCMinutes()).padStart(2, "0");
	return `${date}, ${hh}:${mm} UTC`;
}

export function monthShort(d: Date): string {
	return d.toLocaleDateString(i18n.locale, { month: "short", timeZone: "UTC" });
}

export function subnetOf(addr: string): string {
	const ip = addr.slice(0, addr.lastIndexOf(":"));
	return `${ip.slice(0, ip.lastIndexOf("."))}.0/24`;
}
