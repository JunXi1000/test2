#!/usr/bin/env bash
# ============================================================================
#  停止 Nexus Market 开发容器(macOS / Linux)
#
#  数据会保留:mysql-data 卷不会被删,下次 `bash start.sh` 接着用。
#  想把数据库一起清掉:`bash dev.sh reset`
# ============================================================================
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/docker/scripts/dev.sh" down "$@"
