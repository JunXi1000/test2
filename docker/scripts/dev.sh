#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Nexus Market 开发环境一键脚本(macOS / Linux)
#
# 给「刚 clone 下来的人」用:不需要装 JDK / Maven / Node / MySQL,也不需要手动建库导表。
# 一条命令完成「拉镜像 -> 起容器 -> 等前后端就绪 -> 验证后端接口 -> 打开浏览器」。
#
# 用法:
#   ./start.sh                  等价于 dev.sh up
#   ./stop.sh                   停止(数据保留)
#   docker/scripts/dev.sh logs  跟随容器日志
#   docker/scripts/dev.sh up --rebuild
#
# 子命令:up | down | restart | logs | status | shell | reset | pull | build
# ─────────────────────────────────────────────────────────────────────────
#
# 为什么必须用 bash 而不是 sh:下面用 bash 的 /dev/tcp 探端口(dash 没有这个能力)。
# 所以不能写 `sh dev.sh`,也不要把它当 POSIX 脚本改。
if [ -z "${BASH_VERSION:-}" ]; then
  echo "请用 bash 运行: bash $0 $*" >&2
  exit 1
fi

# 刻意**不用** `set -e`:这里大量依赖 docker 的退出码做分支(如「pull 失败就退回构建」),
# 而 set -e 会在 `cmd || fallback` 之外的地方把可预期的失败变成直接退出。
# 因此所有失败点都显式判断。

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${DOCKER_DIR}/docker-compose.yml"

FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:1000"

# ── docker compose 探测:优先插件版(v2),退回独立的 docker-compose(v1) ──
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  COMPOSE=()
fi

# 用 --project-directory 而不是 `cd docker`:两条路径等价(项目名都取 docker,
# .env 都从 docker/ 读),但不改动调用者的工作目录。
if [ "${#COMPOSE[@]}" -gt 0 ]; then
  COMPOSE+=("--project-directory" "${DOCKER_DIR}" "-f" "${COMPOSE_FILE}")
fi

# ── 输出 ─────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  C_STEP=$'\033[36m'; C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_STEP=''; C_OK=''; C_WARN=''; C_ERR=''; C_OFF=''
fi

step() { printf '%s==> %s%s\n' "${C_STEP}" "$1" "${C_OFF}"; }
ok()   { printf '%s  [OK] %s%s\n' "${C_OK}" "$1" "${C_OFF}"; }
info() { printf '  %s\n' "$1"; }
warn() { printf '%s  [!] %s%s\n' "${C_WARN}" "$1" "${C_OFF}"; }
fail() { printf '%s  [x] %s%s\n' "${C_ERR}" "$1" "${C_OFF}"; }
die()  { fail "$1"; printf '\n'; exit 1; }

# ── 子命令 ───────────────────────────────────────────────────────────────
COMMAND="up"
NO_BROWSER=0
REBUILD=0

usage() {
  cat <<'EOF'
用法: dev.sh [子命令] [选项]

子命令:
  up        拉镜像并启动,等就绪(默认)
  down      停止容器(数据保留)
  restart   重启容器
  logs      跟随容器日志(Ctrl+C 退出)
  status    查看容器状态与端口就绪情况
  shell     进入容器 bash
  reset     停止并删除数据库卷(下次启动重新导建表脚本,数据全丢)
  pull      只拉取环境镜像
  build     只用本机代码构建环境镜像

选项:
  --no-browser  up 成功后不自动打开浏览器
  --rebuild     up 时强制重新构建镜像(改了 Dockerfile 或依赖清单后需要)
  -h, --help    显示本帮助
EOF
}

if [ $# -gt 0 ]; then
  case "$1" in
    -h|--help|help) usage; exit 0 ;;
    -*) ;;                       # 直接给选项,子命令用默认值 up
    *) COMMAND="$1"; shift ;;
  esac
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --no-browser) NO_BROWSER=1 ;;
    --rebuild)    REBUILD=1 ;;
    -h|--help)    usage; exit 0 ;;
    *) printf '未知参数: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

case "${COMMAND}" in
  up|down|restart|logs|status|shell|reset|pull|build) ;;
  *) printf '未知子命令: %s\n\n' "${COMMAND}" >&2; usage >&2; exit 2 ;;
