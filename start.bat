@echo off
rem ============================================================================
rem  Nexus Market one-click launcher (Windows)
rem
rem  Just double-click this file. It pulls the dev-env image, starts the
rem  container (MySQL + backend + frontend), waits until both are ready,
rem  verifies the backend login API, then opens the browser.
rem
rem  All real logic and all Chinese output live in docker\scripts\dev.ps1,
rem  which is saved with a UTF-8 BOM so Windows PowerShell 5.1 decodes its
rem  Chinese text correctly. This launcher stays ASCII-only on purpose:
rem  cmd.exe reads .bat files in the OEM code page, and mixing encodings here
rem  only produces mojibake.
rem
rem  Other commands:  stop.bat  |  logs.bat  |  dev.bat status
rem ============================================================================
setlocal
cd /d "%~dp0"

set "PSEXE=pwsh"
where pwsh >nul 2>&1 || set "PSEXE=powershell"

"%PSEXE%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0docker\scripts\dev.ps1" up %*
set "RC=%ERRORLEVEL%"

echo.
pause
exit /b %RC%
