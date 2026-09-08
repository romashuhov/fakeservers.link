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
		"A floor, not an estimate. Only listings that are provably copies of each other count; everything that needs judgement is left out, and Valve's own {n} servers are out of both sides. The real share is higher.",
	"headline.live": "Live · {ago}",
	"stat.farm100": "sit in farms of 100+ identical copies",
	"stat.largest": "copies in the largest farm",
	"stat.days": "days of counting, no end in sight",

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
	"verdict.duplicate.note":
		"Clone army triggered: this address is one of many wearing the same name, map and max players.",
	"verdict.unique": "Looks real",
	"verdict.unique.note":
		"Clone army did not trigger. The other rules are context only. People might actually play here.",
	"verdict.gone": "Gone",
	"verdict.gone.note": "Missing from the latest snapshot. Farms go quiet too; we keep the record.",
	"verdict.not_listed": "Not in list",
	"verdict.not_listed.note":
		"We haven't seen this address in the Steam list. Either it's brand new, or it never existed. Both happen.",
	"verdict.listed_recently": "Too new",
	"verdict.listed_recently.note":
		"Steam lists it right now, but it appeared after our last snapshot. Check back in an hour.",
	"verdict.official": "Valve official",
	"verdict.official.note":
		"One of Valve's own servers. Listed by the master server, but not a community server: we keep it out of every count.",
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
	"rule.identical.desc":
		"Same name, same map, same max players on three or more addresses. One config, many ports.",
	"rule.identical.detail": "{n} addresses share this name, map and max players",
	"rule.farm": "Farm-sized",
	"rule.farm.desc": "Part of a cluster of 100 or more identical listings. Very efficient hardware.",
	"rule.farm.detail": "cluster of {n} identical listings",
	"rule.anonymous": "No token",
	"rule.anonymous.desc":
		"Logged in to Steam without a game server login token. Normal for GoldSrc-era games, a shortcut for farms elsewhere.",
	"rule.anonymous.detail": "no game server login token",
	"rule.dense-ip": "IP stack",
	"rule.dense-ip.desc": "Ten or more listings announcing from one IP address.",
	"rule.dense-ip.detail": "{n} listings on this IP",
	"rule.dense-subnet": "Subnet stack",
	"rule.dense-subnet.desc":
		"Fifty or more listings announcing from the same /24. One operator, many addresses.",
	"rule.dense-subnet.detail": "{n} listings in this /24",
	"rules.decides": "decides",
	"rules.listings": { one: "{n} listing", other: "{n} listings" },
	"rules.code": "code",

	// chart
	"chart.title": "Last 12 months",
	"chart.all": "all servers",
	"chart.fake": "fake",
	"chart.note":
		"One dot per day. Gaps are days the crawler was down; we don't draw lines through things we didn't see.",
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
	"top.lead": "One operator, many addresses. Grouped by identical name, map and max players.",
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
		"{n} rules, all plain counts over the list the browser itself shows. No probing, no guessing. The big number uses only the strictest one, Clone army: an indisputable violation that nobody can argue with. The other four are context and are shown as shares of the list. Valve's own servers, {official} of them right now, are listed by the master server too; they are neither counted nor blamed. That is why the number is a floor.",
	"how.lead2a": "Others went further.",
	"how.lead2b":
		"also watches player lists and online patterns over time, catches far more, and hides it all from its own browser. We stick to what can be verified from a single public list. Think a rule is missing or a threshold is wrong? Open an issue.",

	// footer
	"footer.updated": "Updated {date} · next run in {t}",
	"footer.methodology": "Methodology",
	"footer.source": "Source",
	"footer.issue": "The issue in Valve's tracker",
	"footer.csbro1": "Want a server browser that hides all of this? Try",
	"footer.csbro2": ", a community browser with the fakes filtered out. Same author, same grudge.",
	"footer.disclaimer":
		"Data is collected automatically by a script that has never played Counter-Strike. Mistakes happen. If your server is on the wrong side of this page, use the report button in the checker above. Not affiliated with Valve.",
	"footer.gabe": "Gabe, if you're reading this: no pressure.",
	"top.button": "↑ top",

	// farms page
	"farms.title": "Farms",
	"farms.lead":
		"Every cluster of three or more identical listings in the latest run: same name, map and max players, many addresses. Open one to see who is behind it.",
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
		"Every farm here runs the same business. A fake listing costs nothing: answer the query, show a full server on a popular map, wait. When a player picks it and connects, the server redirects the client to a different address, the one the operator actually wants to fill. The listing is a billboard; the redirect is the door.",
	"fix.p2":
		"That door is the whole economy. Take away a server's ability to send a joining client somewhere else, and a mirror becomes a dead end: the player lands nowhere, the operator gains nothing, and thousands of listings stop being worth the tokens and IPs they cost. Nobody has to police the list. It empties itself.",
	"fix.tagline": "Close the redirect, and the market for mirrors collapses.",

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
