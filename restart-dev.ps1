$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
& "$PSScriptRoot\stop-dev.ps1" -Force
& "$PSScriptRoot\dev.ps1" @args
