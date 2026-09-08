#!/usr/bin/env bash
# Prod orchestrator: build, db, migrations, app, health. Idempotent; safe to re-run.
# Flags: --rebuild (pull base images), --quiet
set -euo pipefail
cd "$(dirname "$0")"

REBUILD=0
QUIET=0
for arg in "$@"; do
	case "$arg" in
		--rebuild) REBUILD=1 ;;
		--quiet) QUIET=1 ;;
		*) echo "Unknown flag: $arg" >&2; exit 1 ;;
	esac
done

say() { [ "$QUIET" = 1 ] || echo "==> $*"; }
warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose plugin is not available"
docker info >/dev/null 2>&1 || die "docker daemon is not reachable"

if [ ! -f .env ]; then
	cp .env.example .env
	die ".env was missing; copied .env.example to .env. Fill in POSTGRES_PASSWORD and STEAM_WEB_API_KEY, then run again."
fi
source scripts/export-dotenv.sh .env
[ -n "${POSTGRES_PASSWORD:-}" ] && [ "$POSTGRES_PASSWORD" != "change-me" ] || die "POSTGRES_PASSWORD is not set in .env"
[ -n "${STEAM_WEB_API_KEY:-}" ] || warn "STEAM_WEB_API_KEY is empty: the app will start but the collector cannot run"
export FAKESERVERS_ENV=prod

COMPOSE="docker compose -f compose.yml"

wait_health() {
	local name="$1" seconds="$2" i=0 status
	while [ "$i" -lt "$seconds" ]; do
		status="$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo missing)"
		[ "$status" = healthy ] && return 0
		sleep 1
		i=$((i + 1))
	done
	return 1
}

say "build"
if [ "$REBUILD" = 1 ]; then
	$COMPOSE build --pull
else
	$COMPOSE build
fi

say "database"
$COMPOSE up -d db
wait_health fakeservers-db 60 || die "postgres did not become healthy in 60s"

say "migrations"
$COMPOSE run --rm migrator

say "application"
$COMPOSE up -d --remove-orphans
if ! wait_health fakeservers-app 120; then
	warn "app is not healthy after 120s; last log lines:"
	$COMPOSE logs --tail 50 app || true
fi

$COMPOSE ps
say "http://localhost:${PROD_PORT:-4102}"
say "logs: ./logs.sh   restart: ./restart.sh   stop: ./stop.sh   update: ./update.sh"
