# fakeservers.link

Counts how much of the Counter-Strike server browser is fake. Every hour, from the same public list
Steam shows to players.

First day of counting: **at least 87%** of community listings across CS2, CS:GO Legacy, CS:Source,
CS 1.6 and Condition Zero are copies of each other, sitting on a handful of subnets.

> <https://fakeservers.link> · A browser without the fakes: <https://csbro.net>

## An appeal to Valve: fix the redirects

The whole mirror architecture grew around one flaw: a server can redirect a joining player to an
unrelated IP. Without it mirrors make no sense at all, and the community can grow again.

Remove the redirects and 90% of the problem is solved.

## What counts

Once an hour the collector pulls the full list with `IGameServersService/GetServerList` and applies
five rules. All of them are counts over the list itself. No probing, no guessing.

| Rule | Meaning | Role |
| --- | --- | --- |
| **Clone army** | Same name, map and player limit on 3+ addresses | **decides** |
| Farm-sized | In a cluster of 100+ identical listings | context |
| No token | No game server login token | context |
| IP stack | 10+ listings on one IP | context |
| Subnet stack | 50+ listings in one /24 | context |

Only Clone army decides the verdict and the headline. The rest are shown as shares because they are
suggestive: a big community legitimately runs a dozen servers on one IP, and CS 1.6 never had tokens.
The headline is a floor.

Excluded from clustering:

- **Valve's own servers.** ~34 000 for CS2, mostly in the Steam Datagram Relay range 100.64.0.0/10.
  Not community servers, so they leave both sides of the fraction. Keeping them would dilute the CS2
  figure threefold.
- **Default names** like "Counter-Strike 2". Hundreds of unrelated real servers share them.

Rules live in [`stats.ts`](apps/api/src/stats.ts), the collector in
[`collector.ts`](apps/api/src/collector.ts). Anyone with a Web API key can run it and compare.

## On the site

- The number, the fraction, and three stats.
- **Check a server**: paste `IP:port`, get a verdict and the rules that fired. Report button for
  wrong ones.
