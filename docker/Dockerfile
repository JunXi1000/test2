# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────
# Nexus Market 全栈开发环境镜像(只打包「环境」,不打包项目代码)
#
# 包含:
#   - JDK 17(eclipse-temurin,后端 Spring Boot 3.2 所需)
#   - Maven 3.9.9(后端构建/测试/启动)
#   - Node 24 + npm(NodeSource 官方源,前端 Vite 5 所需)
#   - MySQL 8(mysql-server,后端数据库,含时区/工具/curl/git/vim)
#   - **预热的 Maven 依赖(/root/.m2)与前端依赖(/opt/prewarm/web-node_modules)**
#
# 用法(任选):
#   docker compose -f docker/docker-compose.yml up -d        # 有镜像就直接跑
#   或 docker build -f docker/Dockerfile -t <registry>/nexus-dev-env:1.0 .
#
# 项目代码不在镜像内,运行时通过卷挂载到 /workspace(见 docker-compose.yml)。
# 容器入口 entrypoint.sh 会启动 MySQL 并在首次运行时按 /workspace/sql 自动建库导表。
#
# ── 关于「依赖预热」(第 5 步) ────────────────────────────────────────────
# 目的:让**别人 `docker pull` 之后首次启动≈2 分钟**,而不是现下载 Maven/npm 依赖等 5-10 分钟。
# 做法:构建时只用 pom.xml / package.json / package-lock.json(不 COPY 源码)把依赖抓下来。
#   · 为什么不 COPY src:一旦 COPY 源码,改任何一行 Java 都会让这一层缓存失效、
#     整个依赖下载重跑。只用清单文件则「改代码不触发重新预热」。
#   · 代价:预热让镜像多出约 0.58GB(实测 Maven /root/.m2 121-158MB + 前端 node_modules 423MB),
#     整体镜像实测 2.68GB。第一次 pull 慢一点,之后一直快。
#   · 版本漂移:改了 pom.xml / package-lock.json 必须**重新构建并推送**镜像,
#     否则镜像里预热的是旧依赖。运行期 entrypoint 前后端各有一道校验兜底(见 entrypoint.sh)。
# ─────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:17-jdk

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Shanghai \
    MAVEN_VERSION=3.9.9 \
    MAVEN_HOME=/opt/maven \
    NODE_MAJOR=24 \
    PATH="/opt/maven/bin:$PATH" \
    # 容器启动时可用 -e 覆盖(见 README 环境变量表)
    MYSQL_ROOT_PASSWORD=123456 \
    MYSQL_DATABASE=template_v3 \
    MYSQL_DATA_DIR=/var/lib/mysql \
    # 默认自动启动挂载的前后端("拉取即用");纯环境用可设 AUTO_START=false
    AUTO_START=true \
    # 前端依赖预热目录(entrypoint 从这里秒级恢复到 /workspace/web/node_modules)
    WEB_PREWARM_DIR=/opt/prewarm/web-node_modules

# 1) 系统工具 + 时区 + MySQL 8 服务端
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        mysql-server \
        mysql-client \
        git \
        curl \
        wget \
        unzip \
        vim \
        gnupg \
        ca-certificates \
        tzdata \
        procps \
    && ln -sf /usr/share/zoneinfo/${TZ} /etc/localtime \
    && echo "${TZ}" > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# 2) Maven(固定版本,保证可复现)
RUN wget -q "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
        -O /tmp/maven.tgz \
    && mkdir -p "${MAVEN_HOME}" \
    && tar -xzf /tmp/maven.tgz -C "${MAVEN_HOME}" --strip-components=1 \
    && rm -f /tmp/maven.tgz \
    && mvn --version

# 3) Node 24 + npm(NodeSource 官方源,自动取 24.x 最新补丁)
RUN curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version \
    && npm --version

# 4) 容器入口:启动 MySQL + 首次自动建库导表
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 5) 依赖预热 ─────────────────────────────────────────────────────────────
# 5a) 后端:把 pom.xml 的依赖(含 spring-boot-maven-plugin)抓进 /root/.m2。
#     compose 的 `m2cache:/root/.m2` 命名卷在**首次创建**时会用镜像里这份内容初始化,
#     于是容器第一次 `mvn spring-boot:run` 不必再下载。
#     go-offline 偶尔会漏(它按 POM 静态解析,拿不到插件运行期才拉的坐标),失败就退化为
#     resolve;两者都失败也不中断构建 —— 预热是「快」的优化,不是「能不能跑」的前提。
COPY pom.xml /tmp/prewarm/pom.xml
RUN cd /tmp/prewarm \
    && { mvn -B -q dependency:go-offline \
         || { echo "!! go-offline 失败,退化为 dependency:resolve(预热可能不完整,不影响可用性)"; \
              mvn -B -q dependency:resolve; }; } \
    && { mvn -B -q spring-boot:help -Ddetail=false >/dev/null 2>&1 \
         || echo "!! spring-boot 插件预热跳过(不影响可用性)"; } \
    && rm -rf /tmp/prewarm \
    && du -sh /root/.m2

# 5b) 前端:按 package-lock.json 做 `npm ci`(严格锁文件,保证可复现),
#     装好后**挪到 /opt/prewarm**,不留在 /workspace/web —— 那里运行时挂的是命名卷。
#     同时写入锁文件指纹:entrypoint 只在指纹一致时才敢直接用它,否则说明依赖改过,
#     会老实回退到 `npm ci`(宁可慢,不能拿错版本的 node_modules 起前端)。
#     PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1:Playwright 浏览器应按需 `npx playwright install`,
#     烤进镜像只会白多几百 MB(README 的 e2e 流程本来就是手动装 chromium)。
#     /root/.npm 缓存顺带留在镜像里:锁文件变更走回退路径时,`npm ci --prefer-offline` 靠它提速。
COPY web/package.json /tmp/prewarm-web/
# ⚠️ 锁文件用 `jso[n]` 通配写,是**必需的防御**:这只是本仓库当下把
#    web/package-lock.json 排除进了 .gitignore(现已改为入库),一旦它再次缺席,
#    写成固定路径的 COPY 会让**整个镜像构建直接失败在这一行**。
#    多源 COPY 里有 package.json 兜底,所以这个通配不匹配时 Docker 只是跳过,不报错。
COPY web/package-lock.jso[n] /tmp/prewarm-web/
RUN cd /tmp/prewarm-web \
    && mkdir -p /opt/prewarm \
    && if [ -f package-lock.json ]; then LOCKED=1; else LOCKED=0; fi \
    && if [ "${LOCKED}" = "1" ]; then \
         echo "==> 按 package-lock.json 执行 npm ci(版本锁定)"; \
         PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund; \
       else \
         echo "!! 构建输入里没有 web/package-lock.json,退化为 npm install(版本未锁定)"; \
         PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund; \
       fi \
    && mv node_modules /opt/prewarm/web-node_modules \
    && if [ "${LOCKED}" = "1" ]; then \
         sha256sum package-lock.json | awk '{print $1}' > /opt/prewarm/package-lock.sha256; \
       else \
         echo "    不写指纹:没有锁文件可校验,entrypoint 侧也会走 npm install"; \
       fi \
    && rm -rf /tmp/prewarm-web \
    && du -sh /opt/prewarm/web-node_modules

WORKDIR /workspace
EXPOSE 1000 3306 5173
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
