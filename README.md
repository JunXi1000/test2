# 在线商店 (前后端分离)

这是一个基于 Java (Spring Boot) 和 Vue 3 的前后端分离电商项目。

## 📌 当前实现状态（先读这段）

**买家主链路是真实可用的**：注册登录 → 浏览/搜索商品 → 购物车 → 结算 → 支付 → 订单与取消/退款 → 地址、优惠券、退换货、到货提醒、聊天。

**但并非"一应俱全"**，别按功能清单去假设可用性：

- **管理端与商家端有相当一部分是占位**：仪表盘统计、钱包余额、系统设置等返回**硬编码假数据**或直接 no-op（前端会把它当真实数据渲染）。逐条清单见 [docs/MODULES.md](docs/MODULES.md) §2。
- **支付网关是模拟的**：`payment` 表与状态机是真的，但没有真实商户号、回调验签与对账。
- **库存无预占**（下单即扣、取消/超时回补），没有 SKU/SPU、没有流水表。
- 缺口分析见 [docs/REQUIREMENTS-GAP.md](docs/REQUIREMENTS-GAP.md)。

> **哪些文档说了算**：
> **怎么把项目跑起来** → [docs/STARTUP.md](docs/STARTUP.md)（唯一权威启动文档）；
> 后端**实际暴露哪些端点** → [docs/backend-api.md](docs/backend-api.md)；
> 前端**实际调用哪些路径** → `web/src/api/modules/*.ts`；
> 环境、规范与坑 → [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

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
├── start.sh / start.bat      # ★ 一键启动:拉镜像 → 起容器 → 等就绪 → 验证接口 → 开浏览器
├── stop.sh / stop.bat        # 停止(数据保留)
├── logs.sh / logs.bat        # 跟随容器日志
├── dev.sh / dev.bat          # 通用入口(status / shell / restart / reset / pull / build)
├── docker/                   # 开发环境镜像（JDK/Maven/Node/MySQL + 预热依赖，一键起前后端）
│   ├── Dockerfile            # 环境镜像;第 5 步把 Maven/npm 依赖预热进去
│   ├── docker-compose.yml    # 只用于**本机开发**（含本地默认口令，3306 绑回环）
│   ├── .env.example          # 口令/密钥/镜像地址的可选覆盖模板（复制成 .env，已 gitignore）
│   ├── entrypoint.sh         # 建库 + 导脚本 + 恢复前端依赖 + 拉起前后端
│   └── scripts/
│       ├── dev.sh / dev.ps1  # 一键脚本的真正逻辑
│       └── publish-image.sh  # 维护者:构建并推送镜像到 ghcr.io
├── .github/workflows/
│   └── dev-env-image.yml     # 自动化:改了镜像输入文件就构建推送(双架构)
├── sql/                      # 数据库脚本
│   ├── schema.sql            # 基础建表 + admin 种子数据
│   ├── chat.sql              # 聊天表
│   ├── migration-2026-08-08-phase1.sql  # 一期增量迁移（对运行中库补表）
│   └── migrations/           # 增量迁移 V1–V5（安全 / 金额 DECIMAL / 唯一键与索引）
│       └── rollback/         # 对应回滚脚本（放子目录，避免被 entrypoint 的 glob 当迁移自动执行）
├── src/                      # 后端 Java 源码（Spring Boot）
│   └── main/java/com/project/platform/  # 19 个 Controller + service/mapper/entity
├── uploads/                  # 上传文件（运行时数据，git 忽略；例外见下）
│   └── demo-avatar.png       # admin 种子头像的占位图，**唯一入库**的上传文件
├── web/                      # 前端 Vue 源码
│   ├── src/                  # 页面 / api / stores / router
│   ├── .env*                 # 环境变量（VITE_API_BASE_URL / VITE_USE_MOCK）
│   ├── vite.config.ts        # 开发代理 /api → :1000
│   └── package.json
├── docs/                     # 项目文档
│   ├── STARTUP.md            # ★ 启动文档（唯一权威：一键启动/裸机启动/故障排查）
│   ├── REQUIREMENTS.md       # 电商系统需求分析文档（百万级用户目标，含用例/时序图）
│   ├── REQUIREMENTS-GAP.md   # 现有实现 vs 需求差距分析
│   ├── ARCHITECTURE.md       # 系统架构（分层/认证）
│   ├── MODULES.md            # 功能模块与实现状态矩阵（真实/部分/占位）
│   ├── DEVELOPMENT.md        # 开发指南与代码规范
│   ├── backend-api.md        # 后端接口契约清单（端点×实现状态）
│   ├── ROADMAP.md            # 开发路线图（Phase 1–2 已完成，Phase 3–5）
│   └── REFACTOR_PLAN-BACKEND.md  # 后端重构计划（遗留 CRUD 清理 / 授权默认拒绝 / 迁移 V4–V5）
├── pom.xml                   # 后端 Maven 依赖
└── README.md                 # 项目说明
```

> 📖 **文档索引**：**先把项目跑起来看 [docs/STARTUP.md](docs/STARTUP.md)**；
> 然后读 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)（环境/规范/mock 机制）与
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（架构），
> 用 [docs/MODULES.md](docs/MODULES.md) 看功能实现状态，按 [docs/ROADMAP.md](docs/ROADMAP.md) 推进开发。

## 🚀 快速开始

机器上**只需要 Docker**：JDK 17 / Maven / Node 24 / MySQL 8 **全部在那个开发环境镜像里**，
宿主机无需安装任何依赖，也不用手动建库导表。

```bash
bash start.sh        # macOS / Linux
```
```bat
start.bat            ::  Windows:双击
```

脚本会：拉取环境镜像（拉不到才退回本机构建）→ 起容器 → 建库并导入全部 SQL → 恢复前端依赖 →
拉起前后端 → **等到服务真的开始应答**（收到 HTTP 响应，不是「端口能连上」）→
用 `admin` 账号验证一次登录 → 打开浏览器。首次约 **2 分钟**。

| 服务 | 地址 |
|------|------|
| 前端页面 | <http://localhost:5173> |
| 后端 API | <http://localhost:1000> |
| MySQL | `127.0.0.1:3306`（库 `template_v3`，root / `123456`） |

演示账号（密码均 `123456`）：管理员 `admin` / 买家 `user1` / 商家 `shop1`。

> 📖 **完整说明见 [docs/STARTUP.md](docs/STARTUP.md)**：常用命令、环境变量、不用脚本的手动方式、
> 不用 Docker 的裸机启动、故障排查表、端口与安全注意事项，都在那一份里。
>
> 只记三条就够：`bash start.sh` 启动 · `bash stop.sh` 停止（数据保留）· `bash dev.sh reset` 清库重来。

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

`web/tests/*.spec.ts` 为 Playwright e2e，**一律跑在 mock 模式下**：`web/playwright.config.ts` 用 `storageState` 在页面脚本执行前注入 `localStorage.RUNTIME_USE_MOCK='true'`（`storageState` 是 Playwright 唯一能在应用启动前写好 localStorage 的官方入口）。因此 **e2e 不需要后端就绪**，它验证的是前端自身行为在 mock 数据下的正确性。

> ⚠️ 由此的推论：**e2e 全绿 ≠ 前后端联调通过**。前端真实请求走 `web/.env` 的 `VITE_API_BASE_URL=/api`，再经 Vite 代理 `/api` → `:1000`（rewrite 去掉 `/api`，后端无 context-path）；这条真实链路目前**没有任何自动化测试覆盖**，要验证联调得手工打接口。

配置自带 `webServer`（`npm run dev`），忘开 dev server 会自动拉起：

```bash
cd web
npm install
npx playwright install chromium
npx playwright test
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
