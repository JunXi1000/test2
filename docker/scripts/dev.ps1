#Requires -Version 5.1
<#
.SYNOPSIS
  Nexus Market 开发环境一键脚本(Windows)。

.DESCRIPTION
  给「刚 clone 下来的人」用:不需要装 JDK / Maven / Node / MySQL,也不需要手动建库导表。
  一条命令完成「拉镜像 -> 起容器 -> 等前后端就绪 -> 验证后端接口 -> 打开浏览器」。

  真正干活的是 docker compose;本脚本只补三件它做不了的事:
    1. 把「Docker 没装 / Docker Desktop 没启动」变成一句人话,而不是一屏英文报错;
    2. **拉取优先、构建兜底** —— compose 同时写了 image 与 build 时,本地没镜像会直接
       构建(要联网装 MySQL/Maven/Node,约 10 分钟),本脚本先尝试 pull;
    3. 等就绪:**轮询到端口真的在监听**才报成功,并顺手用 admin 账号打一次登录接口,
       以证明「MySQL 起来了 + 建表导脚本成功 + 后端连得上库」这条链路真的通了。

.PARAMETER Command
  up       拉镜像并启动,等就绪(默认)
  down     停止容器(数据保留)
  restart  重启容器
  logs     跟随容器日志(Ctrl+C 退出)
  status   查看容器状态与端口就绪情况
  shell    进入容器 bash
  reset    停止并**删除数据库卷**(下次启动重新导建表脚本,数据全丢)
  pull     只拉取环境镜像
  build    只用本机代码构建环境镜像

.PARAMETER NoBrowser
  up 成功后不自动打开浏览器。

.PARAMETER Rebuild
  up 时强制重新构建镜像(改了 docker/Dockerfile 或依赖清单后需要)。

.EXAMPLE
  .\start.bat
  .\docker\scripts\dev.ps1 logs
  .\docker\scripts\dev.ps1 up -Rebuild
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('up', 'down', 'restart', 'logs', 'status', 'shell', 'reset', 'pull', 'build')]
    [string]$Command = 'up',

    [switch]$NoBrowser,
    [switch]$Rebuild
)

# 刻意**不**设 $ErrorActionPreference='Stop':本脚本大量依赖原生 docker 命令的退出码,
# 而 5.1 下原生命令写 stderr 会被 Stop 变成终止错误,反而掩盖真实原因。
# 所以:输出直连控制台(不赋值、不接管道,保证 Ctrl+C 与彩色输出都正常),
# 失败一律显式判断 $LASTEXITCODE。

$DockerDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RepoDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ComposeFile = Join-Path $DockerDir 'docker-compose.yml'

# 用 --project-directory 而不是 `cd docker`:两条路径等价(项目名都取 docker,
# .env 都从 docker/ 读),但不改动调用者的工作目录,也就不需要 Push/Pop 的 try-finally。
$ComposeCmd = @('compose', '--project-directory', $DockerDir, '-f', $ComposeFile)

$FrontendUrl = 'http://localhost:5173'
$BackendUrl = 'http://localhost:1000'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "  [OK] $Message" -ForegroundColor Green }
function Write-Info([string]$Message) { Write-Host "  $Message" }
function Write-WarnLine([string]$Message) { Write-Host "  [!] $Message" -ForegroundColor Yellow }
function Write-Fail([string]$Message) { Write-Host "  [x] $Message" -ForegroundColor Red }

function Stop-WithError([string]$Message) {
    Write-Fail $Message
    Write-Host ''
    exit 1
}

# ── 环境检查 ─────────────────────────────────────────────────────────────
function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Stop-WithError @'
找不到 docker 命令。请先安装 Docker Desktop:
  https://www.docker.com/products/docker-desktop/
装完启动它,等托盘图标显示 Engine running,再重新运行本脚本。
'@
    }

    $null = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError @'
Docker 守护进程没有在运行(命令装了,但引擎没起)。
请先启动 Docker Desktop,等它状态变成 Engine running,再重新运行本脚本。
'@
    }
}

