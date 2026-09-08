# fakeservers.link

**How much of the Counter-Strike server browser is fake?** This site counts it, every hour, from the
same public list Steam shows to players, and publishes the number with the method next to it.

The answer, as of the first day of counting: **at least 87% of community listings** for CS2, CS:GO
Legacy, CS:Source, CS 1.6 and Condition Zero are clones of each other, sitting on the same handful
of subnets. One operator, thousands of addresses.

> Live site: <https://fakeservers.link> · A server browser without the fakes: <https://csbro.net>

## Why

Valve's master server lists whatever registers. For years that has meant "farms": one config copied
onto hundreds of ports and IPs, each showing up as a separate server with a catchy name and an
imaginary player count. Real community servers drown in them. Everyone who runs one knows this;
nobody had a number. Now there is one, with a floor that nobody can argue with.

## The fix is one behaviour, not a moderation team

Every farm runs the same business. A fake listing costs nothing: answer the query, show a full
server on a popular map, wait. When a player picks it and connects, the server **redirects the
client to a different address**, the one the operator actually wants to fill. The listing is a
billboard; the redirect is the door.

That door is the whole economy. Take away a server's ability to send a joining client somewhere
else, and a mirror becomes a dead end: the player lands nowhere, the operator gains nothing, and
thousands of listings stop being worth the tokens and IPs they cost. Nobody has to police the list;
it empties itself. This site does not ask Valve to moderate a hundred thousand servers. It asks for
the connect redirect to go.

## What is counted, and what is not

Once an hour, for every tracked game, the collector pulls the full server list with the Steam Web
API (`IGameServersService/GetServerList`) and applies **five rules**. All of them are plain counts
over the list itself: no probing, no heuristics that need history, nothing that requires judgement.

| Rule | What it means | Role |
| --- | --- | --- |
| **Clone army** | Same name, same map, same max players on three or more addresses | **Decides the verdict and the big number** |
| Farm-sized | Part of a cluster of 100 or more identical listings | context |
| No token | Logged in without a game server login token | context |
| IP stack | Ten or more listings on one IP address | context |
| Subnet stack | Fifty or more listings in the same /24 | context |

Only *Clone army* decides. The other four are shown as shares of the list because they are
suggestive, not conclusive: a big community legitimately runs a dozen servers on one IP, and CS 1.6
servers never had tokens. That is why the headline is a **floor, not an estimate**.

Two kinds of listings are deliberately kept out of the clustering:

- **Valve's own servers.** The master server lists them too (about 34 000 for CS2, most in the
  Steam Datagram Relay range 100.64.0.0/10). They are not community servers, so they are excluded
  from both sides of the fraction. Without this step the CS2 figure would be diluted three times over.
- **Default names.** "Counter-Strike 2", "Half-Life" and the like are what an unconfigured server
  announces. Hundreds of unrelated real servers share them, so they never form a cluster.

Everything the site shows is reproducible: the rules are in
[`apps/api/src/stats.ts`](apps/api/src/stats.ts), the collector in
[`apps/api/src/collector.ts`](apps/api/src/collector.ts), and anyone with a Web API key can run
the same code and compare the numbers.

## What is on the site

- **The number**, the fraction behind it, and three stats: listings in 100+ farms, the largest
  farm, days of counting.
- **Check a server.** Paste `IP:port`, get a verdict (Fake, Looks real, Gone, Not in list, Too new,
  Valve official), the rules that fired, and the listing's details. A report button for wrong verdicts.
- **Last 12 months** as one dot per day, a **calendar** of daily shares, a **by-game** table.
- **Farms** (`/farms`): every cluster of the latest run, sortable by copies, IPs, subnets, claimed
  players or age; filter by game and map; search by name, IP or subnet. Open a farm to see the /24
  subnets it announces from and its addresses, 50 at a time.
- Twelve languages, picked from the browser and switchable in the header. Light and dark themes.
- Link previews: the page ships with the live figure in its Open Graph tags and a rendered
  `/og.png`, so a shared link shows the number.

## How it is built

Bun, Elysia and PostgreSQL 18 on the server; Svelte 5, Vite and Tailwind 4 on the client;
Zod for validation, Biome and svelte-check for hygiene. No ORM: SQL files applied by a small
migrator with a checksum registry. No i18n or chart libraries: a 100-line translation helper and
hand-drawn SVG. The only native piece is resvg (WebAssembly) for the preview image.

```
apps/api      Elysia server: collector, stats, farms, check, reports, og.png, static files in prod
apps/web      Svelte SPA: home and /farms, locales in src/locales
migrations    0001 schema, 0002 official servers, 0003 farms
data          daily aggregates, YYYY/MM/DD.json, written and pushed by the app
```

### Data flow

1. **Fetch.** GetServerList returns at most 10 000 rows and ignores `offset`, so a full list is
   assembled by partitioning: a capped bucket is split by region, then secure, empty, Linux,
   dedicated and password, and as a last resort by map. About 200 calls per run, ten minutes.
2. **Cluster.** Listings are grouped by name, map and max players; Valve's servers and default names
   are set aside.
3. **Store.** `listings` holds the current state of every address (first and last seen, cluster
   size, official flag). `snapshots` gets one row per game per run with all the counters. `farms`
   keeps every cluster of three or more with a first-seen date. `clusters` keeps the top 100 per run.
4. **Serve.** Stats are computed in the background and served from memory; a request never waits
   for the heavy queries. Checks and farm pages read the tables directly, cached for a minute.
