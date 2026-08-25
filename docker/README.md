# Nexus Market 全栈开发环境镜像

把**前后端运行所需环境**打包成**一个 Docker 镜像**。项目代码**不打包进镜像**——运行时不改代码、只挂载卷,任何人拉取这一个镜像就能在本项目上开发/构建/启动前后端。

## 镜像内容

| 组件 | 版本 | 用途 |
|------|------|------|
| JDK | 17(eclipse-temurin:17-jdk) | 后端 Spring Boot 3.2.10 |
| Maven | 3.9.9(固定) | 后端构建 / `mvn spring-boot:run` / `mvn test` |
| Node + npm | 24.x(NodeSource) | 前端 Vite 5 / `npm install` / `npm run dev` |
| MySQL | 8(mysql-server) | 后端数据库,镜像内启动,端口 3306 |
| 工具 | git / curl / wget / vim / unzip / tzdata(Asia/Shanghai) | 通用开发辅助 |

启动后容器内**自动完成**:
1. 初始化并启动 MySQL(`0.0.0.0:3306`,root 密码默认 `123456`);
2. 创建项目库 `template_v3`(utf8mb4);
3. **首次运行**若检测到挂载的项目 `sql/` 目录,按依赖顺序自动导入建表脚本(均带 `--default-character-set=utf8mb4`):
   `schema.sql(基础 14 表+演示种子) → templatev3_s.sql(admin) → chat.sql → migration-2026-08-08-phase1.sql → migrations/V*.sql(BCrypt/金额精度/order_no+payment)`。

内置**演示账号**(密码统一 `123456`):

| 角色 | 账号 | 余额/说明 |
|------|------|-----------|
| 后台管理员 | `admin` | 管理后台 |
| 商城用户 | `user1` / `user2` | 余额 1000 / 500,可走钱包余额支付 |
| 商家 | `shop1` / `shop2` | 商家后台,含 3 个演示商品 |

> `sql/schema.sql` 是「迁移前」基线(不含 payment、product_order 无 order_no),由 `V3` 增量补齐;`conversation/message` 由 `chat.sql`、通知/优惠 6 表由 `phase1` 负责,各文件职责不重叠。

## 构建 / 推送 / 拉取

```bash
# 构建(在项目根目录)
docker build -f docker/Dockerfile -t nexus-dev-env:1.0 .

# 打标签并推送到你的仓库(供他人拉取)
docker tag nexus-dev-env:1.0 <你的registry>/nexus-dev-env:1.0
docker push <你的registry>/nexus-dev-env:1.0

# 他人只需拉取这一个镜像
docker pull <你的registry>/nexus-dev-env:1.0
```

## 使用方式

### A. Docker Compose(推荐)

```bash
cd docker
docker compose up -d --build     # 首次构建 + 后台启动(自动导库)
docker compose exec dev bash     # 进入容器
```

### B. 单容器 docker run

```bash
docker run -d --name nexus-dev \
  -p 127.0.0.1:3306:3306 -p 1000:1000 -p 5173:5173 \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=template_v3 \
  -v /绝对路径/本项目:/workspace \
  -v mysql-data:/var/lib/mysql \
  <你的registry>/nexus-dev-env:1.0

docker exec -it nexus-dev bash   # 进入容器
```

## 容器内启动前后端

**默认 `AUTO_START=true`,容器启动即自动拉起后端+前端,无需手动命令。** 首次启动会下载 Maven/Node 依赖并编译(约 5-10 分钟,缓存进 `m2cache`/`node_modules` 卷,之后秒级)。日志:`/var/log/backend.log`、`/var/log/frontend.log`(容器内 `tail -f` 查看)。改代码后**后端不会热重载**,需重启后端;前端 Vite 自动热更新。

```bash
# 后端(端口 1000,连接容器内 MySQL localhost:3306)
cd /workspace
mvn spring-boot:run

# 前端(端口 5173)
cd /workspace/web
npm install        # 首次;依赖装入 node_modules 命名卷,重启不重装
npm run dev

# 后端测试(H2,无需 MySQL)
cd /workspace
mvn test
```

浏览器访问 `http://localhost:5173`;前端通过 `http://127.0.0.1:1000` 调后端(端口已 publish 到宿主机)。

## 环境变量

运行时用 `-e` / compose `environment:` 覆盖:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_ROOT_PASSWORD` | `123456` | MySQL root 密码(与应用默认 `SPRING_DATASOURCE_PASSWORD` 一致) |
| `MYSQL_DATABASE` | `template_v3` | 自动创建的项目库 |
| `MYSQL_DATA_DIR` | `/var/lib/mysql` | MySQL 数据目录(挂载卷可持久化) |
| `AUTO_START` | `true` | 容器启动时自动拉起前后端(`mvn spring-boot:run` + `npm run dev`);纯环境用设 `false` |
| `SPRING_DATASOURCE_URL` | 容器内默认 | 后端如需连其他库可覆盖(见 compose 注释) |

> 后端 `application.yaml` 默认读 `SPRING_DATASOURCE_URL` 等环境变量;容器内直连 `localhost:3306` 即可,通常无需覆盖。

## 常见问题

- **为什么 node_modules 单独挂卷?** 宿主机若是 Windows,其 `node_modules` 内 esbuild/sass 等为 win32 二进制,容器(Linux)无法使用。compose 用命名卷 `node_modules:/workspace/web/node_modules` 隔离,容器内 `npm install` 安装 Linux 版,互不干扰。
- **中文乱码 / 双重编码?** 导库一律带 `--default-character-set=utf8mb4`(entrypoint 已内置)。手动导库请保持该参数。
- **root 为什么用 mysql_native_password?** 项目 JDBC URL 未配 `allowPublicKeyRetrieval`,非 SSL 下 `caching_sha2_password` 会导致连接失败;8.0 的 `mysql_native_password` 兼容现有代码,无需改任何配置。
- **改代码要重建镜像吗?** 不需要。代码是卷挂载的,容器内改动即生效;镜像只更新环境(`docker compose up -d --build`)。
- **Docker VM 内存不足?** 本机 Docker Desktop VM 同时跑多个容器(ES/Kibana/多个 MySQL)会 OOM。开发本镜像时请停用无关容器。
- **MySQL 端口为什么只绑回环?** MySQL 默认密码是弱口令 `123456`,compose 用 `127.0.0.1:3306:3306` 只暴露给宿主机(本机 Navicat 可连),不暴露到局域网。若需他人远程连库,请先用 `-e MYSQL_ROOT_PASSWORD=强密码` 覆盖再改映射;后端/前端端口 `1000/5173` 按需自行调整。
- **已有数据的 MySQL 卷?** 删掉 `mysql-data` 卷并重启才会重新初始化导库:`docker compose down -v`(会清空数据库)。
