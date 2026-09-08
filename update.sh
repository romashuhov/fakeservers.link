#!/usr/bin/env bash
# git pull; restart only when new commits arrived; then drop image layers the new build made stale.
set -euo pipefail
cd "$(dirname "$0")"

before="$(git rev-parse HEAD)"
# --rebase keeps local hotfix commits, if any, on top of what was pulled.
git pull --rebase
after="$(git rev-parse HEAD)"

if [ "$before" = "$after" ]; then
	echo "no new commits, nothing to do"
	exit 0
fi

echo "==> $before -> $after"
bash ./restart.sh "$@"

# Every rebuild leaves the previous fakeservers-app image untagged. Without this the server
# accumulates one stale image per deploy.
echo "==> pruning stale builds"
docker image prune -f --filter "dangling=true" >/dev/null
docker builder prune -f --filter "until=168h" >/dev/null
