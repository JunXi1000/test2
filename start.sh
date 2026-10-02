#!/usr/bin/env bash
# ============================================================================
#  Nexus Market 一键启动(macOS / Linux)
#
#  用法:  bash start.sh            # 拉镜像 -> 起容器 -> 等就绪 -> 开浏览器
#         bash start.sh --rebuild  # 强制重建镜像(改了 Dockerfile / 依赖清单后)
#
#  首次 clone 后本文件可能没有可执行位(取决于仓库里的文件模式),所以文档统一写
#  `bash start.sh`。想用 `./start.sh` 就先跑一次:
#         chmod +x start.sh stop.sh logs.sh dev.sh docker/scripts/dev.sh
#
#  真正的逻辑在 docker/scripts/dev.sh(那边有全套子命令:status / logs / shell / reset ...)。
# ============================================================================
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/docker/scripts/dev.sh" up "$@"
