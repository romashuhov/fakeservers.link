#!/usr/bin/env bash
# Manual migrator run outside of prod.sh: ./migrate.sh [up|status|verify|repair-checksums]
set -euo pipefail
cd "$(dirname "$0")"
docker compose -f compose.yml run --rm --build migrator bun apps/api/src/cli.ts migrate "${1:-up}"
