@echo off
rem ============================================================================
rem  Generic forwarder for the Nexus Market dev environment (Windows).
rem
rem      dev.bat up         pull image + start + wait until ready   (same as start.bat)
rem      dev.bat down       stop                                     (same as stop.bat)
rem      dev.bat restart    restart the container
rem      dev.bat logs       follow container logs                   (same as logs.bat)
rem      dev.bat status     container state + port readiness
rem      dev.bat shell      open a bash shell inside the container
rem      dev.bat reset      stop and DELETE the database volume
rem      dev.bat pull       only pull the dev-env image
rem      dev.bat build      only build the image from local sources
rem
rem  Options: -Rebuild (force rebuild)  -NoBrowser (do not open the browser)
rem ============================================================================
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo Usage: dev.bat ^<up^|down^|restart^|logs^|status^|shell^|reset^|pull^|build^> [options]
  echo.
  echo   Simpler: double-click start.bat to start, stop.bat to stop.
  echo.
  pause
  exit /b 2
)

set "PSEXE=pwsh"
where pwsh >nul 2>&1 || set "PSEXE=powershell"

"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker\scripts\dev.ps1" %*
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" pause
exit /b %RC%
