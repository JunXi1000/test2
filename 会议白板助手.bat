@echo off
setlocal

REM HuiYi BaiBan ZhuShou launcher
REM Usage:
REM 1) Double click this file, or run in cmd:
REM    .\会议白板助手.bat
REM 2) Optional custom ports:
REM    .\会议白板助手.bat 1000 5173

set "BACKEND_PORT=%~1"
set "FRONTEND_PORT=%~2"

if "%BACKEND_PORT%"=="" set "BACKEND_PORT=1000"
if "%FRONTEND_PORT%"=="" set "FRONTEND_PORT=5173"

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\会议白板助手.ps1" -BackendPort %BACKEND_PORT% -FrontendPort %FRONTEND_PORT%

endlocal
