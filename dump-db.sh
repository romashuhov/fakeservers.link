#!/usr/bin/env bash
# pg_dump of the prod database into dumps/<timestamp>.dump (custom format).
# Override the container with PG_CONTAINER (default fakeservers-db).
set -euo pipefail
cd "$(dirname "$0")"
source scripts/export-dotenv.sh .env
container="${PG_CONTAINER:-fakeservers-db}"
mkdir -p dumps
out="dumps/$(date +%Y%m%d-%H%M%S).dump"
docker exec "$container" pg_dump -U "${POSTGRES_USER:-fakeservers}" -d "${POSTGRES_DB:-fakeservers}" -Fc > "$out"
echo "wrote $out"
