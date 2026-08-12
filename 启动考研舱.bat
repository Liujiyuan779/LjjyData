@echo off
cd /d "%~dp0"
start "KaoYan" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
