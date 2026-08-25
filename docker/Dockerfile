# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────────────────
# Nexus Market 全栈开发环境镜像(只打包「环境」,不打包项目代码)
#
# 包含:
#   - JDK 17(eclipse-temurin,后端 Spring Boot 3.2 所需)
#   - Maven 3.9.9(后端构建/测试/启动)
#   - Node 24 + npm(NodeSource 官方源,前端 Vite 5 所需)
#   - MySQL 8(mysql-server,后端数据库,含时区/工具/curl/git/vim)
#
# 用法(任选):
#   docker compose -f docker/docker-compose.yml up -d --build
#   或 docker build -f docker/Dockerfile -t <registry>/nexus-dev-env:1.0 .
#
# 项目代码不在镜像内,运行时通过卷挂载到 /workspace(见 docker-compose.yml)。
# 容器入口 entrypoint.sh 会启动 MySQL 并在首次运行时按 /workspace/sql 自动建库导表。
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
    AUTO_START=true

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

WORKDIR /workspace
EXPOSE 1000 3306 5173
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