- A year of daily points, a calendar, a by-game table.
- **[/farms](https://fakeservers.link/farms)**: every cluster of the latest run. Sort by copies, IPs,
  subnets, claimed players or age; filter by game and map; search by name, IP or subnet. Open one for
  its /24 subnets and addresses.
- 12 languages, light and dark themes, link previews with the live number.

## Stack

Bun, Elysia, PostgreSQL 18, Zod. Svelte 5, Vite, Tailwind 4. Biome and svelte-check.
No ORM: SQL files and a small migrator with a checksum registry. No i18n or chart libraries either.
The one native piece is resvg (WebAssembly) for the preview image.

```
apps/api      collector, stats, farms, check, reports, og.png, static files in prod
apps/web      Svelte SPA: home and /farms, locales in src/locales
migrations    0001 schema, 0002 official servers, 0003 farms
data          daily aggregates, YYYY/MM/DD.json
```

### How a run works

1. **Fetch.** GetServerList caps at 10 000 rows and ignores `offset`, so the list is assembled by
   partitioning: a capped bucket splits by region, then secure, empty, Linux, dedicated, password,
   and finally by map. ~200 calls, ~10 minutes.
2. **Cluster** by name, map and player limit, with Valve's servers and default names set aside.
3. **Store.** `listings` holds every address, `snapshots` one row per game per run, `farms` every
   cluster of 3+ with a first-seen date, `clusters` the top 100 of the run.
4. **Serve.** Stats are recomputed in the background and served from memory.
5. **Export.** Completed UTC days go to `data/` and are pushed to this repository via the GitHub API.

## Running it

### Prod (Linux, Docker, one port)

```bash
cp .env.example .env    # POSTGRES_PASSWORD, STEAM_WEB_API_KEY, PUBLIC_URL, DATA_PUSH_TOKEN
./prod.sh
```

Builds the image, starts Postgres, migrates, starts the app, waits for `/api/health`. Safe to re-run.
Site and API share `PROD_PORT` (4102), which is what a Cloudflare Tunnel points at.

| Command | Does |
| --- | --- |
| `./prod.sh [--rebuild] [--quiet]` | build, db, migrations, app, health |
| `./stop.sh` | stop, keep the database volume |
| `./restart.sh` | stop, then prod |
| `./update.sh` | pull; restart only on new commits; prune stale images |
| `./logs.sh [service]` · `./ps.sh` | tail, status |
| `./migrate.sh [up\|status\|verify\|repair-checksums]` | migrator by hand |
| `./dump-db.sh` · `./restore-db.sh dumps/<file>.dump` | backup, restore |

### Dev (Windows, apps local, Postgres in Docker)

```powershell
copy .env.example .env
.\dev.cmd
```

API on 4202, Vite on 4302. Also `.\stop-dev.cmd`, `.\restart-dev.cmd`, `.\logs-dev.cmd`,
`.\dump-db.cmd`, `.\restore-db.cmd`. The `.cmd` wrappers pass `-ExecutionPolicy Bypass`.

```bash
bun run collect          # one run against the dev database
bun run export           # missing daily files; add a date to rewrite one
bun run migrate status   # up / verify / repair-checksums
bun run check            # Biome + svelte-check
bun run build            # web bundle
```

Ports come from `../PORTS.md`, project 02: prod 4102, dev API 4202, web 4302, Postgres 4402.

### Configuration

| Variable | | Meaning |
| --- | --- | --- |
| `STEAM_WEB_API_KEY` | required | <https://steamcommunity.com/dev/apikey> |
| `POSTGRES_PASSWORD` | required | prod refuses to start with the placeholder |
| `PUBLIC_URL` | prod | origin for absolute preview URLs |
| `DATA_PUSH_TOKEN` | prod | fine-grained PAT for this repo, Contents: write |
| `DATA_REPO`, `DATA_BRANCH` | | where the daily export lands |
| `PROD_PORT` | | external port, default 4102 |
| `TRUST_PROXY` | | `1` behind Cloudflare: client IP from headers |
| `COLLECT_INTERVAL_MIN`, `COLLECT_ON_START` | | collector schedule |
| `REPORT_RATE_PER_HOUR` | | reports per client per hour |
| `DATA_EXPORT`, `DATA_DIR` | | daily export; prod compose turns it on |
| `ADMIN_TOKEN` | | unlocks `GET /api/views`; empty means the route 404s |

## API

| Route | Returns |
| --- | --- |
| `GET /api/health` | liveness, pings the database |
| `GET /api/stats` | everything the home page shows |
| `GET /api/check?addr=ip:port` | verdict and fired rules for one address |
| `GET /api/farms?game=&map=&q=&ip=&sort=&min=&offset=&limit=` | clusters with facets |
| `GET /api/farms/:id?offset=&limit=&soffset=&slimit=` | one cluster: addresses and subnets |
| `POST /api/report` `{ addr, note? }` | report a wrong verdict, rate-limited |
| `GET /og.png` | preview image with the live number |
| `GET /api/views?token=&days=` | page counters, 404 without `ADMIN_TOKEN` |

## Data in git

Each completed UTC day is written to `data/YYYY/MM/DD.json`: the day's last snapshot per game, the
hourly series, totals, and the 100 largest clusters. Format in [`data/README.md`](data/README.md).

The app pushes the file itself through the GitHub API when `DATA_PUSH_TOKEN` is set. No git, ssh or
cron on the server; a failed push retries next hour. Full address lists stay out of the repository at
~4 MB per hourly snapshot; [/farms](https://fakeservers.link/farms) is the place for them.

## Counting visitors

Page views are counted in the app, in Postgres, with no third party and no cookies. A hit bumps a
counter row; a visitor is `sha256(secret + day + IP + user agent)`, which is meaningless the next day
and unusable without the secret. Nothing personal is stored, so the site needs no consent banner.

Obvious bots are skipped by user agent. Read the numbers with `bun run views 30` on the server, or
`GET /api/views?token=$ADMIN_TOKEN&days=30`.

## Languages

English is the source ([`en.ts`](apps/web/src/locales/en.ts)); the other eleven fall back to it key by
key. First visit follows the browser, the header switch stores a one-year cookie. That cookie and the
theme are the only things stored in a browser, so there is no consent banner.

A new language is one file in `src/locales` and one line in
[`i18n.svelte.ts`](apps/web/src/lib/i18n.svelte.ts). Corrections welcome as pull requests.

## Credits

Bricolage Grotesque and JetBrains Mono, both OFL, in [`apps/api/fonts`](apps/api/fonts).

Not affiliated with Valve. Data is collected automatically and mistakes happen; the report button on
the site is the fastest way to fix one.
