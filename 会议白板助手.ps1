# HuiYi BaiBan ZhuShou - one click startup script
# Usage:
# 1) Run in PowerShell:
#    powershell -ExecutionPolicy Bypass -File ".\会议白板助手.ps1"
# 2) Optional ports:
#    powershell -ExecutionPolicy Bypass -File ".\会议白板助手.ps1" -BackendPort 1000 -FrontendPort 5173
# 3) The script auto cd to project root, resolves port conflicts,
#    starts backend + frontend, waits for readiness, then opens browser.

param(
    [int]$BackendPort = 1000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-WarnMsg {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Assert-CommandExists {
    param([string]$CommandName)
    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "Command not found: $CommandName. Please install and add it to PATH."
    }
}

function Stop-ProcessByPort {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Ok "Port ${Port} is free."
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        if ($procId -eq $PID) {
            Write-WarnMsg "Port ${Port} is used by current script process, skip."
            continue
        }

        try {
            $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
            $name = if ($proc) { $proc.ProcessName } else { "UnknownProcess" }
            Write-WarnMsg "Port ${Port} is used by process ${name} (PID=${procId}), killing..."
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 500
            Write-Ok "Port ${Port} released."
        } catch {
            throw "Failed to kill PID=${procId} on port ${Port}. Try running as Administrator."
        }
    }
}

function Wait-PortReady {
    param(
        [int]$Port,
        [string]$ServiceName,
        [int]$TimeoutSec = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $ready = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($ready) {
            Write-Ok "${ServiceName} is listening on port ${Port}."
            return $true
        }
        Start-Sleep -Seconds 1
    }

    Write-WarnMsg "${ServiceName} is not ready in ${TimeoutSec}s (port ${Port})."
    return $false
}

try {
    # Auto cd to script directory so it can run from anywhere
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location -Path $scriptDir
    Write-Info "Current directory: $(Get-Location)"

    # Path check
    $frontendDir = Join-Path $scriptDir "web"
    $backendPom = Join-Path $scriptDir "pom.xml"
    if (-not (Test-Path $frontendDir)) {
        throw "Frontend dir not found: $frontendDir"
    }
    if (-not (Test-Path $backendPom)) {
        throw "Backend pom.xml not found: $backendPom"
    }

    # Env check
    Assert-CommandExists "mvn"
    Assert-CommandExists "npm"

    # Resolve port conflicts
    Write-Info "Checking port conflicts..."
    Stop-ProcessByPort -Port $BackendPort
    Stop-ProcessByPort -Port $FrontendPort

    # Start backend in a new window
    Write-Info "Starting backend service (Spring Boot)..."
    $backendRunCmd = "mvn spring-boot:run ""-Dspring-boot.run.arguments=--server.port=$BackendPort"""
    $backendProc = Start-Process -FilePath "cmd.exe" -WorkingDirectory $scriptDir -ArgumentList "/k", $backendRunCmd -PassThru
    Write-Info "Backend process started, PID=$($backendProc.Id)"

    # Start frontend in a new window
    Write-Info "Starting frontend service (Vite)..."
    $frontendRunCmd = "npm run dev -- --host 127.0.0.1 --port $FrontendPort --strictPort"
    $frontendProc = Start-Process -FilePath "cmd.exe" -WorkingDirectory $frontendDir -ArgumentList "/k", $frontendRunCmd -PassThru
    Write-Info "Frontend process started, PID=$($frontendProc.Id)"

    # Wait until both services are ready
    Write-Info "Waiting for service readiness..."
    $backendReady = Wait-PortReady -Port $BackendPort -ServiceName "Backend" -TimeoutSec 180
    $frontendReady = Wait-PortReady -Port $FrontendPort -ServiceName "Frontend" -TimeoutSec 180

    if ($backendReady -and $frontendReady) {
        $url = "http://127.0.0.1:$FrontendPort"
        Write-Ok "Both services are ready. Opening browser: $url"
        Start-Process $url | Out-Null
    } else {
        Write-WarnMsg "Some services are not ready in time. Check the new terminal windows."
        exit 1
    }
}
catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
