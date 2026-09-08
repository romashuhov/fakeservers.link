# Stops the dev contour: local apps by .dev.pid (or -Force: every bun/node whose command line points into this repo), then Postgres.
param([switch]$Force)
$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

if (Test-Path ".dev.pid") {
	$id = (Get-Content ".dev.pid" -Raw).Trim()
	if ($id) {
		try { Stop-Process -Id ([int]$id) -Force -ErrorAction Stop; Write-Host "stopped launcher $id" } catch {}
	}
	Remove-Item ".dev.pid" -Force
}

if ($Force) {
	$root = $PSScriptRoot.Replace("\", "\\")
	Get-CimInstance Win32_Process | Where-Object {
		($_.Name -eq "bun.exe" -or $_.Name -eq "node.exe") -and $_.CommandLine -and $_.CommandLine -match $root
	} | ForEach-Object {
		try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "killed $($_.ProcessId) $($_.Name)" } catch {}
	}
}

docker compose -f compose.db.yml stop
