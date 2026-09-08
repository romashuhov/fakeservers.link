#!/usr/bin/env bash
# Stops the prod stack. The database volume is kept.
set -euo pipefail
cd "$(dirname "$0")"
docker compose -f compose.yml down --remove-orphans