5. **Export.** Completed UTC days are written to `data/` as JSON and pushed to the repository
   through the GitHub API, so the history is in git and does not depend on the database surviving.

## Running it

### Prod (Linux, everything in Docker, one port)

```bash
cp .env.example .env    # fill in POSTGRES_PASSWORD, STEAM_WEB_API_KEY, PUBLIC_URL
./prod.sh
```

`prod.sh` builds the image, starts Postgres, applies migrations, starts the app and waits for
`/api/health`. Re-running it is safe. The site and the API share port `PROD_PORT` (4102), which is
what a Cloudflare Tunnel or any reverse proxy points at.

| Command | What it does |
| --- | --- |
| `./prod.sh [--rebuild] [--quiet]` | build, db, migrations, app, health |
| `./stop.sh` | stop the stack, keep the database volume |
| `./restart.sh` | stop, then prod |
| `./update.sh` | `git pull --rebase`; restart only when new commits arrived; prune stale images |
| `./logs.sh [service]` | live tail |
| `./ps.sh` | container status |
| `./migrate.sh [up\|status\|verify\|repair-checksums]` | run the migrator by hand |
| `./dump-db.sh` / `./restore-db.sh dumps/<file>.dump` | backup and restore |

### Dev (Windows, apps local, Postgres in Docker)

```powershell
copy .env.example .env
.\dev.cmd
```

Starts Postgres, applies migrations, then runs the API on 4202 and Vite on 4302 in the same
terminal. The `.cmd` wrappers pass `-ExecutionPolicy Bypass`, so no PowerShell policy change is
needed. `.\stop-dev.cmd`, `.\restart-dev.cmd`, `.\logs-dev.cmd`, `.\dump-db.cmd` and
`.\restore-db.cmd` do what their names say.

```bash
bun run collect          # one collector run against the dev database
bun run export           # write missing daily files; `bun run export 2026-09-08` rewrites one day
bun run migrate status   # or up / verify / repair-checksums
bun run check            # Biome + svelte-check
bun run build            # web bundle into apps/web/dist
```

Ports come from the shared registry `../PORTS.md`, project 02: prod 4102, dev API 4202, dev web
4302, dev Postgres 4402.

### Configuration

Everything lives in `.env`; `.env.example` documents every variable.

| Variable | Required | Meaning |
| --- | --- | --- |
| `STEAM_WEB_API_KEY` | yes | from <https://steamcommunity.com/dev/apikey>; without it nothing is collected |
| `POSTGRES_PASSWORD` | yes | database password; prod refuses to start with the placeholder |
| `PUBLIC_URL` | prod | public origin for absolute preview URLs, e.g. `https://fakeservers.link` |
| `PROD_PORT` | no | external port of the prod stack, default 4102 |
| `TRUST_PROXY` | no | `1` behind Cloudflare or a reverse proxy (default in prod): client IP from headers |
| `COLLECT_INTERVAL_MIN`, `COLLECT_ON_START` | no | collector schedule, default hourly and on start |
| `REPORT_RATE_PER_HOUR` | no | visitor reports per client per hour, default 5 |
| `DATA_EXPORT`, `DATA_DIR` | no | daily JSON export; prod compose turns it on |
| `DATA_PUSH_TOKEN`, `DATA_REPO`, `DATA_BRANCH` | prod | commit the daily export to GitHub; token is a fine-grained PAT with Contents: write |

## API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | liveness, pings the database |
| `GET /api/stats` | everything the home page shows |
| `GET /api/check?addr=ip:port` | verdict, fired rules and details for one address |
| `GET /api/farms?game=&map=&q=&ip=&sort=&min=&offset=&limit=` | clusters of the latest run with facets |
| `GET /api/farms/:id?offset=&limit=&soffset=&slimit=` | one cluster: addresses and /24 subnets, paged |
| `POST /api/report` `{ addr, note? }` | report a wrong verdict, rate-limited per client |
| `GET /og.png` | the link-preview image with the live figure |

## Data in git

Every completed UTC day is exported to `data/YYYY/MM/DD.json`: the last snapshot of the day per
game, the hourly series behind it, totals and the 100 largest clusters (format in
[`data/README.md`](data/README.md)). The app writes the file after the first collection of the next
day and, when `DATA_PUSH_TOKEN` is set, commits it to the repository through the GitHub API. No git,
ssh or cron on the server: one fine-grained token with "Contents: write" for this repository is all
it takes, and a failed push is retried on the next run.

Full address lists are not committed: at about 4 MB per hourly snapshot they do not belong in a
repository. The `/farms` page is the place for them.

## Languages

English is the source of truth ([`apps/web/src/locales/en.ts`](apps/web/src/locales/en.ts));
Russian, Ukrainian, Polish, German, French, Spanish, Portuguese, Turkish, Romanian, Czech and
Chinese fall back to it key by key. The first visit follows the browser's languages, the switch in
the header stores a one-year cookie. That cookie is the only thing the site stores in a browser
besides the theme; there is no analytics and no tracking, so there is no consent banner.

Adding a language is one file in `src/locales` and one line in
[`apps/web/src/lib/i18n.svelte.ts`](apps/web/src/lib/i18n.svelte.ts). Corrections to a translation
are welcome as pull requests.

## Fonts and credits

Bricolage Grotesque and JetBrains Mono, both under the SIL Open Font License. The static instances
used for the preview image live in [`apps/api/fonts`](apps/api/fonts).

Not affiliated with Valve. Data is collected automatically; mistakes happen, and the report button
on the site is the fastest way to get one fixed.
