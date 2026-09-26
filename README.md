# 在线商店 (前后端分离)

这是一个基于 Java (Spring Boot) 和 Vue 3 的前后端分离电商项目。

## 📌 当前实现状态（先读这段）

**买家主链路是真实可用的**：注册登录 → 浏览/搜索商品 → 购物车 → 结算 → 支付 → 订单与取消/退款 → 地址、优惠券、退换货、到货提醒、聊天。

**但并非"一应俱全"**，别按功能清单去假设可用性：

- **管理端与商家端有相当一部分是占位**：仪表盘统计、钱包余额、系统设置等返回**硬编码假数据**或直接 no-op（前端会把它当真实数据渲染）。逐条清单见 [docs/MODULES.md](docs/MODULES.md) §2。
- **支付网关是模拟的**：`payment` 表与状态机是真的，但没有真实商户号、回调验签与对账。
- **库存无预占**（下单即扣、取消/超时回补），没有 SKU/SPU、没有流水表。
- 缺口分析见 [docs/REQUIREMENTS-GAP.md](docs/REQUIREMENTS-GAP.md)。

> **哪些文档说了算**（README 只负责"怎么跑起来"）：
> 后端**实际暴露哪些端点** → [docs/backend-api.md](docs/backend-api.md)；
> 前端**实际调用哪些路径** → `web/src/api/modules/*.ts`；
> 环境、规范与坑 → [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
> `docs/API接口说明.md` 是**历史文档**（前端最初的期望），不要当契约用。

## 🛠️ 技术栈

### 后端 (`src/main/java`)

- **核心框架**: Spring Boot 3.2.10
- **持久层**: MyBatis 3.0.4（接口 + XML / 注解）
- **数据库**: MySQL 8.0（测试用 H2 `MODE=MySQL`）
- **认证**: JWT（jjwt 0.9.1，HS256）
- **授权**: `config/AuthzRules` 显式规则表 + **默认拒绝**（未登记的路径对所有角色 403；详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)）
- **密码**: BCrypt（`spring-security-crypto`，不引 Spring Security 过滤器链）
- **构建工具**: Maven
- **开发语言**: Java 17
- **其他**: Lombok, Fastjson2, Hutool

### 前端 (`web/`)

- **核心框架**: Vue 3.4 + TypeScript 5.9（`vue-tsc` 做类型检查）
- **路由**: Vue Router 4
- **状态管理**: Pinia 2
- **UI**: Element Plus 2.8（表格/表单等有内部状态机的组件）+ 自建 `components/ui/*`（shadcn-vue 风格：`cva` + `tailwind-merge`）
- **样式**: Tailwind CSS 4（主题令牌的来源，见 `src/assets/css/tailwind.css`）
- **构建工具**: Vite 5
- **HTTP 请求**: Axios（统一走 `src/api/http.ts`）
- **国际化**: vue-i18n 9（目前只有 `locales/en.ts`）
- **图表**: ECharts 5
- **工具库**: lodash-es, @vueuse/core, lucide-vue-next（图标）
- **E2E 测试**: Playwright

## 📂 目录结构

```
.
├── docker/                   # 开发环境镜像（JDK/Maven/Node/MySQL，一键起前后端）
│   ├── Dockerfile
│   ├── docker-compose.yml    # 只用于**本机开发**（含本地默认口令，3306 绑回环）
│   ├── .env.example          # 口令/密钥的可选覆盖模板（复制成 .env，已 gitignore）
│   └── entrypoint.sh
├── sql/                      # 数据库脚本
│   ├── schema.sql            # 基础建表 + admin 种子数据
│   ├── chat.sql              # 聊天表
│   ├── migration-2026-08-08-phase1.sql  # 一期增量迁移（对运行中库补表）
│   └── migrations/           # 增量迁移 V1–V5（安全 / 金额 DECIMAL / 唯一键与索引）
│       └── rollback/         # 对应回滚脚本（放子目录，避免被 entrypoint 的 glob 当迁移自动执行）
├── src/                      # 后端 Java 源码（Spring Boot）
│   └── main/java/com/project/platform/  # 19 个 Controller + service/mapper/entity
├── uploads/                  # 上传文件（运行时数据，git 忽略）
├── web/                      # 前端 Vue 源码
│   ├── src/                  # 页面 / api / stores / router
│   ├── .env*                 # 环境变量（VITE_API_BASE_URL / VITE_USE_MOCK）
│   ├── vite.config.ts        # 开发代理 /api → :1000
│   └── package.json
├── docs/                     # 项目文档（9 份）
│   ├── REQUIREMENTS.md       # 电商系统需求分析文档（百万级用户目标，含用例/时序图）
│   ├── REQUIREMENTS-GAP.md   # 现有实现 vs 需求差距分析
│   ├── ARCHITECTURE.md       # 系统架构（分层/认证）
│   ├── MODULES.md            # 功能模块与实现状态矩阵（真实/部分/占位）
│   ├── DEVELOPMENT.md        # 开发指南与代码规范
│   ├── backend-api.md        # 后端接口契约清单（端点×实现状态）
│   ├── ROADMAP.md            # 开发路线图（Phase 1–2 已完成，Phase 3–5）
│   ├── REFACTOR_PLAN-BACKEND.md  # 后端重构计划（遗留 CRUD 清理 / 授权默认拒绝 / 迁移 V4–V5）
│   └── API接口说明.md        # ⚠️ 历史文档：前端最初的接口期望，**不要当契约用**（权威见上面「当前实现状态」）
├── pom.xml                   # 后端 Maven 依赖
└── README.md                 # 项目说明
```