# 输出直连控制台;退出码由调用方在调用后读 $LASTEXITCODE。
function Invoke-Compose {
    param([string[]]$ComposeArgs)
    & docker @($ComposeCmd + $ComposeArgs)
}

# 需要**捕获**输出时用它(不会打印)
function Get-ComposeOutput {
    param([string[]]$ComposeArgs)
    $out = & docker @($ComposeCmd + $ComposeArgs) 2>$null
    return ($out | Out-String).Trim()
}

function Get-EnvImageName {
    $name = Get-ComposeOutput -ComposeArgs @('config', '--images')
    if (-not $name) { return '' }
    return ($name -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 1).Trim()
}

function Test-ImageLocal([string]$ImageName) {
    if (-not $ImageName) { return $false }
    $null = docker image inspect $ImageName 2>&1
    return ($LASTEXITCODE -eq 0)
}

# ── 服务就绪探测 ─────────────────────────────────────────────────────────
# ⚠️ **不能用「TCP 能连上」当就绪信号**——这是实测踩到的坑,不是洁癖:
#    Windows 上 Docker Desktop 的**宿主端口代理**在容器里的应用还没开始监听时,
#    就已经 accept 了宿主到该端口的连接。实测:后端还在编译、Vite 连日志文件都还没有时,
#    TcpClient.Connect 就已经成功 ⇒ 脚本提前报「就绪」,紧接着登录验证又失败,还会去开浏览器。
#    根因:Docker 的端口发布是宿主侧代理监听 + 转发,和容器内是否真的有人在 listen 无关。
#
# 正确判据是**收到一个 HTTP 响应**,哪怕状态码是 401/403/404:
#   · 后端 `/` 没登记在授权表里,默认拒绝会回 401/403 —— 能回就说明 Tomcat 在应答了;
#   · Vite `/` 回 200。
# 连接被重置 / 连不上(= 拿不到响应对象)才是「还没起来」。
function Test-HttpReady {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        return [int]$resp.StatusCode
    } catch {
        # 非 2xx 会抛异常,但**异常里带着响应对象** —— 有它就意味着服务已在应答
        if ($null -ne $_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return $null
    }
}

function Wait-HttpReady {
    param([string]$Name, [string]$Url, [int]$TimeoutSec)

    Write-Host "  等待 $Name ($Url) 就绪,最多 ${TimeoutSec}s " -NoNewline
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    $tick = 0
    while ($watch.Elapsed.TotalSeconds -lt $TimeoutSec) {
        $code = Test-HttpReady -Url $Url
        if ($null -ne $code) {
            Write-Host ("  就绪(HTTP $code,{0:N0}s)" -f $watch.Elapsed.TotalSeconds) -ForegroundColor Green
            return $true
        }
        if ($tick % 3 -eq 0) { Write-Host '.' -NoNewline }  # 每 3 秒点一个,避免刷屏
        $tick++
        Start-Sleep -Seconds 1
    }
    Write-Host '  超时' -ForegroundColor Red
    return $false
}

# ── 后端接口冒烟:证明「MySQL + 建表导脚本 + 后端连库」整条链路真的通了 ──
function Test-BackendLogin {
    $body = '{"type":"ADMIN","username":"admin","password":"123456"}'
    try {
        $resp = Invoke-RestMethod -Method Post -Uri "$BackendUrl/common/login" `
            -ContentType 'application/json; charset=utf-8' `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
            -TimeoutSec 20
    } catch {
        Write-WarnLine "后端登录接口调用失败:$($_.Exception.Message)"
        Write-WarnLine '容器可能还在启动,或数据库导脚本未完成。看日志:docker compose logs -f dev'
        return $false
    }

    if ($resp.code -eq 200 -and $resp.data) {
        Write-Ok "后端接口 + 数据库连通(admin 登录返回 JWT,长度 $($resp.data.Length))"
        return $true
    }

    Write-WarnLine "后端有响应但登录未成功(code=$($resp.code) msg=$($resp.msg))"
    Write-WarnLine '若数据库刚初始化完,稍等几秒重试;仍失败请看容器日志。'
    return $false
}

