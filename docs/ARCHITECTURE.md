# 系统架构

> 面向后续开发者:快速理解本项目「前后端分离」的整体结构、分层方式与认证鉴权链路。
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
| 认证 | JWT | jjwt 0.9.1 | HS256,24 小时有效期 |
| 部署 | 本地运行 | — | 前端 Vite :5173 + 后端 Spring Boot :1000(见 [DEVELOPMENT.md](DEVELOPMENT.md)) |

## 2. 系统拓扑

```
浏览器 (Vue SPA, Vite dev server :5173)
   │  /api/*  (Vite 代理 → :1000,去掉 /api 前缀)
   ▼
后端 :1000 (Spring Boot)
│  com.project.platform
│  ├─ controller/    19 个:门面控制器(Storefront*/Admin*/Merchant*/…)+ 3 个遗留(/common /file /shoppingCart)
│  ├─ service/ + service/impl/
│  ├─ mapper/ + resources/mapper/*.xml
│  ├─ entity/ dto/ vo/ utils/ config/
│  └─ RequestIdFilter → LoginInterceptor(白名单见 SpringMvcConfig)+ AuthzRules 规则表(默认拒绝)
   │  JDBC :3306 (localhost)
   ▼
MySQL 8.0 (本地)
│  库: template_v3
└─────────────────

## 3. 后端分层与控制器体系

分层严格单向依赖:**controller → service → mapper → 数据库**。响应统一走 `ResponseVO<T>`,分页走 `PageVO<T>`。

```
Controller                 Service(接口)            Mapper(接口)          resources/mapper/*.xml
  ├─ 接收/校验参数      →    ├─ 业务逻辑        →    ├─ 方法声明       →    ├─ 动态 SQL(queryPage 等)
  └─ 返回 ResponseVO        └─ Impl 实现             └─ @Select 快捷查询     └─ map-underscore-to-camel-case
```

### 控制器体系:门面为主,仅存 3 个遗留控制器

> 2026-09-24:14 个遗留 CRUD 控制器(AdminController / AdvertisingController / ProductBrowsingHistory / ProductCollect / Product / ProductOrder / ProductOrderEvaluate / ProductType / ShippingAddress / ShopCollect / Shop / Slideshow / User / StatisticalReportForms,约 90 个端点)**已物理删除** —— 它们前端 0 调用,却因旧的「默认放行」鉴权对任意登录用户开放。现在共 **19** 个控制器。

| | 门面控制器(16 个) | 遗留幸存者(3 个) |
|---|---|---|
| 前缀示例 | `/products` `/orders` `/admin` `/merchant` `/merchants` `/chat` `/account` `/addresses` `/checkout` `/payments` `/search` `/dashboard` `/coupons` `/returns` `/stock-alerts` `/notifications` | `/common`(登录/注册/当前用户)`/file`(上传下载)`/shoppingCart` |
| 面向 | Nexus 前端页面(英文路由) | 早期通用接口,前端仍在调用 |
| 注释 | 英文 | 中文 |
| 实现程度 | 部分端点仍为**硬编码占位**(见 [MODULES.md](MODULES.md)) | 真实 CRUD + 业务逻辑 |
| 鉴权 | `AuthzRules` 规则表逐前缀登记(见 §4) | 同样走规则表:`/common` 逐端点登记,`/file` 登录即可,`/shoppingCart` **只登记前端在用的 4 个端点** |

> ⚠️ 注意 `login` 与 `login` 系路径:登录走 `/common/login`(遗留体系),公开店铺页走 `/merchants/**`(门面体系,白名单),两者不同源。

## 4. 认证鉴权链路

```
请求 → RequestIdFilter(分配 requestId → MDC + X-Request-Id)
      → SpringMvcConfig 拦截 /**
      → 白名单直接放行(见下)
      → 否则 LoginInterceptor:
          1. 解析 token(header `token` 或 `Authorization: Bearer <token>`)
          2. 无 token / 非法 → 401,前端收到后清会话并跳登录
          3. OPTIONS 预检直接放行(CORS);`/file/**` 的图片 GET 也在这里放行
          4. checkRole → AuthzRules.isAllowed(路径, 角色):
             显式规则表 + **默认拒绝**。未登记路径匿名 401、已登录 403
```

**白名单**(`config/SpringMvcConfig.java` 的 `excludePathPatterns`,这些路径根本不进拦截器):

```text
/common/login  /common/register  /common/sendResetCode  /common/retrievePassword
/products/**  /search/**  /merchants/**
/checkout/summary  /checkout/promo
/error
```

> ⚠️ `/file/**` **不在**白名单:仅图片 GET(`.jpg/.jpeg/.png/.gif/.webp/.bmp`)由 `LoginInterceptor` 内部放行(商品图/头像由 `<img src>` 直连,带不了 token),其余扩展名与上传 POST 都需登录。
> ⚠️ `/error` 必须放行 —— 否则默认拒绝会把错误渲染本身变成 403,客户端拿不到真正的 4xx/5xx 语义。

> ⚠️ `/payments/create` **不在**白名单——创建支付需登录(后端依赖当前用户下单)。

**授权规则表**(`config/AuthzRules.java`,单一事实来源):`路径模式 → 允许角色集合`,用 `AntPathMatcher` 做**路径段**匹配(所以 `/admin/**` 不再误命中 `/admin-accounts`),按声明顺序求值、首个命中者生效、**未命中一律拒绝**。改这张表时须同时核对「前端 `api/modules/*.ts` 的真实调用面」与「`src/test/.../*Test.java` 的角色断言」,否则会出现页面静默 403 或既有测试变红。

**Token 细节**:HS256(`utils/JwtUtils.java`),24 小时过期,每次签发带唯一 `jti` 防重放。密钥优先取 `-Djwt.secret` → 环境变量 `JWT_SECRET`;**仓库里不放任何可用密钥**。两者都没提供时:非 prod profile 生成本次运行的**一次性随机密钥**(重启后旧 token 失效,前端按 401 跳登录),prod profile 则**直接拒绝启动**——不存在「回退到开发兜底值」这条路径(2026-09-26)。

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
│   └─ modules/*.ts       每个模块「mock 分支 + 真实后端分支」(例外:upload.ts 无 mock 分支 —— 上传只能打真实后端)
├─ src/stores/            Pinia:auth / cart / wishlist / coupons / returns / stockAlerts ...
└─ src/config/env.ts      USE_MOCK 开关解析
```

### mock 切换机制(关键)

```ts
// src/config/env.ts
USE_MOCK = localStorage.RUNTIME_USE_MOCK ?? (import.meta.env.VITE_USE_MOCK === 'true')
```

- 构建时由 `VITE_USE_MOCK` 固化(**当前 `web/.env` 里是 `false`**);运行时 `localStorage.RUNTIME_USE_MOCK` 可覆盖。
- 两类判断风格:模块级常量 `USE_MOCK`(import 时固化)与响应式 `RUNTIME_USE_MOCK.value`(调用时读取,切换立即生效,管理/商家端 admin*/merchant* 模块)。
- 生产构建默认 `VITE_USE_MOCK=false`:`.env.production` 只写 `VITE_API_BASE_URL=/api`,故构建产物沿用 `web/.env` 的 `false`,**不打 mock**(2026-09-26 核实,原「仍 mock=true」的说法已作废)。
- ✅ `chat.ts` 已补 mock 分支(2026-08-09):mock 模式下聊天全走本地假数据,不再打真实后端,避免假 token → 401 → 登录死循环。

