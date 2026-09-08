# pg_dump of the dev database into dumps\<timestamp>.dump. Override the container with PG_CONTAINER.
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$container = if ($env:PG_CONTAINER) { $env:PG_CONTAINER } else { "fakeservers-db-dev" }
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "fakeservers" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "fakeservers" }
New-Item -ItemType Directory -Force -Path "dumps" | Out-Null
$out = "dumps\$(Get-Date -Format 'yyyyMMdd-HHmmss').dump"
docker exec $container pg_dump -U $user -d $db -Fc | Set-Content -Path $out -Encoding Byte
Write-Host "wrote $out"