function Show-AccessInfo {
    Write-Host ''
    Write-Host '  ==============================================================' -ForegroundColor Cyan
    Write-Host '   Nexus Market 开发环境' -ForegroundColor Cyan
    Write-Host '  ==============================================================' -ForegroundColor Cyan
    Write-Info "前端页面    $FrontendUrl"
    Write-Info "后端 API    $BackendUrl"
    Write-Info '  MySQL       容器内 localhost:3306(库 template_v3;仅宿主机回环可达)'
    Write-Host ''
    Write-Info '  演示账号(密码统一 123456):'
    Write-Info '    管理员 admin    买家 user1    商家 shop1'
    Write-Host ''
    Write-Info '  常用命令:'
    Write-Info '    stop.bat                                    停止(数据保留)'
    Write-Info '    docker\scripts\dev.ps1 logs                 跟随容器日志'
    Write-Info '    docker\scripts\dev.ps1 shell                进入容器'
    Write-Info '    docker exec nexus-dev tail -f /var/log/backend.log'
    Write-Host ''
}

# ── 子命令 ───────────────────────────────────────────────────────────────
function Invoke-Up {
    Assert-Docker

    Write-Step '拉取环境镜像(拉不到会自动退回本机构建)'
    $imageName = Get-EnvImageName
    if ($imageName) { Write-Info "镜像: $imageName" }

    Invoke-Compose -ComposeArgs @('pull')
    $pullOk = ($LASTEXITCODE -eq 0)

    $imageLocal = Test-ImageLocal $imageName

    if ($pullOk) {
        Write-Ok '环境镜像已就绪'
    } else {
        Write-WarnLine '拉取失败:镜像可能尚未发布到 ghcr.io、网络不通,或该包是私有的需要先登录。'
        if (-not $imageLocal) {
            Write-WarnLine '若它在 GHCR 上是私有包,请先执行: docker login ghcr.io -u <你的GitHub用户名>'
        }
        if ($imageLocal) {
            Write-Info '本地已有同名镜像,将直接用它启动。'
            Write-Info '如果刚改过 docker/ 下的文件,请加 -Rebuild 强制重建。'
        } else {
            Write-WarnLine '本地也没有该镜像,改为**本机构建**(首次约 10 分钟:装 MySQL/Maven/Node + 预热依赖)。'
        }
    }

    Write-Step '启动容器(MySQL + 后端 + 前端)'
    $upArgs = @('up', '-d')
    if ($Rebuild) { $upArgs += '--build' }
    Invoke-Compose -ComposeArgs $upArgs
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError 'docker compose up 失败。完整日志:docker compose -f docker/docker-compose.yml logs'
    }
    Write-Ok '容器已在后台运行'

    Write-Step '等待服务就绪'
    # 容器内是「先等后端起来再起 Vite」(见 entrypoint.sh),所以按顺序查即可。
    # 后端首帧要 Maven 编译 + Spring Boot 启动 + 连库:预热命中实测约 2 分钟
    # (其中应用自身启动 ~53s,其余是编译与依赖补齐);冷启动(现下载依赖)可能 5-10 分钟,所以给 600s。
    $backendOk = Wait-HttpReady -Name '后端' -Url $BackendUrl -TimeoutSec 600
    $frontendOk = Wait-HttpReady -Name '前端' -Url $FrontendUrl -TimeoutSec 180

    if (-not $backendOk) {
        Write-WarnLine '后端 600s 内未监听 :1000。看后端日志:'
        Write-Info '  docker exec nexus-dev tail -n 100 /var/log/backend.log'
        Write-Info '  (首次构建 + 预热依赖确实可能更久;也可能是构建阶段就失败了)'
    }

    if ($backendOk) {
        Write-Step '验证后端接口与数据库'
        $null = Test-BackendLogin
    }

    Show-AccessInfo

    if (-not $frontendOk) {
        Write-WarnLine '前端尚未监听 :5173,现在打开页面可能报错。日志:'
        Write-Info '  docker exec nexus-dev tail -n 100 /var/log/frontend.log'
        return
    }

    if (-not $NoBrowser) {
        try {
            Start-Process $FrontendUrl | Out-Null
            Write-Info '已在默认浏览器打开前端页面。'
        } catch {
            Write-Info "请手动打开:$FrontendUrl"
        }
    }
}

