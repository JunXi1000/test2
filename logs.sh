#!/usr/bin/env bash
# ============================================================================
#  跟随 Nexus Market 开发容器日志(macOS / Linux)。Ctrl+C 退出。
#
#  前后端各自的日志文件在容器内:
#      docker exec nexus-dev tail -f /var/log/backend.log
#      docker exec nexus-dev tail -f /var/log/frontend.log
# ============================================================================
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/docker/scripts/dev.sh" logs "$@"
