# 系统架构

> 面向后续开发者:快速理解本项目「前后端分离 + Docker 部署」的整体结构、分层方式与认证鉴权链路。
> 配套文档:[模块与实现状态](MODULES.md)· [后端接口契约](backend-api.md)· [开发指南](DEVELOPMENT.md)· [开发路线图](ROADMAP.md)

## 1. 技术栈总览

| 层 | 技术 | 版本 | 说明 |
|----|------|------|------|
| 前端框架 | Vue | 3.4 | Composition API + `<script setup>` |
| 构建 | Vite | 5 | 代理 `/api` → 后端 :1000 |
| 状态 | Pinia | 2.2 | 登录态 + 本地数据 store |
| UI | Element Plus + Tailwind | 2.8 / 4 | unplugin 自动按需引入 |
| HTTP | Axios | 1.x | 统一拦截器 + 401 处理 |
| 图表 | ECharts | 5.5 | 管理端收入图(按需注册) |
| 后端框架 | Spring Boot | 3.2.10 | Java 17 |
| 持久层 | MyBatis | 3.0.4 | Mapper 接口 + XML,手写动态 SQL |
| 数据库 | MySQL | 8.0 | utf8mb4 |
| 认证 | JWT | jjwt 0.9.1 | HS256,30 天有效期 |
| 部署 | Docker Compose | — | MySQL / Backend / Nginx 三容器 |

## 2. 系统拓扑

```
浏览器 (Vue SPA)
   │  /api/*  (Vite dev proxy 或 Nginx /api 反代,去掉 /api 前缀)
   ▼
┌───────────────────── 前端 :5173 ─────────────────────┐
│  web/  (Vue 3 + Vite)                                │
│  ├─ src/router        路由 + 角色守卫                  │
│  ├─ src/pages         用户端 / 用户中心 / 商家端 / 管理端 │
│  ├─ src/api/modules   每模块一个 api 文件(mock/真实双分支)│
│  ├─ src/stores        Pinia:登录态 + 本地数据 store      │
│  └─ src/config/env    mock 开关 / API base             │
└──────────────────────────────────────────────────────┘
              │  HTTP :1000 (JSON, {code,msg,data})
              ▼
┌───────────────────── 后端 Spring Boot :1000 ──────────────────────┐
│  com.project.platform                                             │
│  ├─ controller/  两套体系:                                     │
│  │   ├─ 门面控制器(面向 Nexus 前端):Storefront* / AdminApi /   │
│  │   │   MerchantApi / Chat,路径与前端 api/modules 对齐         │
│  │   └─ 传统 CRUD 控制器(/product /user /productOrder ...)     │
│  ├─ service/(接口) + service/impl/(实现)                        │
│  ├─ mapper/(接口) + resources/mapper/*Mapper.xml(动态 SQL)     │
│  ├─ entity/ 纯 POJO(无 Lombok,手写 getter/setter)             │
│  ├─ dto/ vo/ exception/ utils/ config/ interceptor/            │
│  └─ LoginInterceptor + SpringMvcConfig(白名单)                 │
└─────────────────────────────────────────────────────────────────┘
              │  JDBC :3306
              ▼
┌───────────────────── MySQL 8.0 ─────────────────────┐
│  库: template_v3                                     │
│  22 张表(16 基础 + 6 张 Phase 1 新增),定义见          │
│  docker/mysql/init/01-schema.sql(权威来源)            │
│  (仓库根 sql/templatev3_s.sql 仅含 admin 表,已过时)     │
└─────────────────────────────────────────────────────┘
```

### Docker 部署(3 容器)

| 服务 | 容器名 | 端口映射 | 说明 |
|------|--------|----------|------|
| mysql | xmsz-mysql | 3307→3306 | 首次启动执行 `docker/mysql/init/*.sql`(建表+种子) |
| backend | xmsz-backend | 1000→1000 | Spring Boot,通过 `SPRING_DATASOURCE_URL` 等环境变量覆盖默认配置 |
| frontend | xmsz-frontend | 5173→80 | Nginx 托管构建产物,`/api` 反代到 backend |