> 📖 **文档索引**：新开发者从 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) 起步（环境/启动/mock 机制），读 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 了解架构，用 [docs/MODULES.md](docs/MODULES.md) 看功能实现状态，按 [docs/ROADMAP.md](docs/ROADMAP.md) 推进开发；本轮后端重构的范围与取舍见 [docs/REFACTOR_PLAN-BACKEND.md](docs/REFACTOR_PLAN-BACKEND.md)。

## 🚀 快速开始（Docker 开发环境，推荐）

后端所需的 **JDK 17 / Maven / MySQL 8 / Node 24** 已全部打包在一个开发环境镜像里，**宿主机无需安装任何依赖**。

| 组件 | 版本 | 位置 |
|------|------|------|
| JDK | 17 (eclipse-temurin) | 镜像内 `/opt/java/openjdk` |
| Maven | 3.9.9 | 镜像内 `/opt/maven` |
| Node + npm | 24.x | 镜像内 |
| MySQL | 8.0 | 容器内 `localhost:3306` |

镜像 `nexus-market/dev-env:1.0` 由 [docker/Dockerfile](docker/Dockerfile) 构建，**不含项目代码**——代码以卷挂载到容器 `/workspace`，改代码即时生效，无需重建镜像。

### 1. 启动环境

```bash
cd docker
docker compose up -d --build      # 已有镜像时直接复用，不重复构建
```

容器启动即自动完成：初始化并启动 MySQL → 建库 `template_v3` → **仅首次建库时**按依赖顺序导入 `sql/schema.sql` → `sql/chat.sql` → `sql/migration-2026-08-08-phase1.sql` → `sql/migrations/V1…V5`（导入命令必带 `--default-character-set=utf8mb4`，否则中文双重编码乱码；导入完在 MySQL 数据卷里写 `${DATA_DIR}/.schema-imported` 标记，`docker compose down -v` 清卷后才会重导）→ `AUTO_START=true` 自动拉起前后端。

> ⚠️ **已有库不会被自动升级**：新增迁移（如 `V4__constraints_and_indexes.sql` 的唯一键 + 索引、`V5__money_decimal_round2.sql` 的金额 `DECIMAL(10,2)`）需手工执行，回滚脚本在 `sql/migrations/rollback/`。

> ⏱️ **首次启动约 5–10 分钟**（下载 Maven 依赖 + 编译）；之后依赖缓存在 `m2cache` / `node_modules` 卷里，启动为秒级。

启动顺序是**先起后端、轮询 `:1000` 等它就绪、再起前端**：Vite 约 1s 就绪而后端要 ~60s，若并行启动，页面会撞上「后端未监听 → Vite 代理 500」的窗口期。

### 2. 验证后端已启动

```bash
docker exec nexus-dev tail -f /var/log/backend.log
# 出现 Tomcat started on port 1000 (http) with context path '' 即成功

curl -X POST http://localhost:1000/common/login \
  -H "Content-Type: application/json" \
  -d '{"type":"ADMIN","username":"admin","password":"123456"}'
# 返回 code=200，data 为 JWT 字符串
```

### 3. 访问

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost:5173 |
| 后端 API | http://localhost:1000 |
| MySQL | 容器内 `127.0.0.1:3306`（库 `template_v3`，root / `123456`） |

