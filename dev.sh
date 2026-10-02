#!/usr/bin/env bash
# ============================================================================
#  Nexus Market 开发环境通用入口(macOS / Linux)
#
#      bash dev.sh up         拉镜像 + 启动 + 等就绪     (等同 start.sh)
#      bash dev.sh down       停止                       (等同 stop.sh)
#      bash dev.sh restart    重启容器
#      bash dev.sh logs       跟随容器日志               (等同 logs.sh)
#      bash dev.sh status     容器状态 + 端口就绪情况
#      bash dev.sh shell      进入容器 bash
#      bash dev.sh reset      停止并删除数据库卷
#      bash dev.sh pull       只拉取环境镜像
#      bash dev.sh build      只用本机代码构建镜像
#
#  选项:--rebuild(强制重建)  --no-browser(不打开浏览器)
# ============================================================================
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/docker/scripts/dev.sh" "$@"
