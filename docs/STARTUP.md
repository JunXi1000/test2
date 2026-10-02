# 项目启动文档（唯一权威）

> **这份是启动/运行项目的唯一权威说明。** 别的文档只做索引：
> 镜像内部构成与发布流程 → [../docker/README.md](../docker/README.md)；
> 环境/规范/坑 → [DEVELOPMENT.md](DEVELOPMENT.md)；接口契约 → [backend-api.md](backend-api.md)。
> 如果发现别处与本文件冲突，**以本文件为准**。

---

## 0. 30 秒上手

机器上**只需要装 Docker**，不需要 JDK / Maven / Node / MySQL，也不需要手动建库导表。

| 系统 | 操作 |
|------|------|
| Windows | 双击根目录的 **`start.bat`** |
| macOS / Linux | 在仓库根目录执行 **`bash start.sh`** |

脚本会自动：拉取环境镜像 → 起容器 → 建库并导入全部 SQL → 恢复前端依赖 → 拉起后端与前端 →
**等到服务真的开始应答** → 用 `admin` 账号验证一次登录 → 打开浏览器。

首次约 **2 分钟**（依赖已预热在镜像里，但后端仍要从头编译一遍 Java）。看到下面这段就是好了：

```
  ==============================================================
   Nexus Market 开发环境
  ==============================================================
  前端页面    http://localhost:5173
  后端 API    http://localhost:1000
```

---

## 1. 前置条件