esac

# ── 环境检查 ─────────────────────────────────────────────────────────────
assert_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail '找不到 docker 命令。'
    info 'macOS:  brew install --cask docker   (或从 docker.com 下载 Docker Desktop)'
    info 'Linux:  见 https://docs.docker.com/engine/install/'
    printf '\n'
    exit 1
  fi

  if [ "${#COMPOSE[@]}" -eq 0 ]; then
    fail '找不到 docker compose(既没有 `docker compose` 插件,也没有独立的 docker-compose)。'
    info 'Docker Desktop 自带 compose 插件;Linux 上可装 docker-compose-plugin。'
    printf '\n'
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    fail 'Docker 守护进程没有在运行(命令装了,但引擎没起)。'
    info 'macOS/Windows: 启动 Docker Desktop,等状态变成 Engine running。'
    info 'Linux:         sudo systemctl start docker'
    printf '\n'
    exit 1
  fi
}

# ── 服务就绪探测 ─────────────────────────────────────────────────────────
# ⚠️ **不能用「TCP 能连上」当就绪信号**——这是实测踩到的坑,不是洁癖:
#    Docker 的端口发布是「宿主侧代理监听 + 转发」,代理在容器里的应用还没开始监听时
#    就已经 accept 了连接。实测:后端还在编译、Vite 连日志文件都还没生成时,TCP 连接就已经成功
#    ⇒ 脚本提前报「就绪」,紧接着登录验证又失败,还会去开浏览器。
#
# 正确判据是**收到一个 HTTP 响应**,哪怕状态码是 401/403/404:
#   · 后端 `/` 未登记在授权表里,默认拒绝回 401/403 —— 能回就说明 Tomcat 在应答;
#   · Vite `/` 回 200。
# curl 拿不到响应(状态码 000 / 命令失败)才是「还没起来」。
port_open() {
  (exec 3<>"/dev/tcp/$1/$2") >/dev/null 2>&1 && return 0
  if command -v nc >/dev/null 2>&1; then
    nc -z "$1" "$2" >/dev/null 2>&1 && return 0
  fi
  return 1
}

# 就绪探测:就绪则把说明写进 READY_DETAIL 并返回 0
# $1=url $2=host $3=port
probe_ready() {
  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null)"
    case "${code}" in
      ''|000) return 1 ;;
      *) READY_DETAIL="HTTP ${code}"; return 0 ;;
    esac
  fi
  # 兜底:没有 curl 时只能退回 TCP —— 注意这条路径会**提前**报就绪(见上方说明)
  if port_open "$2" "$3"; then
    READY_DETAIL='TCP 已连接(无 curl,判据较弱)'
    return 0
  fi
  return 1
}

# $1=名称 $2=url $3=host $4=port $5=超时秒
wait_http() {
  printf '  等待 %s (%s) 就绪,最多 %ss ' "$1" "$2" "$5"
  i=0
  while [ "$i" -lt "$5" ]; do
    if probe_ready "$2" "$3" "$4"; then
      printf '%s  就绪(%s,%ss)%s\n' "${C_OK}" "${READY_DETAIL}" "$i" "${C_OFF}"
      return 0
    fi
    if [ $((i % 3)) -eq 0 ]; then printf '.'; fi   # 每 3 秒点一个,避免刷屏
    i=$((i + 1))
    sleep 1
  done
  printf '%s  超时%s\n' "${C_ERR}" "${C_OFF}"
  return 1
}

# ── 后端接口冒烟:证明「MySQL + 建表导脚本 + 后端连库」整条链路真的通了 ──
backend_login_ok() {
  if ! command -v curl >/dev/null 2>&1; then
    warn '未找到 curl,跳过接口冒烟测试(不影响使用)。'
    return 2
  fi

  resp="$(curl -s -m 20 -X POST "${BACKEND_URL}/common/login" \
      -H 'Content-Type: application/json; charset=utf-8' \
      -d '{"type":"ADMIN","username":"admin","password":"123456"}' 2>/dev/null)"

  if [ -z "${resp}" ]; then
    warn '后端登录接口没有响应。'
    warn '容器可能还在启动,或数据库导脚本未完成。看日志:docker/scripts/dev.sh logs'
    return 1
  fi

  if printf '%s' "${resp}" | grep -Eq '"code"[[:space:]]*:[[:space:]]*200'; then
    ok '后端接口 + 数据库连通(admin 登录成功,返回 JWT)'
    return 0
  fi

  warn "后端有响应但登录未成功:${resp}"
  warn '若数据库刚初始化完,稍等几秒重试;仍失败请看容器日志。'
  return 1
}

