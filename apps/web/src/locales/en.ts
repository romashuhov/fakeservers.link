// Source of truth for every string on the site. Other locales fall back to these key by key.
// A plural entry is an object keyed by Intl.PluralRules categories; `other` is required.
export type Plural = {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other: string;
};
export type Entry = string | Plural;
export type Dict = Record<string, Entry>;

const en: Dict = {
	// header
	"nav.stats": "Stats",
	"nav.farms": "Farms",
	"nav.csbro": "A server browser with the fakes filtered out",
	"theme.light": "Light",
	"theme.dark": "Dark",
	"theme.toggle": "Toggle theme",
	"lang.label": "Language",
	"header.tagline": "We count the fake and mirror servers in the Counter-Strike server browser,",
	"header.tagline.hi": "so Valve doesn't have to.",

	// home states
	"home.loading": "Counting…",
	"home.error": "Numbers are unavailable",
	"home.empty": "Nothing counted yet",
	"home.empty.text": "The first snapshot lands after the collector's first run.",

	// headline
	"headline.atLeast": "At least",
	"headline.line": "of servers in the list are fake or mirrors",
	"headline.fraction": "{fake} fake / {total} total",
	"headline.floor":
		"This is the minimum. Only provable copies count, and Valve's own {n} servers are excluded from both sides. The real share is higher.",
	"headline.live": "Live · {ago}",
	"stat.farm100": "in farms of 100+ identical copies",
	"stat.largest": { one: "copy in the largest farm", other: "copies in the largest farm" },
	"stat.days": { one: "day of counting", other: "days of counting" },

	// checker
	"check.title": "Check a server",
	"check.lead": "Paste an address from the browser. We'll tell you which side of the list it's on.",
	"check.placeholder": "IP:port, e.g. 185.234.72.19:27015",
	"check.button": "Check",
	"check.checking": "Checking…",
	"check.try": "Try:",
	"check.snapshot": "snapshot {ago}",
	"check.gone": "Last seen in the list {ago}, on {date}; first seen {first}.",
	"check.hits": "{hits} of {total} rules hit; only the first one decides.",
	"check.seeFarm": "See this farm and its {n} addresses →",
	"verdict.duplicate": "Fake",
	"verdict.duplicate.note": "This address shares its name, map and player limit with many others.",
	"verdict.unique": "Looks real",
	"verdict.unique.note": "Clone army did not trigger. The other rules are context only.",
	"verdict.gone": "Gone",
	"verdict.gone.note": "Not in the latest snapshot. Farms go quiet too, so we keep the record.",
	"verdict.not_listed": "Not in list",
	"verdict.not_listed.note": "Never seen in the Steam list. Either brand new, or it never existed.",
	"verdict.listed_recently": "Too new",
	"verdict.listed_recently.note":
		"Steam lists it now, but it appeared after our last snapshot. Check back in an hour.",
	"verdict.official": "Valve official",
	"verdict.official.note": "One of Valve's own servers. Not a community server, so it counts nowhere.",
	"field.name": "Name",
	"field.map": "Map",
	"field.players": "Players",
	"field.game": "Game",
	"field.subnet": "Subnet",
	"field.copies": "Identical copies",
	"field.onIp": "On this IP / subnet",
	"field.firstSeen": "First seen",
	"field.lastSeen": "Last seen",
	"report.prompt": "Wrong side of the page? Tell us why.",
	"report.placeholder": "optional note, up to 500 characters",
	"report.button": "Report",
	"report.thanks": "Thanks. The report is in; a human will look.",
	"report.failed": "Could not send the report. Try again later.",

	// rules (labels and one-line details live here so they translate; ids come from the API)
	"rule.identical": "Clone army",
	"rule.identical.desc": "Same name, map and player limit on three or more addresses.",
	"rule.identical.detail": "{n} addresses share this name, map and max players",
	"rule.farm": "Farm-sized",
	"rule.farm.desc": "Part of a cluster of 100 or more identical listings.",
	"rule.farm.detail": "cluster of {n} identical listings",
	"rule.anonymous": "No token",
	"rule.anonymous.desc": "No game server token. Normal for GoldSrc games, a shortcut elsewhere.",
	"rule.anonymous.detail": "no game server login token",
	"rule.dense-ip": "IP stack",
	"rule.dense-ip.desc": "Ten or more listings on one IP address.",
	"rule.dense-ip.detail": "{n} listings on this IP",
	"rule.dense-subnet": "Subnet stack",
	"rule.dense-subnet.desc": "Fifty or more listings in one /24 subnet.",
	"rule.dense-subnet.detail": "{n} listings in this /24",
	"rules.decides": "decides",
	"rules.listings": { one: "{n} listing", other: "{n} listings" },
	"rules.code": "code",

	// chart
	"chart.title": "Last 12 months",
	"chart.all": "all servers",
	"chart.fake": "fake",
	"chart.note": "One dot per day. Gaps are days the crawler was down.",
	"chart.servers": { one: "{n} server", other: "{n} servers" },
	"chart.fakeN": "{n} fake",

	// calendar
	"cal.title": "Share of fakes, by day",
	"cal.less": "less",
	"cal.more": "more",
	"cal.weeks": "Last {n} weeks. Widen the window for the full year.",
	"cal.notYet": "not yet",
	"cal.before": "before we started counting",
	"cal.noData": "no data — crawler was down",
	"cal.line": "{total} servers · {fake} fake · {pct}%",
	"cal.mon": "Mon",
	"cal.wed": "Wed",
	"cal.fri": "Fri",

	// by game
	"games.title": "By game",
	"games.game": "Game",
	"games.total": "Total",
	"games.fake": "Fake",
	"games.share": "Share",
	"games.26wk": "26 wk",
	"games.partial": "partial",
	"games.partial.title": "The API stopped paginating; the real total is higher",

	// top farms
	"top.title": "Top farms",
	"top.lead": "One operator, many addresses. Grouped by identical name, map and player limit.",
	"top.all": "All farms, with filters and addresses →",
	"top.empty": "No clusters of three or more identical listings right now.",
	"top.cluster": "Cluster",
	"top.copies": "Copies",
	"top.game": "Game",
	"top.firstSeen": "First seen",
	"top.since": "since {date}",

	// how we count
	"how.title": "How we count",
	"how.lead1":
		"{n} rules, all plain counts over the public list. The big number uses only the strictest one, Clone army. The other four are context. Valve's own {official} servers are excluded.",
	"how.lead2a": "Others went further.",
	"how.lead2b":
		"watches player lists and online patterns over time and catches far more. We stick to one public list. Missing a rule? Open an issue.",

	// footer
	"footer.updated": "Updated {date} · next run in {t}",
	"footer.methodology": "Methodology",
	"footer.source": "Source",
	"footer.issue": "The issue in Valve's tracker",
	"footer.csbro1": "Want a server browser that hides all of this? Try",
	"footer.csbro2": ", a community browser with the fakes filtered out. Same author, same grudge.",
	"footer.disclaimer":
		"A script that has never played Counter-Strike collects this. It makes mistakes. Wrong verdict? Use the report button above. Not affiliated with Valve.",
	"footer.gabe": "Gabe, if you're reading this: no pressure.",
	"top.button": "↑ top",

	// farms page
	"farms.title": "Farms",
	"farms.lead": "Every cluster of three or more identical listings. Open one to see the addresses behind it.",
	"farms.search": "search by name, IP, or subnet",
	"farms.allGames": "all games",
	"farms.allMaps": "all maps",
	"farms.noMap": "(no map)",
	"farms.sort.size": "sort: copies",
	"farms.sort.ips": "sort: IP addresses",
	"farms.sort.subnets": "sort: subnets",
	"farms.sort.players": "sort: claimed players",
	"farms.sort.newest": "sort: newest first",
	"farms.sort.oldest": "sort: oldest first",
	"farms.min": "{n}+ copies",
	"farms.count": { one: "{n} farm", other: "{n} farms" },
	"farms.listings": { one: "{n} listing", other: "{n} listings" },
	"farms.withIp": "with an address inside {ip}",
	"farms.asOf": "as of {ago}",
	"farms.meta": "max {max} · {ips} IPs · {subnets} /24 · {players} players claimed · since {date}",
	"farms.loading": "loading…",
	"farms.announcing": { one: "Announcing from {n} subnet", other: "Announcing from {n} subnets" },
	"farms.more": "+{n} more",
	"farms.addresses": { one: "{n} address", other: "{n} addresses" },
	"farms.col.address": "Address",
	"farms.col.players": "Players",
	"farms.col.token": "Token",
	"farms.col.firstSeen": "First seen",
	"farms.token.none": "none",
	"farms.token.gslt": "GSLT",
	"farms.showMore": "Show {n} more of {rest}",
	"farms.loadMore": "Load {n} more farms",
	"farms.nothing": "Nothing matches. Loosen a filter.",

	// relative time
	"fix.title": "Fix the redirect, not the list",
	"fix.p1":
		"A fake listing costs nothing. Answer the query, show a full server on a good map, wait. When someone connects, redirect them to the address the operator actually wants filled.",
	"fix.p2":
		"That redirect is the whole business. Without it a mirror leads nowhere and stops paying for its tokens and IPs. Valve does not have to moderate 100,000 servers. It has to remove one feature.",
	"fix.tagline": "Kill the redirect and the farms die with it.",

	"time.never": "never",
	"time.justNow": "just now",
	"time.mAgo": "{n}m ago",
	"time.hAgo": "{n}h ago",
	"time.dAgo": "{n}d ago",
	"time.moment": "a moment",
	"time.hm": "{h}h {m}m",
	"time.m": "{m}m",
};

export default en;
