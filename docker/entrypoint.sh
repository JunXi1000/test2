#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Nexus Market 开发环境容器入口
#   1. 首次运行初始化 MySQL 数据目录
#   2. 启动 mysqld(0.0.0.0:3306,已 publish 给宿主机)
#   3. 幂等设置 root 密码 + 创建项目库 template_v3
#   4. 首次运行若挂载了项目( /workspace/sql 存在),自动按依赖顺序导入建表脚本
#   5. 无附加命令则等待 mysqld 保活;有附加命令则 exec 之(如 docker run image bash)
#
# 说明:镜像不含项目代码;代码通过卷挂载到 /workspace。
#       中文 SQL 导入一律带 --default-character-set=utf8mb4,否则双重编码乱码。
# ─────────────────────────────────────────────────────────────────────────
set -e

DATA_DIR="${MYSQL_DATA_DIR:-/var/lib/mysql}"
DB="${MYSQL_DATABASE:-template_v3}"
PW="${MYSQL_ROOT_PASSWORD}"
# 安全:显式置空密码会回落默认弱口令(易被误以为"已禁用鉴权"),直接拒绝启动
if [ -z "${MYSQL_ROOT_PASSWORD}" ]; then
  echo "!! MYSQL_ROOT_PASSWORD 被置空:禁止以默认密码 123456 回落,请显式设置密码" >&2
  exit 1
fi
SOCKET="/var/run/mysqld/mysqld.sock"
PIDFILE="/var/run/mysqld/mysqld.pid"

mkdir -p /var/run/mysqld
chown -R mysql:mysql /var/run/mysqld

# ── 1) 首次运行:初始化 MySQL 数据目录 ─────────────────────────────
if [ ! -d "${DATA_DIR}/mysql" ]; then
  echo "==> 初始化 MySQL 数据目录 ${DATA_DIR} ..."
  mkdir -p "${DATA_DIR}"
  chown -R mysql:mysql "${DATA_DIR}"
  mysqld --initialize-insecure --user=mysql --datadir="${DATA_DIR}"
fi

# ── 2) 启动 mysqld ────────────────────────────────────────────────
# --mysql-native-password=ON:MySQL 8.4 起该插件默认禁用,而项目 JDBC URL 未配
# allowPublicKeyRetrieval,非 SSL 下 caching_sha2_password 连不上,必须启用它。
echo "==> 启动 MySQL(mysqld, 0.0.0.0:3306)..."
mysqld --user=mysql \
  --datadir="${DATA_DIR}" \
  --socket="${SOCKET}" \
  --pid-file="${PIDFILE}" \
  --port=3306 \
  --bind-address=0.0.0.0 \
  --mysql-native-password=ON &
MYSQLD_PID=$!

ready=0
for _ in $(seq 1 60); do
  if mysqladmin ping -uroot --socket="${SOCKET}" --silent >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "${ready}" != "1" ]; then
  echo "!! MySQL 未在 60 秒内就绪,请查看上方日志" >&2
  exit 1
fi

