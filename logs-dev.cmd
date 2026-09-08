@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0logs-dev.ps1" %*
