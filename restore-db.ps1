# Restores a dump into the dev database: .\restore-db.cmd dumps\<file>.dump  (RESTORE_YES=1 skips the prompt)
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
if (-not (Test-Path $File)) { Write-Host "no such file: $File" -ForegroundColor Red; exit 1 }
$container = if ($env:PG_CONTAINER) { $env:PG_CONTAINER } else { "fakeservers-db-dev" }
$user = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "fakeservers" }
$db = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "fakeservers" }
if ($env:RESTORE_YES -ne "1") {
	$answer = Read-Host "Restore $File into $container, overwriting current data? [y/N]"
	if ($answer -ne "y" -and $answer -ne "Y") { Write-Host "aborted"; exit 1 }
}
Get-Content $File -Encoding Byte -ReadCount 0 | docker exec -i $container pg_restore -U $user -d $db --clean --if-exists --no-owner
Write-Host "restored $File"