| 要求 | 说明 |
|------|------|
| Docker Desktop | Windows / macOS 从 [docker.com](https://www.docker.com/products/docker-desktop/) 安装；macOS 也可 `brew install --cask docker`。**必须处于运行状态**（Engine running） |
| Docker Compose v2 | Docker Desktop 自带。Linux 上装 `docker-compose-plugin` |
| 磁盘 | 镜像约 **2.7 GB**（含预热的 Maven/npm 依赖），再加数据库卷 |
| 端口 | `5173`、`1000`、`3306` 需空闲 |

> 脚本会自己检查「Docker 没装」和「Docker Desktop 没启动」这两种情况，并用中文告诉你，不会直接抛一屏英文报错。

---

## 2. 一键启动

```bash
# macOS / Linux（仓库根目录）
bash start.sh

# 可选参数
bash start.sh --rebuild      # 强制重建镜像(改了 docker/ 或依赖清单后)
bash start.sh --no-browser   # 不自动打开浏览器
```

```bat
:: Windows:双击 start.bat,或用通用入口
dev.bat up
dev.bat status
```

> **首次 clone 后 `start.sh` 可能没有可执行位**（取决于仓库里的文件模式），所以上面统一写 `bash start.sh`。
> 想用 `./start.sh` 就先跑一次：
> `chmod +x start.sh stop.sh logs.sh dev.sh docker/scripts/dev.sh`

---

## 3. 启动过程做了什么

1. **拉取环境镜像**。拉不到（尚未发布到 registry / 网络不通 / 包是私有的）会**自动退回本机构建**，
   并明确告诉你这一点——本机构建首次约 10 分钟（要联网装 MySQL/Maven/Node 并预热依赖）。
2. **起容器**。入口脚本 [../docker/entrypoint.sh](../docker/entrypoint.sh) 依次：
   - 首次初始化 MySQL 数据目录并启动 `mysqld`（容器内 `0.0.0.0:3306`，宿主只绑回环）；
   - 幂等设置 root 密码、启用 `mysql_native_password`、创建库 `template_v3`（utf8mb4）；
   - 首次运行按依赖顺序导入(一律 `--default-character-set=utf8mb4`,否则中文双重编码乱码)。
     顺序是**写死的三段** + **一个 glob**:
     `sql/schema.sql` → `sql/chat.sql` → `sql/migration-2026-08-08-phase1.sql` →
     **`for f in sql/migrations/*.sql`**(按文件名排序,当前为 V1…V11)。
     ⚠️ 所以「新增迁移文件」本身不需要改 `entrypoint.sh`;**但见下一条的短路陷阱**。
   - **短路陷阱(最容易踩的一个)**:整批导入完成后会写批次标记
     `${DATA_DIR}/.schema-imported`,之后**只要该标记存在就再也不会扫描 `sql/`**
     —— 往 `sql/migrations/` 里新增 V12 再 `docker restart`,**新脚本不会被执行**。
     真因不是「脚本清单只写到 V5」——入口是 glob,清单本来就会跟着目录长大;
     真正的原因是批次标记短路(`.schema-imported` 一旦存在,整段导入逻辑直接不进入)。要跑新迁移:
     `docker exec -it nexus-dev rm -f /var/lib/mysql/.schema-imported`(即 `${DATA_DIR}` 下;
     本仓库 compose 把卷挂在 `/var/lib/mysql`,故路径就是它)后重启,
     或按提示手工 `mysql ... < sql/migrations/V12__xxx.sql`。
     **只删批次标记、别删 `.imported/` 目录** —— 单文件标记还在,已成功的脚本会被跳过,
     实际只会执行新增/上次失败的那个(这正是设计意图)。
     另:每个脚本成功还会写 `${DATA_DIR}/.imported/<文件名>` 单文件标记(重试时只重跑失败的),
     而 `sql/schema.sql` 的种子 INSERT 带显式 id、**不幂等** —— 不要盲目整体重导。
   - `AUTO_START=true`：先起后端 `mvn spring-boot:run`，**轮询到后端就绪再起前端 `vite`**。
     并行起会撞上「后端未监听 → Vite 代理 500」的窗口期，首页直接报错。
3. **前端依赖**：`node_modules` 命名卷若为空，从镜像预热目录恢复（秒级）；
   若工作区的 `package-lock.json` 与镜像里预热的那份**指纹不一致**，回退 `npm ci --prefer-offline`。
   ——宁可多等一两分钟，也不拿依赖树不对的 `node_modules` 去起 Vite。
4. **等就绪**：最多等后端 600s、前端 180s，**以「收到 HTTP 响应」为判据**。
   > ⚠️ 这里刻意**不用「TCP 能连上」**：Docker 的端口发布是「宿主侧代理监听 + 转发」，
   > 代理在容器内应用还没开始监听时就已经 accept 了连接。实测后端还在编译、Vite 连
   > `/var/log/frontend.log` 都还没生成时，TCP 连接就已经成功——据此判断会**提前报就绪**。
   > 收到 401/403/404 都算就绪（后端 `/` 未登记在授权表里，默认拒绝就是 401），
   > 完全拿不到响应才是「还没起来」。
5. **验证**：用 `admin` / `123456` 调一次 `/common/login`，返回 JWT 才说明
   「MySQL 起来了 + 建表导脚本成功 + 后端连得上库」整条链路真的通了。

---

## 4. 访问地址与演示账号

| 服务 | 地址 |
|------|------|
| 前端页面 | <http://localhost:5173> |
| 后端 API | <http://localhost:1000> |
| MySQL | 容器内 `localhost:3306`；从宿主机是 `127.0.0.1:3306`，库 `template_v3`，root / `123456` |

演示账号（密码均为 `123456`）：

| 角色 | 账号 |
|------|------|
| 后台管理员 | `admin` |
| 商城用户 | `user1` / `user2` |
| 商家 | `shop1` / `shop2` |

> 上面的 `123456` 是**本地默认值**，只对「没有 `docker/.env` 的全新 clone」成立。
> 若你建过 `docker/.env`（模板 [../docker/.env.example](../docker/.env.example)），口令以那份文件为准。

---

## 5. 常用命令

| 命令 | 作用 |
|------|------|
| `bash start.sh` / `start.bat` | 启动并等到就绪 |
| `bash stop.sh` / `stop.bat` | 停止（**数据保留**） |
| `bash logs.sh` / `logs.bat` | 跟随容器日志 |
| `bash dev.sh status` / `dev.bat status` | 容器状态 + 前后端是否在应答 |
| `bash dev.sh shell` / `dev.bat shell` | 进容器 bash |
| `bash dev.sh restart` | 重启容器（入口脚本会重跑一遍幂等的建库/导脚本） |
| `bash dev.sh reset` / `dev.bat reset` | 停止并**删除数据库卷**（回到全新建库状态，需输入 yes） |
| `bash dev.sh pull` / `build` | 只拉取 / 只本机构建镜像 |

容器内操作：

```bash
docker exec nexus-dev tail -f /var/log/backend.log     # 后端日志
docker exec nexus-dev tail -f /var/log/frontend.log    # 前端日志
docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'   # 后端测试（H2，不需要 MySQL）
```

- **后端不热重载**：改 Java 代码后必须重启 `mvn spring-boot:run`（先停旧进程，否则 1000 端口被占）。
- **前端热更新**：Vite 自动 HMR，无需重启。
- **跑测试前先停 dev 后端**，否则 `maven-clean-plugin` 删不掉被运行中 JVM 占用的 `target/`
  （报 `Failed to clean project: Failed to delete /workspace/target`）：
  `docker exec nexus-dev bash -lc 'pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"'`
  （中括号写法是必须的，否则 `pkill` 会匹配到自己所在的命令行）。
- **容器内前端必须用 `npm run dev:lan`（= `vite --host`）**，不能用 `npm run dev`：
  见 §9「容器里前端必须 dev:lan」。

---

## 6. 环境变量（本机覆盖）

复制模板即可覆盖默认值（`docker/.env` 已被 gitignore）：

```bash
cp docker/.env.example docker/.env
```

改了 `.env` 需要**重建容器**（`restart` 不生效）。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_ROOT_PASSWORD` | `123456` | MySQL root 口令 |
| `SPRING_DATASOURCE_PASSWORD` | `123456` | 后端连库口令（与上面同一个库） |
| `RESET_PASSWORD` | `123456` | 管理员重置用户密码时的默认新密码 |
| `JWT_SECRET` | 空 | 留空则每次启动生成**一次性随机密钥**（重启后旧 token 失效）。生产必填 |
| `SPRING_PROFILES_ACTIVE` | `dev` | **生产必须显式改 `prod`**，否则会落到 dev 的本地弱口令 |
| `DEV_ENV_IMAGE` | `ghcr.io/junxi1000/nexus-dev-env:1.0` | 镜像地址；fork 后想用自己账号的镜像就改它 |
| `AUTO_START` | `true` | 容器启动即拉起前后端；只要纯环境设 `false` |
| `EXPOSE_RESET_CODE` | dev 下 `true` | 找回密码验证码是否直接在响应里回显（仅演示用，生产关闭） |

---

## 7. 不用脚本的手动方式

```bash
# 拉取优先（推荐）；拉不到再本地构建
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d

# 只想本机构建
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
```

> `docker-compose.yml` 同时写了 `image:` 与 `build:`，所以**本地没镜像时 `up -d` 会直接构建**
> （要联网装 MySQL/Maven/Node，约 10 分钟）——这正是脚本要先 `pull` 一次的原因。

---

## 8. 不用 Docker：裸机启动（可选）

需要自行安装：**JDK 17+**、**Maven 3.6+**、**Node.js 18+**（Vite 5 要求 `^18 || >=20`）、**MySQL 8+**。

### 8.1 数据库

1. 启动你的 MySQL。
2. 建库，例如 `template_v3`。
3. **按依赖顺序**导入:`sql/schema.sql` → `sql/chat.sql` → `sql/migration-2026-08-08-phase1.sql`
   → **`sql/migrations/` 下的全部 `*.sql`(按文件名排序,当前 V1…V11)**,且必须带
   `--default-character-set=utf8mb4`(否则中文乱码)。
   **只导 `schema.sql` 是不够的**——唯一键/索引与金额 `DECIMAL(10,2)` 都在 `sql/migrations/` 里,
   缺了会在并发写入和金额精度上出问题。
   > 裸机路线没有 Docker 那个批次标记短路问题(你不会跑 `entrypoint.sh`),所以新迁移都要自己补导。
   > `docs/backend-api.md` 里凡写「本轮未应用该迁移」的列(如 V8 的 `review_status`、
   > V10 的 `product.status`/`shipping_address.is_default`),在本机想用就必须显式导入对应文件。

### 8.2 配置数据库连接（改对文件！）

- 应用默认激活 `dev` profile，而 **`application-dev.yaml` 的同名项优先于 `application.yaml`**，
  所以改 `src/main/resources/application.yaml` 里的数据源会被 dev 的值覆盖、**不生效**。
- 推荐：设环境变量 `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`
  （基配置与 dev 都读这三个）；或直接改 `src/main/resources/application-dev.yaml`。
- 另有两项必填，不设会启动失败：`RESET_PASSWORD`、`JWT_SECRET`
  （dev profile 下这两项有本地默认值，本地跑通常无需设置；详见 [DEVELOPMENT.md §2.4](DEVELOPMENT.md)）。

### 8.3 启动

```bash
# 后端（端口 1000）
#   IDE 里运行 src/main/java/com/project/platform/ProjectManagement.java
#   或命令行：
mvn spring-boot:run

# 前端（端口 5173）
cd web
npm install
npm run dev
```

看到 `Tomcat started on port(s): 1000 (http)` 即后端成功；浏览器打开 <http://localhost:5173>。

---

## 9. 故障排查

| 症状 | 原因 | 处置 |
|------|------|------|
| 脚本提示「Docker 守护进程没有在运行」 | Docker Desktop 没启动 | 启动 Docker Desktop，等 Engine running 再重跑 |
| 「拉取失败 … denied」 | 镜像还没发布到 registry，或 GHCR 上的包是私有的 | 脚本会退回本机构建（能用但慢）。私有包先 `docker login ghcr.io -u <用户名>` |
| 后端 600s 仍未就绪 | 首次编译慢；或 `target/` 被清过要重编译 | `docker exec nexus-dev tail -n 100 /var/log/backend.log` 看真正原因 |
| 页面能打开但接口报 500 | 撞上「后端未监听 → Vite 代理 500」的窗口期 | 用 `start.sh`（它会等到后端应答）；或等后端就绪后刷新 |
| 页面打不开 / `curl localhost:5173` 拿 `Empty reply`(exit 52) | 容器里跑了 `npm run dev`（绑 127.0.0.1），而 Docker 的 `5173:5173` 是把流量 DNAT 到容器 **eth0**，不是容器内回环 | 容器内**必须** `npm run dev:lan`（`vite --host`）。`--host` 仍监听回环，不影响容器内 Playwright |
| 中文乱码 / 双重编码 | 导库没带 `--default-character-set=utf8mb4` | entrypoint 已内置；手动导库请自己带上 |
| 每次启动都在下载 Maven 依赖 | 留着一个**已存在的空 `m2cache` 卷**（Docker 只在**首次创建**命名卷时才用镜像内容初始化） | `docker volume rm docker_m2cache`（**别**顺手 `down -v`，那会连数据库一起清掉） |
| 首启补下了几个 jar | 正常。`dependency:go-offline` 按 POM 静态解析，个别运行期才用的构件不在其中（实测约 21 个文件、不到 1 MB、几秒） | 无需处理。**完全离线**时才需要重建镜像 |
| 改了 `web/package.json` 但镜像没重建 | 前端会检测到锁文件指纹不一致 | 自动回退 `npm ci`（慢一点但正确）；想免掉就 `dev.sh build` 重建镜像 |
| 改了 `docker/entrypoint.sh` 不生效 | compose 用的是**挂载进来的**那份脚本 | `docker compose up -d` 重建容器即可，**不需要** `--build` |
| 想把数据库恢复成全新状态 | — | `bash dev.sh reset`（或 `docker compose down -v`） |
| 已有的库不会被自动升级 | 导入完成度按文件记，成功的脚本会跳过 | 新增迁移（`V6`…`V11`，以及将来的 V12+）需手工执行；回滚脚本在 `sql/migrations/rollback/` |
| 端口 1000 / 5173 / 3306 被占用 | 本机已有别的程序在用 | 停掉占用者，或改 [../docker/docker-compose.yml](../docker/docker-compose.yml) 的 `ports` 映射 |
| Docker VM 内存不足 / 容器被杀 | 同时跑 ES/Kibana 等多个容器会 OOM | 开发本项目时停用无关容器（可在 Docker Desktop 里调大内存） |
| Windows 上脚本输出中文乱码 | `dev.ps1` 依赖 UTF-8 BOM 才能被 PowerShell 5.1 正确解码 | 仓库里那份带 BOM，别用会剥掉 BOM 的编辑器保存 |

---

## 10. 端口与安全

⚠️ compose 里**只有 MySQL 绑了回环**：

| 端口 | 映射 | 谁能访问 |
|------|------|----------|
| 3306 | `127.0.0.1:3306:3306` | 仅宿主机（本机 Navicat 可连） |
| 1000 | `1000:1000`（裸映射） | **同一局域网内任何设备** |
| 5173 | `5173:5173`（裸映射） | **同一局域网内任何设备** |

Docker 默认把裸映射绑 `0.0.0.0`，实测 `docker ps` 显示 `0.0.0.0:1000->1000/tcp`、`0.0.0.0:5173->5173/tcp`。
这是本机开发环境一直以来的状态。想收敛就给这两条映射加 `127.0.0.1:` 前缀，
代价是**失去手机/其它机器访问 dev server 的能力**——而 **dev server 那条尤其值得权衡**：
它会提供源码，且历史上有过文件读取类 CVE（2025 年 `?raw` / `fs.deny` 绕过那一族），
`server.fs.strict` 保持默认开启也挡不住那类绕过。

**这套 compose 只用于本机开发，不要用于生产。** 生产请另写部署清单，并保证
`MYSQL_ROOT_PASSWORD` / `SPRING_DATASOURCE_PASSWORD` / `RESET_PASSWORD` / `JWT_SECRET` 全部由环境变量注入、
`SPRING_PROFILES_ACTIVE=prod`（prod profile 下缺 `JWT_SECRET` 会**拒绝启动**，不会退化）。

---

## 11. 镜像从哪来（维护者）

使用者不该自己构建。发布一次，所有人 `pull`：

```bash
docker login ghcr.io -u <你的GitHub用户名>   # 口令用 PAT(classic,勾 write:packages)
bash docker/scripts/publish-image.sh 1.0     # 构建并推送
MULTIARCH=1 bash docker/scripts/publish-image.sh 1.0   # 同时出 amd64 + arm64
```

或交给 CI：推 `main` 时只要动了镜像输入文件就自动构建推送（双架构），
见 [../.github/workflows/dev-env-image.yml](../.github/workflows/dev-env-image.yml)。

> ⚠️ **最容易漏的一步**：GHCR 的包**默认私有**。推完去
> GitHub → 你的 Profile → **Packages** → `nexus-dev-env` → Package settings → 改成 **public**。
> 不改的话别人 `docker pull` 会 401，而报错信息里并不会提到「包是私有的」。
> （仓库公开 ≠ 包公开，这是两套独立设置。）

镜像内部构成、依赖预热机制、体积取舍见 [../docker/README.md](../docker/README.md)。
