@echo off
setlocal
cd /d "%~dp0\..\.."
node collector\src\cli.mjs weekly-refresh
if errorlevel 1 pause