# ── 3) 幂等:root 密码 + 项目库 + 放行远程连接 ─────────────────────
# 用 mysql_native_password:既有 JDBC URL 未配 allowPublicKeyRetrieval,
# caching_sha2_password 在非 SSL 下会导致连接失败。
# root@'%' 仅经 compose 的 127.0.0.1:3306 回环发布,不暴露到局域网。
# 幂等重启:首次初始化 root 为空密码 → 走空密码分支设置密码;
#          已初始化过(卷持久化,root 已有密码)→ 用 MYSQL_PWD 走同样幂等 SQL。
ensure_mysql() {
  local sql_block="
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${PW}';
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED WITH mysql_native_password BY '${PW}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
CREATE DATABASE IF NOT EXISTS \`${DB}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
FLUSH PRIVILEGES;
"
  if mysql -uroot --socket="${SOCKET}" -e "SELECT 1" >/dev/null 2>&1; then
    echo "    (root 空密码)初始化 root 密码 + 建库 ..."
    mysql -uroot --socket="${SOCKET}" <<SQL
${sql_block}
SQL
  else
    echo "    (root 已有密码)幂等确保密码/权限/库 ..."
    export MYSQL_PWD="${PW}"
    mysql -uroot --socket="${SOCKET}" <<SQL
${sql_block}
SQL
    unset MYSQL_PWD
  fi
}
ensure_mysql

# 安全提示:默认弱口令仅在 compose 的 127.0.0.1 回环发布下是安全的。
# 若要对外暴露 3306,必须先覆盖为强密码,否则局域网内任何人可用 root 连接。
if [ "${PW}" = "123456" ]; then
  echo "!! 提示: 当前使用默认 root 密码(123456)。MySQL 仅回环发布(127.0.0.1:3306);"
  echo "   如需对外暴露 3306,请先用 -e MYSQL_ROOT_PASSWORD=强密码 覆盖再改端口映射。"
fi

# ── 4) 首次运行:自动导入建表脚本(按依赖顺序) ─────────────────────
# 密码经 MYSQL_PWD 传入(不进 argv,避免 ps 泄露明文)。
export MYSQL_PWD="${PW}"
MARKER="${DATA_DIR}/.schema-imported"   # 整批完成标记(写了它就不再扫)
IMPORTED_DIR="${DATA_DIR}/.imported"    # 单个脚本各自的完成标记
if [ ! -f "${MARKER}" ] && [ -d /workspace/sql ]; then
  echo "==> 导入建表脚本(按依赖顺序,utf8mb4)..."
  IMPORT_FAILED=0
  mkdir -p "${IMPORTED_DIR}"
  # 按**文件**记完成度,而不是只记一个整批标记。
  #
  # 原先无论成败都在末尾 touch ${MARKER}:任何一次导入失败都会被永久钉死,之后每次启动都跳过,
  # 数据库残缺且永不自愈 —— 这正是「容器数据不完全」的成因。
  #
  # 但把 touch 挪进成功分支也不够:sql/schema.sql 的 6 条种子 INSERT 带显式 id、**不幂等**,
  # 整批重跑会撞主键冲突,于是变成每次启动都失败的死循环。
  # 按文件记标记则两头都避开:成功的跳过、只重试失败的。
  #
  # ⚠️ 局限:标记只到**文件**粒度。若某个脚本自己跑到一半才失败,重跑它仍会从头发起,
  #    已落库的那部分(非幂等 INSERT)照旧报重复键 —— 这种半成品只能人工清库后重导。
  import_sql() {
    local f="$1"
    local tag
    tag="$(basename "$f")"
    if [ -f "${IMPORTED_DIR}/${tag}" ]; then
      echo "    -> ${f} (上次已成功,跳过)"
      return 0
    fi
    echo "    -> ${f}"
    if mysql --default-character-set=utf8mb4 -uroot -h127.0.0.1 "${DB}" < "$f" 2>/tmp/import.err; then
      echo "      ✔ 完成: ${f}"
      touch "${IMPORTED_DIR}/${tag}"
    else
      echo "      ✗ 导入失败: ${f}" >&2
      sed 's/^/        | /' /tmp/import.err >&2 || true
      echo "        可稍后手动执行: mysql --default-character-set=utf8mb4 -h127.0.0.1 -uroot -p<密码> ${DB} < ${f}"
      IMPORT_FAILED=$((IMPORT_FAILED + 1))
    fi
  }
  # 顺序 = 依赖序:基础建表(schema,含 admin 种子) → 聊天 → 通知/优惠 → 增量迁移
  for base in \
    /workspace/sql/schema.sql \
    /workspace/sql/chat.sql \
    /workspace/sql/migration-2026-08-08-phase1.sql; do
    [ -f "$base" ] && import_sql "$base"
  done
  for f in /workspace/sql/migrations/*.sql; do
    [ -f "$f" ] && import_sql "$f"
  done
  if [ "${IMPORT_FAILED}" -eq 0 ]; then
    touch "${MARKER}"
  else
    echo "!! 有 ${IMPORT_FAILED} 个脚本导入失败,因此**不写** ${MARKER}。" >&2
    echo "   已成功的脚本下次启动会跳过,只重试失败的;修好后 docker restart $(hostname) 即可。" >&2
  fi
fi
unset MYSQL_PWD

echo ""
echo "======================================================================"
echo "  Nexus Market 开发环境已就绪"
echo "  MySQL : 127.0.0.1:3306  库=${DB}  root 密码=***"
echo "          (默认 123456,可用环境变量 MYSQL_ROOT_PASSWORD 覆盖;3306 仅宿主机回环可达)"
echo "  后端  : cd /workspace && mvn spring-boot:run          (http://localhost:1000)"
echo "  前端  : cd /workspace/web && npm run dev:lan          (http://localhost:5173)"
echo "          (依赖已由镜像预热自动恢复,无需手动 npm install)"
echo "  测试  : cd /workspace && mvn test                      (H2,无需 MySQL)"
echo "  手动导库: mysql --default-character-set=utf8mb4 -h127.0.0.1 -uroot -p<密码> ${DB} < /workspace/sql/<file>.sql"
echo "  进入容器: docker exec -it $(hostname 2>/dev/null || echo '<容器名>') bash"
echo "======================================================================"
echo ""

# ── 前端依赖:优先从镜像预热目录秒级恢复,指纹不符才回退 npm ci ──────────
# 为什么需要"恢复"而不是直接吃镜像里的:compose 把 `node_modules` 命名卷挂在
# /workspace/web/node_modules 上,而该路径在镜像里是空的(代码不打包进镜像),
# 所以卷初始化出来是空的,必须由这里显式灌进去。
#
# 指纹(package-lock.json 的 sha256)对不上就一律走 npm ci —— 宁可多等一两分钟,
# 也不能拿依赖树不一致的 node_modules 去起 Vite:那种错不会告诉你"依赖不对",
# 只会变成一堆看不懂的 plugin/版本报错。
seed_frontend_deps() {
  local nm="/workspace/web/node_modules"
  local seed="${WEB_PREWARM_DIR:-/opt/prewarm/web-node_modules}"
  local ref="/opt/prewarm/package-lock.sha256"
  local lock="/workspace/web/package-lock.json"

  # 卷里已是可用依赖(有 vite 可执行文件)→ 跳过,重启不重装
  if [ -x "${nm}/.bin/vite" ]; then
    echo "    前端依赖已就绪(命名卷),跳过安装"
    return 0
  fi

  if [ -d "${seed}" ] && [ -f "${ref}" ] && [ -f "${lock}" ]; then
    local want have
    want="$(tr -d '[:space:]' < "${ref}")"
    have="$(sha256sum "${lock}" | awk '{print $1}')"
    if [ -n "${want}" ] && [ "${want}" = "${have}" ]; then
      echo "    从镜像预热目录恢复前端依赖(秒级,无需联网)..."
      mkdir -p "${nm}"
      if cp -a "${seed}/." "${nm}/" && [ -x "${nm}/.bin/vite" ]; then
        echo "    ✔ 前端依赖已从镜像恢复(锁定 package-lock.json ${have:0:12}...)"
        return 0
      fi
      echo "    !! 预热依赖恢复失败,回退 npm ci"
      rm -rf "${nm}"
    else
      echo "    package-lock.json 与镜像预热的不一致,改用 npm ci"
      echo "      (镜像=${want:0:12}... 工作区=${have:0:12}...;重新构建并推送镜像可免掉这次下载)"
    fi
  fi

  # 没有锁文件时 npm ci 会直接报错退出(npm ci 的硬要求),所以先判一下,
  # 免得日志里出现一段看起来像故障、其实是预期降级的报错。
  if [ ! -f "${lock}" ]; then
    echo "    !! 工作区没有 web/package-lock.json,退化为 npm install(版本未锁定)"
    (cd /workspace/web && npm install --no-audit --no-fund) \
      || echo "    !! npm install 失败,请进容器手动处理:cd /workspace/web && npm install"
    return 0
  fi

  echo "    首次 npm ci(优先用镜像内 npm 缓存,通常 1-2 分钟)..."
  if ! (cd /workspace/web && npm ci --no-audit --no-fund --prefer-offline); then
    echo "    !! npm ci 失败,回退 npm install"
    (cd /workspace/web && npm install --no-audit --no-fund) \
      || echo "    !! npm install 也失败,请进容器手动处理:cd /workspace/web && npm install"
  fi
  return 0
}

# ── 5) AUTO_START=true 时自动启动挂载的前后端(Dockerfile ENV 默认 true) ──
# 关键顺序:先起后端,等它健康(监听 :1000)再起前端。
# 原因:前端 Vite 约 1s 就绪、后端约 2 分钟(预热命中;冷启动现下依赖要 5-10min),若并行起,
# 容器起来后立刻打开页面会撞上 vite 代理 500(后端尚未监听 :1000)→ 首页报错。
if [ "${AUTO_START:-false}" = "true" ]; then
  echo "==> AUTO_START=true:自动启动后端 + 前端..."
  if [ -f /workspace/pom.xml ]; then
    # Maven 仓库命中镜像预热的 /root/.m2(m2cache 命名卷首次创建时已由镜像内容初始化)。
    # 若这里仍要大量下载,多半是留着一个**已存在的空卷**:docker compose down -v 后重启。
    echo "    后端  -> mvn spring-boot:run (日志: /var/log/backend.log)"
    (cd /workspace && mvn spring-boot:run >/var/log/backend.log 2>&1) &
  else
    echo "    !! /workspace 未挂载后端项目(pom.xml 不存在),跳过后端"
  fi
  if [ -f /workspace/web/package.json ]; then
    seed_frontend_deps
    if [ "${AUTO_START_WAIT_BACKEND:-true}" = "true" ] && [ -f /workspace/pom.xml ]; then
      echo "    等待后端就绪(http://localhost:1000,最多 300s)后启动前端 ..."
      backend_ok=0
      for _ in $(seq 1 300); do
        if curl -s -o /dev/null --max-time 2 http://localhost:1000/ >/dev/null 2>&1; then
          backend_ok=1
          break
        fi
        sleep 1
      done
      if [ "${backend_ok}" = "1" ]; then
        echo "    后端已就绪(Tomcat :1000)"
      else
        echo "    !! 300s 后端仍未就绪(首次编译较慢?),继续启动前端;页面可能短暂报错"
      fi
    fi
    # 用 dev:lan(vite --host)而不是 dev —— 容器里必须绑所有网卡。
    # `dev` 走 vite.config.ts 的 host:'127.0.0.1',那在**裸机**上是对的;但 Docker 的
    # 5173:5173 是把流量 DNAT 到容器 eth0,不是容器内的回环,只绑回环则宿主机打不开
    # :5173(curl 拿到 Empty reply,exit 52)。--host 仍然监听回环,所以容器内
    # Playwright 的 baseURL(http://localhost:5173)不受影响。
    echo "    前端  -> npm run dev:lan (日志: /var/log/frontend.log)"
    (cd /workspace/web && npm run dev:lan >/var/log/frontend.log 2>&1) &
  else
    echo "    !! /workspace/web 未挂载前端项目(package.json 不存在),跳过前端"
  fi
  echo "    查看: docker exec -it <容器> bash -c 'tail -f /var/log/backend.log'"
fi

# ── 6) 有附加命令则执行之;否则等待 mysqld 保活 ────────────────────
if [ $# -gt 0 ]; then
  exec "$@"
fi
wait "${MYSQLD_PID}"