## 6. 环境与配置

| 配置文件 | 说明 |
|---|---|
| `src/main/resources/application.yaml` | 端口 1000、默认 profile `dev`、MySQL localhost、上传限制 10MB、`files.uploads.path=uploads/`、`password=${SPRING_DATASOURCE_PASSWORD}` 与 `resetPassword=${RESET_PASSWORD}` **必填、无默认值**、MyBatis camel-case |
| `application-dev.yaml` | mapper SQL 走 `org.apache.ibatis.logging.slf4j.Slf4jImpl`(原 `StdOutImpl`:绕过 logback,既无 requestId 也不受 `logging.level` 控制);**本地弱口令默认值(123456)只存在于这里**,production 继承基配置的必填占位符 |
| `application-prod.yaml` | root WARN、`com.project.platform` INFO、mapper WARN;`security.expose-reset-code=false`(不回显找回密码验证码) |
| `logback-spring.xml` | 每行日志带 `%X{requestId:-no-request-id}`,与 `config/RequestIdFilter` 配对做请求串联 |
| `web/.env` | `VITE_API_BASE_URL=/api`、`VITE_USE_MOCK=false`(所有模式加载) |
| `web/.env.production` | 仅 `VITE_API_BASE_URL=/api` —— 不覆盖 `VITE_USE_MOCK`,故沿用 `.env` 的 `false` |
| `web/vite.config.ts` | 代理 `/api` → `http://localhost:1000`,rewrite 去 `/api`;别名 `@ → ./src`;manualChunks 分包 |

## 7. 数据库

- 建表/迁移脚本位于 `sql/`:`sql/schema.sql`(基础表+演示种子,含 admin 账号)、`sql/chat.sql`(聊天表)、`sql/migrations/`(V1–V5 增量:`V4__constraints_and_indexes.sql` = 6 个唯一键 + 13 个索引,`V5__money_decimal_round2.sql` = 补 4 列金额为 DECIMAL(10,2))、`sql/migration-2026-08-08-phase1.sql`(一期新增表增量迁移,含中文种子,执行时须加 `--default-character-set=utf8mb4`,否则中文双重编码成乱码)。
- ⚠️ `sql/migrations/*.sql` 是**手工执行**的(docker 入口只在首次建库时导入)。回滚脚本刻意放在 `sql/migrations/rollback/` 子目录:入口脚本会 glob 导入 `sql/migrations/*.sql`,放同级会被当成迁移自动执行、反而把迁移撤销掉。
- ⚠️ 完整 schema 以 `sql/schema.sql` 为基础,再由 `sql/migrations/` + `migration-2026-08-08-phase1.sql` 逐步叠加。
- 测试用 H2 建表:`src/test/resources/schema-h2.sql`(MODE=MySQL)。

## 8. 已知架构层面的技术债

1. **支付网关仍是模拟的**:`payment` 表已建,`/payments/create` 真实落库 + 原子扣库存 + 走状态机(2026-09-24 落地,不再是纯 mock 返回);剩余问题是**没有真实商户号与回调验签**,接微信/支付宝时须换成「网关下单 + 回调验签 + 幂等入账」。
2. **钱包无表无 Service**:商家钱包硬编码在 `MerchantApiController`。
3. **`/checkout/promo` 仍信任前端 subtotal**:`/checkout/summary` 已改为按 DB `product.price` 重算(不再信任前端 price),但 promo 折扣仍以请求体里的 `subtotal` 计算。
4. **搜索无独立 Service**:trending/facets 硬编码或空;无全文检索。
5. **前端部分本地 store 与后端未同步**:购物车/心愿单/浏览历史/对比 仍在 localStorage(优惠券/退换货/到货订阅已在 Phase 1 后端化)。
