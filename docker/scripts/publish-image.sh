#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# 构建并推送「开发环境镜像」到 ghcr.io(维护者用,不是给使用者用的)
#
# 用法:
#   bash docker/scripts/publish-image.sh              # 构建并推送 tag 1.0
#   bash docker/scripts/publish-image.sh 1.1          # 指定 tag
#   MULTIARCH=1 bash docker/scripts/publish-image.sh  # 同时构建 amd64 + arm64
#
# 前置条件:
#   1. docker login ghcr.io -u <你的GitHub用户名>
#      口令**不是**账号密码,而是 Personal Access Token(classic),
#      勾选 write:packages(读包权限 read:packages 也建议一并勾上)。
#   2. 推完之后,去 GitHub → 你的 Profile → Packages → nexus-dev-env → Package settings,
#      把可见性改成 **public**。GHCR 的包默认是私有的,别人 pull 会 401 —— 这是最容易漏的一步。
#
# 为什么 arm64 要单独说:Windows/Linux 上本机构建出来的是 amd64 镜像,
# Apple Silicon 的 Mac 只能在模拟下跑(能用,但启动和后端编译明显变慢)。
# 需要原生就得用 MULTIARCH=1(走 buildx + QEMU,构建时间大约翻倍)。
# GitHub Actions 那份工作流(.github/workflows/dev-env-image.yml)默认就是双架构。
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${DOCKER_DIR}/.." && pwd)"

TAG="${1:-1.0}"
MULTIARCH="${MULTIARCH:-0}"

# 与 docker-compose.yml 的默认值保持一致(那里是 ${DEV_ENV_IMAGE:-ghcr.io/junxi1000/nexus-dev-env:1.0})。
# 导出它,让 compose 的 build/push 与这里用的是同一个名字。
export DEV_ENV_IMAGE="${DEV_ENV_IMAGE:-ghcr.io/junxi1000/nexus-dev-env:${TAG}}"

echo "==> 目标镜像: ${DEV_ENV_IMAGE}"

if ! command -v docker >/dev/null 2>&1; then
  echo "  [x] 找不到 docker 命令" >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "  [x] Docker 守护进程没有在运行,请先启动 Docker Desktop" >&2
  exit 1
fi

COMPOSE=(docker compose)
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE=(docker-compose)
  else
    echo "  [x] 找不到 docker compose" >&2
    exit 1
  fi
fi
COMPOSE+=("--project-directory" "${DOCKER_DIR}" "-f" "${DOCKER_DIR}/docker-compose.yml")

if [ "${MULTIARCH}" = "1" ]; then
  echo "==> 多架构构建(linux/amd64 + linux/arm64),这一步明显更慢"
  if ! docker buildx version >/dev/null 2>&1; then
    echo "  [x] 需要 docker buildx。Docker Desktop 自带;Linux 上可 docker buildx create --use" >&2
    exit 1
  fi
  # 只有 --push 才能把多架构结果落到 registry(list 格式无法 load 进本地镜像库)。
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -f "${DOCKER_DIR}/Dockerfile" \
    -t "${DEV_ENV_IMAGE}" \
    --push \
    "${REPO_DIR}"
else
  echo "==> 构建(本机架构)"
  "${COMPOSE[@]}" build
  echo "==> 推送"
  "${COMPOSE[@]}" push
fi

cat <<EOF

==> 完成: ${DEV_ENV_IMAGE}

   别人现在可以:
     ./start.sh          (macOS/Linux)
     start.bat           (Windows,双击)

   如果对方 pull 时报 401/denied,99% 是包还是私有的 —— 去
   GitHub → Profile → Packages → nexus-dev-env → Package settings 改成 public。
EOF
