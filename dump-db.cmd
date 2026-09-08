@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0dump-db.ps1" %*