show_access_info() {
  printf '\n'
  printf '%s  ==============================================================%s\n' "${C_STEP}" "${C_OFF}"
  printf '%s   Nexus Market 开发环境%s\n' "${C_STEP}" "${C_OFF}"
  printf '%s  ==============================================================%s\n' "${C_STEP}" "${C_OFF}"
  info "前端页面    ${FRONTEND_URL}"
  info "后端 API    ${BACKEND_URL}"
  info '  MySQL       容器内 localhost:3306(库 template_v3;仅宿主机回环可达)'
  printf '\n'
  info '  演示账号(密码统一 123456):'
  info '    管理员 admin    买家 user1    商家 shop1'
  printf '\n'
  info '  常用命令:'
  info '    ./stop.sh                              停止(数据保留)'
  info '    docker/scripts/dev.sh logs             跟随容器日志'
  info '    docker/scripts/dev.sh shell            进入容器'
  info '    docker exec nexus-dev tail -f /var/log/backend.log'
  printf '\n'
}

open_browser() {
  if [ "${NO_BROWSER}" -eq 1 ]; then return 0; fi
  if command -v open >/dev/null 2>&1; then
    open "${FRONTEND_URL}" >/dev/null 2>&1 && info '已在默认浏览器打开前端页面。' && return 0
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${FRONTEND_URL}" >/dev/null 2>&1 && info '已在默认浏览器打开前端页面。' && return 0
  fi
  info "请手动打开:${FRONTEND_URL}"
}

# ── 实现 ─────────────────────────────────────────────────────────────────
do_up() {
  assert_docker

  step '拉取环境镜像(拉不到会自动退回本机构建)'
  image_name="$("${COMPOSE[@]}" config --images 2>/dev/null | head -n 1)"
  [ -n "${image_name}" ] && info "镜像: ${image_name}"

  pull_ok=1
  "${COMPOSE[@]}" pull || pull_ok=0

  image_local=0
  if [ -n "${image_name}" ] && docker image inspect "${image_name}" >/dev/null 2>&1; then
    image_local=1
  fi

  if [ "${pull_ok}" -eq 1 ]; then
    ok '环境镜像已就绪'
  else
    warn '拉取失败:镜像可能尚未发布到 ghcr.io、网络不通,或该包是私有的需要先登录。'
    if [ "${image_local}" -eq 1 ]; then
      info '本地已有同名镜像,将直接用它启动。'
      info '如果刚改过 docker/ 下的文件,请加 --rebuild 强制重建。'
    else
      warn '若它在 GHCR 上是私有包,请先执行: docker login ghcr.io -u <你的GitHub用户名>'
      warn '本地也没有该镜像,改为**本机构建**(首次约 10 分钟:装 MySQL/Maven/Node + 预热依赖)。'
    fi
  fi

  step '启动容器(MySQL + 后端 + 前端)'
  if [ "${REBUILD}" -eq 1 ]; then
    "${COMPOSE[@]}" up -d --build || die 'docker compose up 失败。完整日志: docker/scripts/dev.sh logs'
  else
    "${COMPOSE[@]}" up -d || die 'docker compose up 失败。完整日志: docker/scripts/dev.sh logs'
  fi
  ok '容器已在后台运行'

  step '等待服务就绪'
  # 容器内是「先等后端起来再起 Vite」(见 entrypoint.sh),所以按顺序查即可。
  # 后端首帧要 Maven 编译 + Spring Boot 启动 + 连库:预热命中实测约 2 分钟
  # (其中应用自身启动 ~53s,其余是编译与依赖补齐);冷启动(现下载依赖)可能 5-10 分钟,所以给 600s。
  wait_http '后端' "${BACKEND_URL}/" localhost 1000 600
  backend_ok=$?
  wait_http '前端' "${FRONTEND_URL}/" localhost 5173 180
  frontend_ok=$?

  if [ "${backend_ok}" -ne 0 ]; then
    warn '后端 600s 内未监听 :1000。看后端日志:'
    info '  docker exec nexus-dev tail -n 100 /var/log/backend.log'
    info '  (首次构建 + 预热依赖确实可能更久;也可能是构建阶段就失败了)'
  fi

  if [ "${backend_ok}" -eq 0 ]; then
    step '验证后端接口与数据库'
    backend_login_ok
  fi

  show_access_info

  if [ "${frontend_ok}" -ne 0 ]; then
    warn '前端尚未监听 :5173,现在打开页面可能报错。日志:'
    info '  docker exec nexus-dev tail -n 100 /var/log/frontend.log'
    return 0
  fi

  open_browser
}

