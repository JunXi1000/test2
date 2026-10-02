@echo off
rem ============================================================================
rem  Follow the Nexus Market dev container logs (Windows). Ctrl+C to exit.
rem  Backend / frontend have their own log files inside the container:
rem      docker exec nexus-dev tail -f /var/log/backend.log
rem      docker exec nexus-dev tail -f /var/log/frontend.log
rem ============================================================================
setlocal
cd /d "%~dp0"

set "PSEXE=pwsh"
where pwsh >nul 2>&1 || set "PSEXE=powershell"

"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker\scripts\dev.ps1" logs %*
set "RC=%ERRORLEVEL%"

echo.
pause
exit /b %RC%
