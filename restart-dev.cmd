@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart-dev.ps1" %*