do_down() {
  assert_docker
  step '停止容器(数据保留在卷里)'
  "${COMPOSE[@]}" down || die 'docker compose down 失败'
  ok '已停止。数据仍在 mysql-data 卷里,下次 up 直接复用。'
}

do_restart() {
  assert_docker
  step '重启容器'
  "${COMPOSE[@]}" restart || die 'docker compose restart 失败'
  ok '已重启(入口脚本会重跑一遍幂等的建库/导脚本)'
}

do_logs() {
  assert_docker
  info '跟随容器日志(Ctrl+C 退出)。前后端各自的日志文件在容器内:'
  info '  docker exec nexus-dev tail -f /var/log/backend.log'
  info '  docker exec nexus-dev tail -f /var/log/frontend.log'
  printf '\n'
  "${COMPOSE[@]}" logs -f dev
}

do_status() {
  assert_docker
  step '容器状态'
  "${COMPOSE[@]}" ps
  printf '\n'
  step '端口就绪情况'
  if probe_ready "${BACKEND_URL}/" localhost 1000; then
    ok "后端在应答(${BACKEND_URL}/ -> ${READY_DETAIL})"
  else
    warn "后端无响应(${BACKEND_URL}/)"
  fi
  if probe_ready "${FRONTEND_URL}/" localhost 5173; then
    ok "前端在应答(${FRONTEND_URL}/ -> ${READY_DETAIL})"
  else
    warn "前端无响应(${FRONTEND_URL}/)"
  fi
  printf '\n'
  info '提示:刚启动时后端要几十秒才监听,属正常。'
}

do_shell() {
  assert_docker
  info '进入容器(exit 退出)'
  "${COMPOSE[@]}" exec dev bash
}

do_reset() {
  assert_docker
  printf '\n'
  warn '这会**删除数据库卷**:所有库表与数据清空,'
  warn '下次启动重新导入 sql/ 下的建表脚本(回到全新状态)。'
  printf '\n'
  printf '确认删除?输入 yes 继续,其它任意输入取消: '
  read -r answer
  if [ "${answer}" != 'yes' ]; then
    info '已取消,什么都没做。'
    return 0
  fi
  step '停止容器并删除数据卷'
  "${COMPOSE[@]}" down -v || die 'docker compose down -v 失败'
  ok '已清空。下次 up 会重新初始化 MySQL 并导入建表脚本。'
}

do_pull() {
  assert_docker
  step '拉取环境镜像'
  "${COMPOSE[@]}" pull || die '拉取失败。确认镜像已发布、网络可达;私有包需先 docker login ghcr.io。'
  ok '镜像已就绪'
}

do_build() {
  assert_docker
  image_name="$("${COMPOSE[@]}" config --images 2>/dev/null | head -n 1)"
  if [ -n "${image_name}" ]; then
    step "用本机代码构建环境镜像(${image_name})"
  else
    step '用本机代码构建环境镜像'
  fi
  info '首次约 10 分钟(装 MySQL/Maven/Node,并预热前后端依赖);有缓存时很快。'
  "${COMPOSE[@]}" build || die '构建失败,请看上面的输出'
  ok '构建完成'
}

case "${COMMAND}" in
  up)      do_up ;;
  down)    do_down ;;
  restart) do_restart ;;
  logs)    do_logs ;;
  status)  do_status ;;
  shell)   do_shell ;;
  reset)   do_reset ;;
  pull)    do_pull ;;
  build)   do_build ;;
esac