function Invoke-Down {
    Assert-Docker
    Write-Step '停止容器(数据保留在卷里)'
    Invoke-Compose -ComposeArgs @('down')
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'docker compose down 失败' }
    Write-Ok '已停止。数据仍在 mysql-data 卷里,下次 up 直接复用。'
}

function Invoke-Restart {
    Assert-Docker
    Write-Step '重启容器'
    Invoke-Compose -ComposeArgs @('restart')
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'docker compose restart 失败' }
    Write-Ok '已重启(入口脚本会重跑一遍幂等的建库/导脚本)'
}

function Invoke-Logs {
    Assert-Docker
    Write-Info '跟随容器日志(Ctrl+C 退出)。前后端各自的日志文件在容器内:'
    Write-Info '  docker exec nexus-dev tail -f /var/log/backend.log'
    Write-Info '  docker exec nexus-dev tail -f /var/log/frontend.log'
    Write-Host ''
    Invoke-Compose -ComposeArgs @('logs', '-f', 'dev')
}

function Invoke-Status {
    Assert-Docker
    Write-Step '容器状态'
    Invoke-Compose -ComposeArgs @('ps')
    Write-Host ''
    Write-Step '端口就绪情况'
    foreach ($svc in @(@{ N = '后端'; U = $BackendUrl }, @{ N = '前端'; U = $FrontendUrl })) {
        $code = Test-HttpReady -Url $svc.U
        if ($null -ne $code) {
            Write-Ok "$($svc.N) 在应答($($svc.U) -> HTTP $code)"
        } else {
            Write-WarnLine "$($svc.N) 无响应($($svc.U))"
        }
    }
    Write-Host ''
    Write-Info '提示:刚启动时后端要几十秒才监听,属正常。'
}

function Invoke-Shell {
    Assert-Docker
    Write-Info '进入容器(exit 退出)'
    Invoke-Compose -ComposeArgs @('exec', 'dev', 'bash')
}

function Invoke-Reset {
    Assert-Docker
    Write-Host ''
    Write-WarnLine '这会**删除数据库卷**:所有库表与数据清空,'
    Write-WarnLine '下次启动重新导入 sql/ 下的建表脚本(回到全新状态)。'
    Write-Host ''
    $answer = Read-Host '确认删除?输入 yes 继续,其它任意输入取消'
    if ($answer -ne 'yes') {
        Write-Info '已取消,什么都没做。'
        return
    }
    Write-Step '停止容器并删除数据卷'
    Invoke-Compose -ComposeArgs @('down', '-v')
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'docker compose down -v 失败' }
    Write-Ok '已清空。下次 up 会重新初始化 MySQL 并导入建表脚本。'
}

function Invoke-Pull {
    Assert-Docker
    Write-Step '拉取环境镜像'
    Invoke-Compose -ComposeArgs @('pull')
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError '拉取失败。确认镜像已发布、网络可达;私有包需先 docker login ghcr.io。'
    }
    Write-Ok '镜像已就绪'
}

function Invoke-Build {
    Assert-Docker
    $imageName = Get-EnvImageName
    Write-Step "用本机代码构建环境镜像$(if ($imageName) { "($imageName)" })"
    Write-Info '首次约 10 分钟(装 MySQL/Maven/Node,并预热前后端依赖);有缓存时很快。'
    Invoke-Compose -ComposeArgs @('build')
    if ($LASTEXITCODE -ne 0) { Stop-WithError '构建失败,请看上面的输出' }
    Write-Ok '构建完成'
}

switch ($Command) {
    'up' { Invoke-Up }
    'down' { Invoke-Down }
    'restart' { Invoke-Restart }
    'logs' { Invoke-Logs }
    'status' { Invoke-Status }
    'shell' { Invoke-Shell }
    'reset' { Invoke-Reset }
    'pull' { Invoke-Pull }
    'build' { Invoke-Build }
}
