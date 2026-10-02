# Nexus Market 开发环境镜像

> **本文只讲「镜像本身」**：里面装了什么、依赖怎么预热、怎么构建与发布。
> **怎么把项目跑起来（一键启动 / 常用命令 / 环境变量 / 裸机启动 / 故障排查）见
> [../docs/STARTUP.md](../docs/STARTUP.md)** —— 那份是启动事宜的唯一权威文档。

把**前后端运行所需环境**打包成**一个 Docker 镜像**：JDK 17 + Maven 3.9.9 + Node 24 + MySQL 8，
**外加预下载好的 Maven / npm 依赖**。项目代码**不打包进镜像**——运行时以卷挂载到 `/workspace`，
改代码即时生效，无需重建镜像。

镜像名：`ghcr.io/junxi1000/nexus-dev-env:1.0`（可用 `DEV_ENV_IMAGE` 覆盖）。

---

## 1. 镜像内容

| 组件 | 版本 | 用途 |
|------|------|------|
| JDK | 17（`eclipse-temurin:17-jdk`，Ubuntu 26.04 基础） | 后端 Spring Boot 3.2.10 |
| Maven | 3.9.9（固定版本） | 后端构建 / `mvn spring-boot:run` / `mvn test` |
| Node + npm | 24.x（NodeSource） | 前端 Vite 5 |
| MySQL | 8.4（`mysql-server`） | 后端数据库，容器内 3306 |
| 工具 | git / curl / wget / vim / unzip / tzdata（Asia/Shanghai） | 通用辅助 |
| **预热依赖** | `/root/.m2`（Maven）+ `/opt/prewarm/web-node_modules`（npm） | 免掉首次 5–10 分钟的依赖下载 |

镜像各层由 [Dockerfile](Dockerfile) 定义；入口脚本 [entrypoint.sh](entrypoint.sh) 负责建库、导脚本、
恢复前端依赖、拉起前后端。

---

## 2. 依赖预热（Dockerfile 第 5 步）

**目的**：让**别人 `docker pull` 之后首次启动约 2 分钟**，而不是现下载几百 MB 依赖等 5–10 分钟。

**做法**：构建时只用 `pom.xml` / `web/package.json` / `web/package-lock.json` 把依赖抓下来
（`mvn dependency:go-offline` 与 `npm ci`），产物放进 `/root/.m2` 与 `/opt/prewarm/`。

- **为什么不 `COPY src`**：一旦 COPY 源码，改任何一行 Java 都会让这一层缓存失效、整个依赖下载重跑。
  只依赖清单文件则「改业务代码不触发重新预热」。
- **体积代价**：预热让镜像多出约 **0.58 GB**（Maven `/root/.m2` 约 121–158 MB +
  前端 `node_modules` 423 MB），整体镜像实测 **2.68 GB**。第一次 pull 慢一点，之后一直快。
- **版本漂移**：改了 `pom.xml` 或 `web/package-lock.json`，必须**重新构建并推送**镜像，
  否则镜像里预热的是旧依赖。运行期 entrypoint 有前后端两道兜底（见下）。
- **Playwright 浏览器刻意不烤**（`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`）：它会多出几百 MB，
  而 e2e 流程本来就是按需 `npx playwright install chromium`。

**运行期如何用上预热**：

| | 机制 |
|---|---|
| Maven | compose 的 `m2cache:/root/.m2` 命名卷在**首次创建**时会用镜像里那份内容初始化 |
| 前端 | entrypoint 的 `seed_frontend_deps()` 把 `/opt/prewarm/web-node_modules` 秒级 `cp` 到命名卷 |

前端带**指纹校验**：镜像里存了 `package-lock.json` 的 sha256，只有当工作区的锁文件指纹也一致时才敢
直接用预热结果；不一致就回退 `npm ci --prefer-offline`——宁可多等一两分钟，也不拿依赖树不对的
`node_modules` 去起 Vite（那种错不会说「依赖不对」，只会变成一堆看不懂的 plugin 报错）。

---

## 3. 构建与发布（维护者）

使用者不该自己构建。发布一次，所有人 `pull`：

```bash
docker login ghcr.io -u <你的GitHub用户名>   # 口令用 PAT(classic,勾 write:packages)
bash docker/scripts/publish-image.sh 1.0     # 构建并推送
MULTIARCH=1 bash docker/scripts/publish-image.sh 1.0   # 同时出 amd64 + arm64
```

或交给 CI：推 `main` 时只要动了镜像输入文件就自动构建推送（默认双架构），
也可在 Actions 页面手动触发 —— 见 [../.github/workflows/dev-env-image.yml](../.github/workflows/dev-env-image.yml)。

要双架构的原因：Windows/Linux 上本机构建出的是 amd64 镜像，Apple Silicon 的 Mac 只能在模拟下跑
（能用，但后端 Maven 编译明显更慢）。

> ⚠️ **最容易漏的一步**：GHCR 的包**默认私有**。推完去
> GitHub → 你的 Profile → **Packages** → `nexus-dev-env` → Package settings → 改成 **public**。
> 不改的话别人 `docker pull` 会 401，而报错信息里并不会提到「包是私有的」。
> （仓库公开 ≠ 包公开，这是两套独立设置。）

只在本机构建（不推送）：

```bash
bash dev.sh build            # 或 docker compose -f docker/docker-compose.yml build
```

---

## 4. 已知局限与设计取舍

- **`dependency:go-offline` 不是 100% 完整**：它按 POM **静态解析**，个别运行期才用到的构件不在其中。
  实测首次 `mvn spring-boot:run` 会补下约 21 个文件（`spring-tx`、`byte-buddy`、`jboss-logging` 等），
  合计不到 1 MB、耗时几秒。**完全离线**的环境才会因此启动失败——那种情况下在有网机器上重建镜像即可。
- **`m2cache` 空卷不会自动重新预热**：Docker 只在**首次创建**命名卷时才用镜像内容初始化。
  若留着一个先前创建的**空** `m2cache` 卷，Maven 会重新下载。处置：`docker volume rm docker_m2cache`
  （**别**顺手 `down -v`，那会连数据库一起清掉）。
- **entrypoint 用的是挂载进来的那份**，不是 Dockerfile 里 `COPY` 的：烤进镜像的脚本会与仓库漂移
  （曾导致「容器一起来、前端在宿主机就打不开」），而 `docker compose up -d` 复用旧镜像，照抄文档也修不好。
  代价是改 `entrypoint.sh` 后必须重建容器，收益是它归仓库管、改完即刻生效。
- **`node_modules` 单独挂命名卷**：宿主机若是 Windows，其 `node_modules` 里 esbuild/sass 等是 win32 二进制，
  容器（Linux）用不了。命名卷隔离后，容器内装 Linux 版，互不干扰。
- **MySQL 用 `mysql_native_password`**：两个原因叠加——Ubuntu 26.04 带的 MySQL 8.4 **默认禁用**了该插件
  （故 entrypoint 显式传 `--mysql-native-password=ON`），而项目 JDBC URL 又未配 `allowPublicKeyRetrieval`，
  非 SSL 下 `caching_sha2_password` 会连接失败。

---

## 5. 端口与安全

端口映射、局域网暴露范围与生产注意事项统一写在
[../docs/STARTUP.md §10](../docs/STARTUP.md) —— 这里不重复，避免两份文档说法不一致。

简言之：**只有 MySQL 绑回环**，`1000` 与 `5173` 是裸映射（局域网可达），
且**本 compose 只用于本机开发，不要用于生产**。