后端容器内的关键环境变量覆盖(`docker-compose.yml`):

```yaml
SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/template_v3?...   # 容器间用服务名 mysql
FILES_UPLOADS_PATH: /app/uploads                                  # 上传目录(挂载宿主 ./uploads)
FILES_UPLOADS_BASEURL: http://localhost:1000/file                 # 上传文件访问前缀
```

## 3. 后端分层与两套控制器体系

分层严格单向依赖:**controller → service → mapper → 数据库**。响应统一走 `ResponseVO<T>`,分页走 `PageVO<T>`。

```
Controller                 Service(接口)            Mapper(接口)          resources/mapper/*.xml
  ├─ 接收/校验参数      →    ├─ 业务逻辑        →    ├─ 方法声明       →    ├─ 动态 SQL(queryPage 等)
  └─ 返回 ResponseVO        └─ Impl 实现             └─ @Select 快捷查询     └─ map-underscore-to-camel-case
```

### 门面 / 传统 两套控制器

| | 门面控制器(Facade) | 传统 CRUD 控制器 |
|---|---|---|
| 前缀示例 | `/products` `/orders` `/admin` `/merchant` `/merchants` `/chat` `/account` `/addresses` `/checkout` `/payments` `/search` `/dashboard` + Phase 1 新增 `/coupons` `/returns` `/stock-alerts` `/notifications` | `/product` `/user` `/productOrder` `/shoppingCart` `/common` `/shop` `/productType` ... |
| 面向 | Nexus 前端页面(英文路由) | 平台型中后台通用 CRUD |
| 注释 | 英文 | 中文 |
| 实现程度 | 部分端点仍为**硬编码占位**(见 [MODULES.md](MODULES.md)) | 基本真实 CRUD + 少量业务(库存/销量/状态机) |
| 鉴权 | `/admin`→ADMIN、`/merchant/`→SHOP、其余登录即可 | 登录即可,角色按需 |

> ⚠️ 注意 `login` 与 `login` 系路径:登录走 `/common/login`(传统体系),公开店铺页走 `/merchants/**`(门面体系,白名单),两者不同源。

## 4. 认证鉴权链路

```
请求 → SpringMvcConfig 拦截 /** 
      → 白名单直接放行(见下)
      → 否则 LoginInterceptor:
          1. 解析 token(header `token` 或 `Authorization: Bearer <token>`)
          2. 无 token / 非法 → 401,前端收到后清会话并跳登录
          3. OPTIONS 预检直接放行(CORS)
          4. checkRole(仅 /admin 需 ADMIN,/merchant/ 需 SHOP)
```

**白名单**(`config/SpringMvcConfig.java`):

```text
/common/login  /common/register  /common/retrievePassword
/file/**
/products/**  /search/**  /merchants/**
/checkout/summary  /checkout/promo
```

> ⚠️ `/payments/create` **不在**白名单——创建支付需登录(后端依赖当前用户下单)。

**Token 细节**:HS256,硬编码密钥 `1234567890`(`utils/JwtUtils.java`),30 天过期。密钥外置已列入 [ROADMAP.md](ROADMAP.md) Phase 4。

## 5. 前端结构

