#!/usr/bin/env bash
# Restores a dump made by dump-db.sh: ./restore-db.sh dumps/<file>.dump
# Destructive: drops and recreates the objects in the dump. Asks unless RESTORE_YES=1.
set -euo pipefail
cd "$(dirname "$0")"
source scripts/export-dotenv.sh .env
container="${PG_CONTAINER:-fakeservers-db}"
file="${1:-}"
[ -n "$file" ] && [ -f "$file" ] || { echo "usage: ./restore-db.sh dumps/<file>.dump" >&2; exit 1; }
if [ "${RESTORE_YES:-0}" != 1 ]; then
	read -r -p "Restore $file into $container, overwriting current data? [y/N] " answer
	[ "$answer" = y ] || [ "$answer" = Y ] || { echo "aborted"; exit 1; }
fi
docker exec -i "$container" pg_restore -U "${POSTGRES_USER:-fakeservers}" -d "${POSTGRES_DB:-fakeservers}" --clean --if-exists --no-owner < "$file"
echo "restored $file"
