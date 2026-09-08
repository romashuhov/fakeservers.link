# Dev orchestrator: Postgres in Docker, migrations, then api + web locally through concurrently.
# Flags: -NoInstall, -Reset (stop-dev -Force first)
param(
	[switch]$NoInstall,
	[switch]$Reset
)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Say($m) { Write-Host "==> $m" }
function Die($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

if ($Reset) { & "$PSScriptRoot\stop-dev.ps1" -Force }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Die "docker is not installed" }
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) { Die "bun is not on PATH" }
docker info *> $null
if (-not $?) { Die "docker daemon is not reachable" }

if (-not (Test-Path ".env")) {
	Copy-Item ".env.example" ".env"
	Die ".env was missing; copied .env.example to .env. Fill in POSTGRES_PASSWORD and STEAM_WEB_API_KEY, then run again."
}

# .env -> process environment (literal values, UTF-8)
foreach ($line in Get-Content ".env" -Encoding UTF8) {
	$t = $line.Trim()
	if ($t -eq "" -or $t.StartsWith("#")) { continue }
	$eq = $t.IndexOf("=")
	if ($eq -le 0) { continue }
	$k = $t.Substring(0, $eq).Trim()
	$v = $t.Substring($eq + 1).Trim()
	if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) { $v = $v.Substring(1, $v.Length - 2) }
	[Environment]::SetEnvironmentVariable($k, $v, "Process")
}
if (-not $env:POSTGRES_PASSWORD -or $env:POSTGRES_PASSWORD -eq "change-me") { Die "POSTGRES_PASSWORD is not set in .env" }
if (-not $env:DATABASE_URL) { Die "DATABASE_URL is not set in .env" }
if (-not $env:STEAM_WEB_API_KEY) { Write-Host "WARN: STEAM_WEB_API_KEY is empty: the collector cannot run" -ForegroundColor Yellow }
$env:FAKESERVERS_ENV = "dev"

if (-not $NoInstall) {
	$marker = "node_modules\.installed-for"
	$lock = (Get-FileHash "bun.lock").Hash
	if (-not (Test-Path $marker) -or (Get-Content $marker -Raw).Trim() -ne $lock) {
		Say "bun install"
		bun install
		if (-not $?) { Die "bun install failed" }
		Set-Content -Path $marker -Value $lock -Encoding utf8
	}
}

Say "database"
docker compose -f compose.db.yml up -d
if (-not $?) { Die "could not start postgres" }
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
	$status = docker inspect -f '{{.State.Health.Status}}' fakeservers-db-dev 2>$null
	if ($status -eq "healthy") { $ok = $true; break }
	Start-Sleep -Seconds 1
}
if (-not $ok) { Die "postgres did not become healthy in 60s" }

Say "migrations"
bun run scripts/with-env-run.ts bun apps/api/src/cli.ts migrate up
if (-not $?) { Die "migrations failed" }

Say "api http://localhost:$($env:PORT)  web http://localhost:4302"
$proc = Start-Process -FilePath "bun" -ArgumentList "run", "dev" -NoNewWindow -PassThru
Set-Content -Path ".dev.pid" -Value $proc.Id -Encoding ascii
$proc.WaitForExit()
