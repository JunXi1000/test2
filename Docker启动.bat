@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  会议白板助手 - Docker 一键启动
REM  前置要求: 安装 Docker Desktop 并确保已启动
REM  首次运行会自动构建镜像(需几分钟),后续启动秒级完成
REM ============================================================

echo.
echo [1/4] 检查 Docker 是否可用...
docker version >nul 2>&1
if errorlevel 1 (
    echo.
    echo   [错误] 未检测到 Docker。请先安装并启动 Docker Desktop:
    echo   https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)
echo        Docker 已就绪

echo.
echo [2/4] 构建并启动容器 (首次约 5~15 分钟,取决于网络)...
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo   [错误] 容器启动失败,请查看上方日志。
    pause
    exit /b 1
)

echo.
echo [3/4] 等待后端就绪...
timeout /t 15 /nobreak >nul

echo.
echo [4/4] 打开浏览器...
start "" http://localhost:5173

echo.
echo ============================================================
echo  启动完成!
echo
echo   前端:     http://localhost:5173
echo   后端:     http://localhost:1000
echo   MySQL:    localhost:3307  (root / 123456)
echo
echo  演示账号 (密码均为 123456):
echo   管理员:   admin
echo   买家:     user1
echo   商家:     shop1
echo
echo  常用命令:
echo   查看状态   docker compose ps
echo   查看日志   docker compose logs -f backend
echo   停止服务   docker compose down
echo   彻底清除   docker compose down -v
echo ============================================================
echo.
pause