> 上表的 `123456` 是 `docker-compose.yml` 的**本地默认值**,只对「没有 `docker/.env` 的全新 clone」成立。
> 若你建过 `docker/.env`(模板见 `docker/.env.example`),口令以那份文件为准;容器的 3306 只绑回环,不对外。

演示账号（密码均 `123456`）：管理员 `admin` / 买家 `user1` / 商家 `shop1`。

### 4. 常用命令

```bash
docker compose exec dev bash                       # 进入容器
docker compose exec dev bash -lc "cd /workspace && mvn spring-boot:run"  # 手动启动/重启后端
docker compose exec dev bash -lc "cd /workspace && mvn -B clean test"    # 后端测试闸门（H2，无需 MySQL）
docker compose exec dev bash -lc "cd /workspace/web && npm run dev"      # 前端
docker exec nexus-dev tail -f /var/log/frontend.log                      # 前端日志
docker compose down                                # 停止
docker compose down -v                             # 停止并清空数据库（下次启动重新导脚本）
```

- **后端不热重载**：改 Java 代码后必须重启 `mvn spring-boot:run`（先停掉旧进程，否则 1000 端口被占）。
- **跑测试前先停 dev 后端**：否则 `maven-clean-plugin` 删不掉被运行中 JVM 占用的 `target/`（报 `Failed to clean project: Failed to delete /workspace/target`）。停法：`docker exec nexus-dev bash -lc 'pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"'`（中括号写法是必须的，否则 `pkill` 会匹配到自己所在的命令行）。
- **前端热更新**：Vite 自动 HMR，无需重启。
- 端口映射、环境变量、常见问题见 [docker/README.md](docker/README.md)。

---

## 💻 裸机开发（可选，需自行安装环境）

不想用 Docker 时，可在宿主机直接跑。需先安装：

- **JDK**: 17 或更高版本
- **Maven**: 3.6 或更高版本
- **Node.js**: 18 或更高（Vite 5 的 `engines` 要求 `^18 || >=20`）
- **MySQL**: 8.0 或更高版本
- **IDE**: IntelliJ IDEA, VS Code (推荐)

### 1. 数据库配置

1.  启动你的 MySQL 数据库服务。
2.  创建一个新的数据库，例如 `template_v3`。
3.  按依赖顺序导入数据库脚本：`sql/schema.sql`（基础表 + admin 种子）→ `sql/chat.sql` → `sql/migration-2026-08-08-phase1.sql` → `sql/migrations/V1…V5`，导入时带 `--default-character-set=utf8mb4`（否则中文乱码）。**只导 `schema.sql` 是不够的**——唯一键/索引与金额 `DECIMAL(10,2)` 都在 `sql/migrations/` 里，缺了会在并发写入和金额精度上出问题。
4.  **配置数据库连接**。⚠️ 注意**改哪个文件**:

    - 应用默认激活 `dev` profile,而 **`application-dev.yaml` 里的同名项优先于 `application.yaml`**。
      所以你改 `src/main/resources/application.yaml` 会被 dev 的值覆盖、**不生效**。
    - 推荐做法:设环境变量 `SPRING_DATASOURCE_URL` / `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`
      (基配置就是读这三个,dev 的同名项也读它);或直接改 **`src/main/resources/application-dev.yaml`**。
    - 另外两项也是必填,不设会启动失败:`RESET_PASSWORD`、`JWT_SECRET`
      (详见 [docs/DEVELOPMENT.md §2.4](docs/DEVELOPMENT.md);dev profile 下这两项有本地默认值,故本地跑通常无需设置)。

### 2. 启动后端服务

1.  使用 IntelliJ IDEA 打开项目根目录。
2.  等待 Maven 自动下载所有依赖。
3.  找到启动类 `src/main/java/com/project/platform/ProjectManagement.java`。
4.  右键点击并选择 `Run 'ProjectManagement.main()'`。
5.  如果控制台输出 `Tomcat started on port(s): 1000 (http)`，则表示后端服务启动成功。

### 3. 启动前端服务

1.  在 VS Code 中打开 `web/` 目录，或在终端中进入该目录。
2.  安装项目依赖：

    ```bash
    npm install
    ```

3.  启动开发服务器：

    ```bash
    npm run dev
    ```

4.  前端服务默认会运行在 `http://localhost:5173` (具体端口以终端输出为准)。
5.  打开浏览器访问该地址，即可看到项目登录页面。

---

## 🧪 测试

### 后端单元/集成测试（MockMvc + H2）

后端测试用 H2 `MODE=MySQL` 内存库，覆盖注册/登录/当前用户/找回密码/越权等场景，无需启动 MySQL：

