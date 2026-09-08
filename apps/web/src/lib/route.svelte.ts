// Two pages, one bundle: the API and Vite both fall back to index.html for any path.
export type Page = "home" | "farms";

function pageOf(pathname: string): Page {
	return pathname.replace(/\/+$/, "") === "/farms" ? "farms" : "home";
}

export const route = $state({ page: pageOf(location.pathname), search: location.search });

export function go(path: string): void {
	history.pushState(null, "", path);
	route.page = pageOf(location.pathname);
	route.search = location.search;
	window.scrollTo({ top: 0 });
}

/** Rewrites the query string in place (filters on the farms page) without a history entry. */
export function setSearch(params: URLSearchParams): void {
	const qs = params.toString();
	history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
	route.search = location.search;
}

window.addEventListener("popstate", () => {
	route.page = pageOf(location.pathname);
	route.search = location.search;
});

/** Click handler for in-app links: same-origin, no modifier keys, left button. */
export function link(e: MouseEvent): void {
	if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
	const a = (e.currentTarget as HTMLAnchorElement | null) ?? null;
	if (!a || a.target === "_blank") return;
	e.preventDefault();
	go(a.getAttribute("href") ?? "/");
}
