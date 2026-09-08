@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0restore-db.ps1" %*