```bash
# 容器内闸门命令（必须带 clean；仓库 bind mount 在 /workspace）
docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'
```

- **跑之前必须先停掉容器内的 dev 后端**，否则 `maven-clean-plugin` 删不掉被运行中 JVM 占用的 `target/`：`docker exec nexus-dev bash -lc 'pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"'`
- 测试基类：`src/test/java/.../controller/BaseControllerTest.java`（自动签发 ADMIN/USER/SHOP 的 JWT）
- **授权回归网**：`config/AuthzRulesTest`（规则表纯单测）、`controller/AuthorizationBaselineTest`（端起端到端：合法访问矩阵 / 未登记端点 403 / 角色不跨域 / 对象级越权）
- **错误模型回归网**：`controller/ErrorModelTest`（5 类异常 → 4xx、`msg`/`data` 双写、各处缺字段不再 500）
- 登录注册专项：`AuthFlowTest.java`（成功 + 失败场景全覆盖）、`AuthControllerTest.java`、`SecurityControllerTest.java`（验证码/越权）
- 新增表必须同步 `src/test/resources/schema-h2.sql`，否则测试报表不存在

### 前端端到端测试（Playwright）

`web/tests/*.spec.ts` 为 Playwright e2e。前端以 `web/.env` 的 `VITE_USE_MOCK=false` 启动，请求经 Vite 代理 `/api` → `:1000`，因此 **e2e 需要 dev 后端已就绪**（Docker 环境里 `AUTO_START=true` 已自动拉起；纯 mock 模式需在浏览器控制台置 `localStorage.RUNTIME_USE_MOCK='true'` 后刷新，e2e 未这么做）。需先启动前端 dev server：

```bash
cd web
npm install
npx playwright install chromium
# 终端 1: npm run dev    (:5173)
# 终端 2: npx playwright test
```

### 登录注册手动测试清单

| # | 场景 | 预期 |
|---|------|------|
| 1 | 注册成功（合法邮箱/≥6 位密码/勾选条款） | 提示创建成功，跳转登录页；该账号可登录 |
| 2 | 注册失败：邮箱已存在 | 红字横幅「用户名已存在」，停留在注册页 |
| 3 | 注册失败：邮箱格式错误 / 密码 <6 位 / 两次密码不一致 / 未勾选条款 | 对应字段红框 + 行内错误，提交被拦截 |
| 4 | 注册为商家 | ⚠️ **对真实后端不成立**:`/common/register` 只放行 `USER`,商家自助注册被拒(403「仅支持普通用户注册」)。此条只在 mock 模式下成立;真实环境建商家走管理端 `POST /admin/merchants` |
| 5 | 登录成功 | 跳转首页/对应角色后台，顶部显示用户名，Toast 欢迎 |
| 6 | 登录失败：错误密码 / 不存在的邮箱 | 统一提示「用户名或密码错误」，不清空输入 |
| 7 | 登录失败：空邮箱 / 空密码 | 字段红框 + 行内错误，焦点落到首个非法字段 |
| 8 | 密码框眼睛图标 | 可切换明文/密文，aria-label 同步切换 |
| 9 | 登出 | 清空本地会话，跳回首页/登录页，受保护页不可再访问 |
| 10 | 刷新页面保持登录 | localStorage 会话未过期时仍处于登录态 |
| 11 | token 过期（24h）或被清空 | 首个请求 401 → 自动清会话并跳登录（带 redirect 回跳） |
| 12 | 直接访问 `/dashboard`（未登录） | 重定向到 `/login?redirect=/dashboard`，登录后回跳 |
| 13 | 已登录访问 `/login`、`/signup` | 自动跳回首页/对应角色后台（guestOnly 守卫） |
| 14 | 找回密码：输入注册邮箱 | 发送验证码（演示环境页面回显 6 位码） |
| 15 | 找回密码：验证码错误 / 过期 / 无此邮箱 | 明确错误提示，不修改密码 |
| 16 | 重置密码：新密码 <8 位 / 两次不一致 / 验证码非 6 位 | 字段级错误，提交被拦截 |
| 17 | 重置成功 | 提示更新完成，新密码可登录、旧密码被拒 |
| 18 | 移动端宽度（<768px）访问四个鉴权页 | 卡片自适应，无横向滚动，可正常填写提交 |

> 测试账号（密码均 `123456`）：管理员 `admin` / 买家 `user1` / 商家 `shop1`；买家 `test@example.com` / `password123`。

---

现在，你可以开始探索这个电商项目了！祝你编码愉快！
