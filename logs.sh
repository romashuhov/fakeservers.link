#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker compose -f compose.yml logs -f --tail=200 "$@"
