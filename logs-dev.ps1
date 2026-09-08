# Live tail of the dev Postgres; api and web log into the terminal that runs dev.
Set-Location -Path $PSScriptRoot
docker compose -f compose.db.yml logs -f --tail=200 @args