```
web/
├─ src/router/index.ts    路由表 + 守卫(requiresAuth / guestOnly / role)
├─ src/router/preload.ts  按角色/空闲预算预取懒加载 chunk
├─ src/pages/             页面组件(全部懒加载)
│   ├─ (根)               Home / ProductDetail / SearchResults / Cart / Checkout / StorePage ...
│   ├─ dashboard/         用户中心(订单/地址/心愿单/退换货/优惠券/设置/消息)
│   ├─ merchant/          商家端(首页/商品/订单/钱包/设置/消息)
│   └─ admin/             管理端(首页/用户/商家审核/商品/订单/评论/设置/通知)
├─ src/api/
│   ├─ http.ts            axios 实例:base=API_BASE_URL、12s 超时、401 清会话跳登录
│   └─ modules/*.ts       每个模块「mock 分支 + 真实后端分支」(唯一例外 chat.ts 纯后端)
├─ src/stores/            Pinia:auth / cart / wishlist / coupons / returns / stockAlerts ...
└─ src/config/env.ts      USE_MOCK 开关解析
```

### mock 切换机制(关键)

```ts
// src/config/env.ts
USE_MOCK = localStorage.RUNTIME_USE_MOCK ?? (import.meta.env.VITE_USE_MOCK === 'true')
```

- 构建时 `VITE_USE_MOCK=true` 固化;运行时 `localStorage.RUNTIME_USE_MOCK` 可覆盖。
- 两类判断风格:模块级常量 `USE_MOCK`(import 时固化)与响应式 `RUNTIME_USE_MOCK.value`(调用时读取,切换立即生效,管理/商家端 admin*/merchant* 模块)。
- ⚠️ 生产构建 `.env.production` 未显式覆盖 `VITE_USE_MOCK`,默认仍 mock=true(见 [ROADMAP.md](ROADMAP.md) Phase 4)。
- ⚠️ `chat.ts` 无 mock 分支,无后端时消息页必然报错。

## 6. 环境与配置

| 配置文件 | 说明 |
|---|---|
| `src/main/resources/application.yaml` | 端口 1000、默认 profile `dev`、MySQL localhost、上传限制 100MB、`files.uploads.path=uploads/`、`resetPassword=123456`、MyBatis camel-case |
| `application-dev.yaml` | mapper SQL 打 stdout |
| `application-prod.yaml` | 日志改 slf4j,root WARN |
| `web/.env` | `VITE_API_BASE_URL=/api`、`VITE_USE_MOCK=true`(所有模式加载) |
| `web/.env.development` | 含未使用的 `VITE_APP_API_URL`(代码实际读 `VITE_API_BASE_URL`) |
| `web/.env.production` | 仅 `VITE_API_BASE_URL=/api`(未覆盖 mock) |
| `web/vite.config.ts` | 代理 `/api` → `http://localhost:1000`,rewrite 去 `/api`;别名 `@ → ./src`;manualChunks 分包 |

## 7. 数据库

- 正式建表 + 种子数据:**`docker/mysql/init/01-schema.sql`**(22 张表,权威来源)。
- 对已初始化的运行中库补表:增量迁移 **`sql/migration-2026-08-08-phase1.sql`**(含中文种子,执行时须加 `--default-character-set=utf8mb4`,否则中文双重编码成乱码)。
- 聊天表:**`sql/chat.sql`**(conversation / message)。
- ⚠️ 仓库根 `sql/templatev3_s.sql` **只有 admin 表,已过时**,本地开发请勿再导入它;以 docker init 脚本为准。
- 测试用 H2 建表:`src/test/resources/schema-h2.sql`(MODE=MySQL,与主 schema 对齐)。

## 8. 已知架构层面的技术债

1. **支付无表无业务**:`/payments/*` 为纯 mock 返回,Phase 2 需落地(见路线图)。
2. **钱包无表无 Service**:商家钱包硬编码在 `MerchantApiController`。
3. **结算信任前端价格**:`/checkout/summary` 直接用前端传入 price 计算,未做服务端校验。
4. **搜索无独立 Service**:trending/facets 硬编码或空;无全文检索。
5. **前端部分本地 store 与后端未同步**:购物车/心愿单/浏览历史/对比 仍在 localStorage(优惠券/退换货/到货订阅已在 Phase 1 后端化)。
6. **两套控制器并存**:门面薄转发 + 传统 CRUD 各成体系,新增端点需明确归属。
