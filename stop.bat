@echo off
rem ============================================================================
rem  Stop the Nexus Market dev container (Windows).
rem  Data is kept: the mysql-data volume survives, so `start.bat` resumes
rem  where you left off. To wipe the database as well, run:
rem      dev.bat reset
rem ============================================================================
setlocal
cd /d "%~dp0"

set "PSEXE=pwsh"
where pwsh >nul 2>&1 || set "PSEXE=powershell"

"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker\scripts\dev.ps1" down %*
set "RC=%ERRORLEVEL%"

echo.
pause
exit /b %RC%
