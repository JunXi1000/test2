# TASK-000-B · 系统架构评估与任务依赖树

> **作者**:architect(系统架构 Agent) · **日期**:2026-09-26
> **输入**:本轮输入 `docs/TASK-000/01-REQUIREMENTS-AUDIT.md` **尚未就绪**(产品分析 Agent 进行中)。
> 本文档按团队约定先用 `docs/REQUIREMENTS-GAP.md` + `docs/MODULES.md` + **逐文件代码抽查**做初版;
> 待 TASK-000-A 产出后,本 Agent 负责做一次对齐修订并标注 v2。
>
> **本文档性质**:**契约冻结件**。§3 API 契约、§4 数据库变更、§5 权限条目一经定稿,
> 下游开发 Agent(backend / frontend / database / qa)必须遵守;Review Gate(task-7)按本文档逐项核对。
> 开发 Agent 发现本文档与代码冲突,**上报总控**,不得自行改契约。

---

## 0. 基线与技术栈(不变更)

| 层 | 技术 | 版本 | 本轮是否变更 |
|----|------|------|:---:|
| 后端 | Spring Boot / Java | 3.2.10 / 17 | ❌ 不变 |
| 持久层 | MyBatis + 手写 XML/`@Select` | 3.0.4 | ❌ 不变 |
| 数据库 | MySQL 8(测试用 H2 `MODE=MySQL`) | 8.0 | ❌ 不变 |
| 认证 | JWT(jjwt HS256) + BCrypt | 0.9.1 | ❌ 不变 |
| 序列化 | Fastjson2 + Lombok | — | ❌ 不变 |
| 前端 | Vue 3 + TS + Vite 5 | 3.4 / 5.9 / 5 | ❌ 不变 |
| 状态/UI | Pinia 2 + Element Plus 2.8 + Tailwind 4 | — | ❌ 不变 |
| HTTP | axios(统一走 `web/src/api/http.ts`) | 1.x | ❌ 不变 |

> **技术栈由用户最终决定**,本 Agent 不提出替换方案。发现的栈级问题一律进 §9「待用户确认的重大决策」,
> 本轮**一律不实施**。

---

## 1. 架构约束核验(逐条回代码验证)

> 方法:不信文档,直接读源码。每条给出证据路径与行号。

| # | 约束 | 核验结论 | 证据 |
|---|------|---------|------|
| V1 | **默认拒绝**:未登记路径对所有角色 403 | ✅ 成立 | `config/AuthzRules.java:115-125` 遍历 `RULES`,未命中 `return false`;`LoginInterceptor.java:89-91` 只委托 `AuthzRules.isAllowed` |
| V2 | **匿名 401 / 已登录 403**(不泄漏路径存在性) | ✅ 成立 | `LoginInterceptor.java:57-62`(无 token → `CustomException(UNAUTHORIZED)`)、`:71-73`(角色不符 → `CustomException(FORBIDDEN)`);两者在 handler 解析之前 |
| V3 | **AntPathMatcher 路径段匹配**,非前缀 | ✅ 成立 | `AuthzRules.java:42,120`;回归断言见 `AuthzRulesTest.java:52-59` |
| V4 | **白名单在拦截器之外** | ✅ 成立 | `SpringMvcConfig.java:17-36` `excludePathPatterns` 共 9 条 |
| V5 | **统一响应** `ResponseVO{code,msg,data}` | ✅ 成立 | `vo/ResponseVO.java`;`code=200` 成功,`msg`/`data` **双写原因**(失败时 `:36-38`) |
| V6 | **分页** `PageVO{list,total}` | ✅ 成立 | `vo/PageVO.java`;`PageParams.MAX_PAGE_SIZE=100`(`utils/PageParams.java:9`) |
| V7 | **错误码 = HTTP 状态码**,无独立业务码空间 | ✅ 成立 | `ResponseVO.fail(e.getHttpStatus().value(), e.getMessage())`,`exception/GlobalExceptionHandler.java:28-34`;5 类客户端异常已各配处理器(`:75-130`),其余落 `:132-139` 的 500 |
| V8 | **前端只认 `code===200`** | ✅ 成立 | `web/src/api/http.ts:30`(`res.code===0 \|\| res.code===200`) |
| V9 | **前端 401 集中处理** | ✅ 成立 | `web/src/api/http.ts:41-61`;业务代码不得另写 401 逻辑 |
| V10 | **前端请求必须走 `api/modules/*`**,页面不裸调 axios | ✅ 成立 | `web/CLAUDE.md` §3;34 个模块文件 |
| V11 | **mock 分支必须保留** | ⚠️ 部分 | `http.ts` 之外,`api/modules/*.ts` 逐模块保留;新增模块须同备 mock 兜底,否则 mock 模式登录会 401 死循环 |
| V12 | **金额服务端按 DB 价格计算** | ⚠️ 部分 | `StorefrontCheckoutController` 已重算;**但 `/checkout/promo` 仍信任请求体 `subtotal`**(ARCHITECTURE §8.3,本轮一并修) |
| V13 | **`schema-h2.sql` 必须三处同步** | ✅ 成立 | `src/test/resources/schema-h2.sql`(315 行,23 表,已含 `payment`/`coupon`/`notification` 等) |
| V14 | **回滚脚本放 `sql/migrations/rollback/`** | ✅ 成立 | `docker/entrypoint.sh` 非递归 glob `sql/migrations/*.sql`;目录内已有 4 个回滚样本 |
| V15 | **迁移需手工执行**(entrypoint 只在首次建库导入) | ✅ 成立 | `${DATA_DIR}/.schema-imported` 标记文件 |
| V16 | **`AuthzRules` 已有 `/admin/**`、`/merchant/**` 兜底规则** | ✅ 成立 | `AuthzRules.java:87,90` |

### 🔑 V16 的战略含义(本轮最大架构杠杆)

`new Rule("/merchant/**", SHOP)` 与 `new Rule("/admin/**", ADMIN)` 是**通配兜底**。
这意味着:

> **所有挂在 `/admin/**` 与 `/merchant/**` 下的新端点,默认已被授权表覆盖,不需要新增任何 `AuthzRules` 条目。**

本轮 90% 的后端缺口(看板/钱包/设置/下架/评论审核)都落在这两个前缀下 → **权限改造面几乎为零**。
只有**新增一级前缀**才需要改规则表(见 §5)。这大幅降低了授权回归风险。

### 🔴 代码抽查新发现(文档未记载的架构级缺陷)

| # | 缺陷 | 严重度 | 证据 | 归属 |
|---|------|:---:|------|------|
| **F1** | **对象级越权**:`GET /merchant/orders/{id}` 无归属校验,任意 SHOP 可读任意订单(含他人买家信息) | **Blocker** | `MerchantApiController.java:132-135` 直接 `productOrderService.selectById(id)` 返回。`utils/AccessGuard.java:20` 已有现成的 `checkOrderOwner`,**但此处没用** | backend |
| **F2** | **契约空转**:`PUT /admin/settings` 与 `PUT /merchant/settings` 返回 `data:null`,而前端声明返回 `AdminSettings`/`MerchantSettings` 并直接 merge → 拿到 null | **Major** | 后端 `AdminApiController.java:337-342`、`MerchantApiController.java:227-232` 返回 `ResponseVO.ok()`;前端 `adminSettings.ts:28`、`merchantSettings.ts:56` 声明 `put<AdminSettings>(...)` | backend(契约见 AC-12/AC-13) |
| **F3** | **POST 语义欺骗**:`POST /merchant/wallet/withdraw` 接收请求体但**从不读取**,仍返回 200 → 前端以为提现已受理,钱没动 | **Blocker** | `MerchantApiController.java:199-205`;前端 `merchantWallet.ts:96-100` 明确 POST `{amount, destinationId, destinationLabel}` | backend(契约见 AC-16) |
| **F4** | **下架语义错误**:`DELETE /admin/products/{id}/ban` 用 `setStock(0)` 实现「下架」,商品表无状态字段 | **Major** | `AdminApiController.java:246-251`;`sql/schema.sql:89-102` 无 `status` 列 | backend+database(契约见 AC-19) |
| **F5** | **管理端列表三处静默截断 + 内存过滤**:`/admin/products`(`/admin/orders`)硬取 `page(...,1,100)`;`/admin/users`、`/admin/reviews` 直接 `service.list()` 全表进内存 | **Major** | `AdminApiController.java:225,267,74,295` | backend(契约见 AC-7~AC-10) |
| **F6** | **`role` 过滤恒返回空**:选任何非 `all` 的角色,`filter` 对每行都 `return false` → 列表恒空 | **Major** | `AdminApiController.java:77` `if (role != null && !"all".equals(role)) return false;` | backend |
| **F7** | **商家状态语义塌缩**:`pending`/`suspended`/`rejected` 三个前端状态全部映射成 DB 的「禁用」,管理端无法区分待审核与已拒绝 | **Major** | `AdminApiController.java:142-145` | backend + database(需 `shop.status` 扩枚举值,**非破坏性**) |
| **F8** | **前端类型与后端字段语义错配**:`AdminProduct.status` 声明 `'active'\|'draft'\|'archived'\|'banned'`,后端恒返回 `"active"` → 「已封禁」页永远空 | **Major** | `web/src/api/modules/adminProducts.ts:9,39` vs `AdminApiController.java:239` | backend(契约见 AC-19) |
| **F9** | **`MerchantApiController.createProduct` 全量实体绑定**:`@RequestBody Product` 让客户端可注入 `salesVolume`、`createTime`、`price` | **Major** | `MerchantApiController.java:84-88`(只强制覆盖了 `shopId`) | backend(收紧为 DTO + `@Valid`) |
| **F10** | **H2 兼容约束**:测试 schema **不支持** `ENGINE`/`COMMENT`/反引号,`ON UPDATE CURRENT_TIMESTAMP` 也不可靠 | Minor(但会卡住 database Agent) | `src/test/resources/schema-h2.sql:4-15` 的简化写法 | database |
| **F11** | **`shop.nickname` 被双重占用**:既是「店长昵称」(`sql/schema.sql:63` 注释),又被 `/merchant/settings` 当 `description` 用 | Minor | `MerchantApiController.java:216` `settings.put("description", shop.getNickname())` | backend(契约见 AC-13) |
| **F12** | **`selectTypeCount` 用的是 INNER JOIN**,零商品分类不出现;且不按状态过滤 | Minor | `ProductMapper.java:33-34` | backend(AC-1 已指定口径) |

---

## 2. 缺口 → 负责人映射表

> **依据 Agent 的 capabilities,不是名字。** 当前在册团队见 §2.2。

### 2.1 映射表

| 缺口 ID | 缺口 | 文件:行 | **所需能力** | **归属** | 批次 |
|---------|------|---------|------------|---------|:---:|
| G1 | `/admin/dashboard/stats` 硬编码 `$0` | `AdminApiController.java:35-46` | SQL 聚合 + Java | **backend** | 1 |
| G2 | `/admin/dashboard/revenue-chart` 空列表 | `AdminApiController.java:63-66` | SQL 聚合 + Java | **backend** | 1 |
| G3 | `recent-users` 全表扫 + 任意顺序 limit 5 | `AdminApiController.java:48-61,74` | SQL | **backend** | 1 |
| G4 | `PUT /admin/reviews/{id}` no-op(入参被丢弃) | `AdminApiController.java:312-317` | Java + 新列 | **backend**(列由 **database**) | 2 |
| G5 | `GET /admin/settings` 硬编码 | `AdminApiController.java:327-335` | Java + 新表 | **backend**(表由 **database**) | 2 |
| G6 | `PUT /admin/settings` no-op + **返回 null**(F2) | `AdminApiController.java:337-342` | Java | **backend** | 2 |
| G7 | `/merchant/dashboard/stats` 硬编码 | `MerchantApiController.java:38-48` | SQL 聚合 | **backend** | 1 |
| G8 | `/merchant/wallet` 恒 0,无表无 Service | `MerchantApiController.java:185-192` | Java + 新表 | **backend**(表由 **database**) | 2 |
| G9 | `/merchant/wallet/transactions` 空列表 | `MerchantApiController.java:194-197` | Java | **backend** | 2 |
| G10 | `POST /merchant/wallet/withdraw` no-op + **吞 body**(F3) | `MerchantApiController.java:199-205` | Java | **backend** | 2 |
| G11 | `GET /merchant/settings` 部分硬编码(`location`/`responseTime`/`policies`) | `MerchantApiController.java:209-225` | Java + 新表 | **backend**(表由 **database**) | 2 |
| G12 | `PUT /merchant/settings` no-op + **返回 null**(F2) | `MerchantApiController.java:227-232` | Java | **backend** | 2 |
| G13 | `/search/trending` 硬编码关键词 | `StorefrontSearchController.java:54-59` | SQL 聚合 | **backend** | 1 |
| G14 | `POST /search` facets/relatedSearches 空 | `StorefrontSearchController.java:102-103` | SQL 聚合 | **backend** | 1 |
| G15 | `/products/category-counts` 全 0 | `StorefrontProductController.java:79-89` | Java(**SQL 已就绪**:`ProductMapper.java:33`) | **backend** | 1 |
| G16 | `/merchants/{id}/profile` stats/featured/policies 硬编码 | `StorefrontMerchantController.java:45-59` | SQL 聚合 | **backend** | 1 |
| G17 | `/merchants/{id}/products` categories 恒 `["All"]` | `StorefrontMerchantController.java:79` | Java | **backend** | 1 |
| G18 | `PUT /addresses/{id}/default` no-op | `StorefrontAddressController.java:56-60` | Java + 新列 | **backend**(列由 **database**) | 2 |
| F1 | **`/merchant/orders/{id}` 对象级越权** | `MerchantApiController.java:132-135` | Java | **backend** | 0(独立,优先级最高) |
| F4/F8 | 下架语义错误 + 状态字段缺失 | `AdminApiController.java:246-251,239` | Java + 新列 | **backend** + **database** | 2 |
| F5/F6 | 管理端列表静默截断 / `role` 过滤恒空 | `AdminApiController.java:74,77,225,267,295` | Java + 前端分页 UI | **backend** + **frontend** | 2 |
| F7 | 商家状态语义塌缩 | `AdminApiController.java:142-145` | Java + 枚举扩展 | **backend** + **database** | 2 |
| F9 | `createProduct` 全量实体绑定 | `MerchantApiController.java:84-88` | Java | **backend** | 0 |
| F12 | `selectTypeCount` INNER JOIN + 不过滤状态 | `ProductMapper.java:33` | Java | **backend** | 1 |
| P1 | 前端 6 个域页面的 Loading/Empty/Error/Success 四态与响应式 | `web/src/pages/**` | Vue 3 + TS + Element Plus + Tailwind | **frontend** | 3 |
| P2 | 前端对接真实后端响应(G1/G2/G7/G13/G14/G15/G16/G17 的数据结构已变) | `web/src/api/modules/*.ts` + `web/src/pages/**` | Vue 3 + TS | **frontend** | 3 |
| P3 | 管理端列表分页 UI(配合 F5) | `web/src/pages/admin/**` | Vue 3 + TS | **frontend** | 3 |
| T1 | 新增/变更端点的 MockMvc 回归 | `src/test/java/**` | Java + JUnit + MockMvc + H2 | **qa** | 4 |
| T2 | 授权回归(默认拒绝/角色不跨域/**对象级越权 F1**) | `src/test/java/**` | 同上 | **qa** | 4 |
| T3 | 错误模型回归(5 类异常 → 4xx) | `ErrorModelTest.java` | 同上 | **qa** | 4 |
| T4 | Playwright e2e(mock 模式 + `storageState` 注入 `RUNTIME_USE_MOCK`) | `web/tests/**` | Playwright + TS | **qa** | 4 |
| E1 | 环境/构建/起服务/冒烟 | `docker/`、启动脚本 | 构建与运维 | **devops** | 与批次 0-3 并行 |

### 2.2 ⚠️ 团队能力缺口(必须上报总控)

当前在册 4 名 Agent(`product-analyst` / `architect` / `database` / `backend`)覆盖不了上表的 **P1/P2/P3(前端)** 与 **T1–T4(测试)**。
任务板上的 `task-5`(TASK-000-E 前端)与 `task-6`(TASK-000-F 测试)目前**没有对应执行者**。

> **建议总控增补 2 名 teammate**:`frontend`(Vue 3 + TS + Element Plus + Tailwind 4 能力)、
> `qa`(Junit5 + MockMvc + H2 + Playwright 能力)。`task-8`(TASK-000-H 环境)可由 `devops` 能力者承担。
> 在补齐前,**批次 3(前端)与批次 4(测试)无法启动**。

---

## 3. 任务依赖图

### 3.1 现状 vs 优化

任务板当前链路是**完全串行**:`A → B → C(DB) → D(Backend) → E(Frontend) → F(Test) / G(Review)`。

**这是过度串行。** 本轮的关键发现是:**批次 1 的后端补全零 DB 变更**,因此后端批次 1 与数据库批次可以**完全并行**。

```
现状(串行,过度):
  A ──▶ B ──▶ C(DB) ──▶ D(Backend) ──▶ E(Frontend) ──▶ F(Test)
                                     └──▶ G(Review)

优化后(按批次 + 写集隔离):
  ┌── PG-0 立即并行 ──────────────────────────────────────────┐
  │  A(产品,只读)   B(架构,只读)   H(环境搭建)                │
  └───────────────────────────────────────────────────────────┘
                  │
                  ▼
  ┌── PG-1 并行(写集零重叠)───────────────────────────────────┐
  │  C1: database  → sql/** + schema-h2.sql                  │
  │  D0: backend   → 对象级越权 F1 + 入参收紧 F9(无 DB 依赖)  │
  │  D1: backend   → 批次1 聚合查询(无 DB 依赖)               │
  └───────────────────────────────────────────────────────────┘
                  │                    │
                  ▼                    ▼
  ┌── PG-2 并行 ─────────────────┐  ┌── PG-3 ──────────────────┐
  │  D2: backend(需 C1 产物)    │  │  E1: frontend            │
  │  E0: frontend(契约已冻结,   │◀─┤     批次1 对接            │
  │      可提前开工)            │  └───────────────────────────┘
  └─────────────────────────────┘
                  │
                  ▼
  ┌── PG-4 并行 ──────────────────────────────────────────────┐
  │  F1: qa(后端 + 授权 + 错误模型)   G: Review Gate          │
  │  F2: qa(Playwright e2e)                                    │
  └───────────────────────────────────────────────────────────┘
```

### 3.2 并行分组明细

| 组 | 成员 | 前置 | 写集 | 可并行性依据 |
|:--:|------|------|------|------------|
| **PG-0** | A / B / H | 无 | 仅 `docs/TASK-000/**`、H 占 `docker/`+脚本 | 三者写集零重叠 |
| **PG-1** | C1(database) | B | `sql/**`、`src/test/resources/schema-h2.sql` | 与 D 组写集零重叠 |
| **PG-1** | D0(backend·安全) | B | `src/main/java/**/MerchantApiController.java` | **零 DB 依赖**,可立即开工 |
| **PG-1** | D1(backend·聚合) | B | `src/main/java/**/*Controller`、`**/mapper/*.xml` | **零 DB 依赖**(G15 的 SQL 已在 `ProductMapper.java:33` 就绪) |
| **PG-2** | D2(backend·新表) | C1 + D1 | `src/main/java/**` | 需要 C1 的建表;与 D0/D1 同文件时**必须串在 D1 之后** |
| **PG-2** | E0(frontend) | B(**契约已冻结**) | `web/src/**` | 契约在本文档 §4 冻结,不必等后端落地即可写类型与页面 |
| **PG-3** | F1/F2(qa) | D1 + D2 + E0 | `src/test/**`、`web/tests/**` | 测试用例可先写(红),后端落地后转绿 |
| **PG-3** | G(review) | D1 + D2 | 仅 `docs/TASK-000/07-CODE-REVIEW.md` | 纯只读审查 |

### 3.3 🚨 共享文件冲突点(**必须错开,否则合并冲突/覆盖**)

> 任务板给每个任务的 `writeScopes` 都写成目录级(如 `docs/TASK-000`、`src/main/java`),
> **write scope 重叠告警会一直亮**。下表是实际会撞车的具体文件。

| # | 共享文件 | 潜在竞争者 | 冲突形态 | **强制缓解措施** |
|:--:|---------|-----------|---------|----------------|
| **X1** | `docs/backend-api.md` | backend(task-4) · qa(task-6) · architect(本任务) | 三方都往 §1 表格追加行 | **契约已冻结在本文档 §4**。`docs/backend-api.md` **由 backend Agent 独占编辑**;qa 不得改;**本轮结束后**由 architect 或总控统一补 |
| **X2** | `src/main/java/com/project/platform/config/AuthzRules.java` | backend(task-4) · qa(task-6,若加断言) | 规则表追加条目 | **只有 backend 可改**(§5 已把需新增条目写死)。qa 新增断言前**必须先读最新版本**;AuthzRulesTest 是纯单测,加断言不冲突 |
| **X3** | `src/test/resources/schema-h2.sql` | database(task-3) · qa(task-6) | 三处同步 | **只有 database 可改**(F10 约束)。qa 只写 `src/test/java/**` |
| **X4** | `src/test/java/**` | backend(顺手加测试) · qa(task-6) | 追加/重写 | **硬性规则:backend 本轮不写任何 `src/test/**`**(写完上报,由 qa 补测试)。qa 独占 |
| **X5** | `docs/TASK-000/*.md` | 全部 6 名 Agent | **write scope 都是目录级 `docs/TASK-000`,必然告警** | 每人**只写自己编号的文件**(`01-`…`08-`)。请总控把 task 的 `writeScopes` 从目录级改成**文件名级** |
| **X6** | `docs/MODULES.md`、`docs/REQUIREMENTS-GAP.md`、`docs/ROADMAP.md`、`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md` | backend(改状态标记) · 我(architect) | 状态漂移、双写 | **TASK-000 期间一律不改**。所有状态变更只写在 `docs/TASK-000/` 内;**收尾由总控指派专人统一同步** |
| **X7** | `pom.xml` | backend(加依赖) · devops(task-8,构建) | 依赖冲突 | backend **加任何新依赖前必须先报总控**(尤其 §9 的待决项);devops 只读不改 |
| **X8** | `web/src/api/modules/*.ts` | frontend(task-5) · qa(task-6,Playwright mock) | 改契约 / 改 mock 数据 | frontend 独占 `web/src/**`;**qa 的 mock 数据只允许写在 `web/tests/**`**,不得回写 `web/src` |
| **X9** | `application-test.yaml` / H2 初始化逻辑 | backend · database · qa | 新表在测试环境装载 | 归 database;backend 不得改测试配置 |
| **X10** | `target/`(Maven 构建产物) | backend(`mvn test`)· devops(`mvn package`)· qa(`mvn clean test`) | **OneDrive 同步目录锁文件**,`clean` 删不掉 | 见 `DEVELOPMENT.md` §7:**任何 `mvn` 命令前先 `pkill -f "[s]pring-boot:run"`**;devops 的构建窗口与 qa 的测试窗口**错开** |

### 3.4 必须串行(不可并行)的硬约束

1. **C1(database) → D2(backend 批次2)** — D2 的 Mapper XML 引用 `merchant_wallet_transaction` / `system_setting` / `shop_setting` 三张新表与 4 个新列,表不存在则测试全红。
2. **C1(database) → F1(qa)** — 新表未进 `schema-h2.sql` 时,qa 的钱包/设置用例会报表不存在(README 明确警告)。
3. **D1/D2(backend) → F1(qa)** — 无实现则断言必红。
4. **E0(frontend) → F2(qa e2e)** — e2e 依赖真实组件结构。
5. **D1+D2 → G(Review)** — 没代码没得审。
6. **同文件串行**:`MerchantApiController.java`(D0 修越权 / D2 补钱包)· `AdminApiController.java`(D1 补统计 / D2 补设置+下架)—— **同一控制器的两组改动必须由同一次提交完成或严格前后接力**,不得并行。

---

## 4. API 契约变更清单

### 4.0 通用约定(所有新增/修改端点必须遵守)

| 项 | 约定 | 依据 |
|---|------|------|
| **信封** | 一律 `ResponseVO<T>` = `{code:int, msg:string, data:T}`;成功 `code=200, msg="操作成功"` | `ResponseVO.java:14-20` |
| **分页** | 一律 `PageVO<T>` = `{list:[], total:int}`,置于 `ResponseVO.data` 内 | `PageVO.java` |
| **错误码** | **无独立业务码空间**,`code` 即 HTTP 状态码 | `GlobalExceptionHandler.java:28-34` |
| **错误体** | 失败时 `{code, msg:原因, data:原因}`(**双写**,过渡态) | `ResponseVO.java:36-38` |
| **HTTP 状态** | 必须与 body 的 `code` 一致(用 `ResponseEntity.status(...)`,**禁止** `return ResponseVO.fail(404,...)` 这种返回 HTTP 200 + body 404 的陷阱写法) | `MerchantApiController.java:149-151` 已有反例注释 |
| **金额** | 服务端按 DB 价格计算,**不信任前端传入金额**;序列化用 `BigDecimal` → JSON `number` | `StorefrontCheckoutController` |
| **入参** | Bean Validation `@Valid` + DTO,**禁止直接 `@RequestBody Entity`** | `DEVELOPMENT.md` §4.1;反例 F9 |
| **权限** | Service 层做归属校验:越权 **403**、不存在 **404**、状态冲突 **409**、参数错 **400** | `AuthorizationBaselineTest` 既有约定 |
| **新增端点授权** | 挂 `/admin/**`、`/merchant/**` 下**无需改 `AuthzRules`**;新增一级前缀必须登记 | §1 V16 / §5 |
| **前端** | 对应 `web/src/api/modules/*.ts`,**必须保留 mock 分支**;页面不得裸调 axios | `web/CLAUDE.md` §3 |

**HTTP 状态码语义表(全项目统一)**

| 码 | 何时用 | 示例 |
|:--:|--------|------|
| 200 | 成功 | — |
| 400 | 参数缺失/类型错/校验失败/枚举值非法 | `status` 不支持、`amount ≤ 0` |
| 401 | 未登录 / token 失效 | 拦截器统一抛 |
| 403 | 角色不符 / **对象级越权**(不是本人资源) | 商家查他人订单 |
| 404 | 资源不存在 | 订单/地址/评论不存在 |
| 405 | 方法不支持 | — |
| 409 | 业务状态冲突 | 余额不足、重复领取、重复提交 |
| 413 | 上传超限 | 10MB |
| 500 | 未捕获异常 | — |

---

### AC-1 · `GET /products/category-counts` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /products/category-counts` |
| **契约变化** | ✅ **无变化**(仅 `data` 内容由全 0 变真实)。前端 **0 改动** |
| **Auth** | 无(白名单 `/products/**`,`SpringMvcConfig.java:27`) |
| **Request** | 无 |
| **Response 200** | `ResponseVO<Map<String,Integer>>` → `{"code":200,"msg":"操作成功","data":{"All":42,"Electronics":12,"Accessories":30}}` |
| **Error** | n/a |
| **口径(必须遵守)** | ① `All` = `SELECT COUNT(*) FROM product WHERE status='active'`<br>② 各分类用 `LEFT JOIN`(**不是** `ProductMapper.selectTypeCount` 的 INNER JOIN —— F12),零商品分类也要出现(count=0)<br>③ 只统计 `status='active'`(依赖 DB-5 新列;若 DB-5 未落地则先不加该条件并在此注释) |
| **实现提示** | 建议新增 `ProductMapper.selectCategoryCounts()` + `selectCategoryCountsByShopId()`(后者服务 AC-16/店铺页),**保留** 旧的 `selectTypeCount` 以免破坏其他调用面 |

---

### AC-2 · `GET /search/trending` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /search/trending` |
| **契约变化** | ✅ **无变化** → `ResponseVO<List<String>>` |
| **Auth** | 无(白名单 `/search/**`) |
| **Request** | 可选 `@RequestParam(defaultValue="10") Integer limit`(新增可选参数,向后兼容) |
| **Response 200** | `{"code":200,"msg":"操作成功","data":["VR Strap","Charging Dock"]}` |
| **Error** | n/a |
| **口径** | 按 `product_browsing_history` 近 7 天浏览次数降序取商品名前 N;**无浏览数据时**回退到 `product.sales_volume` Top N;仍为空则返回 `[]`(前端会渲染空态)。**绝不再返回硬编码词表** |
| **实现提示** | 前端 `search.ts:23-39` 的 `TRENDING_SEARCHES` 是 **mock 分支专用**,保持不动 |

---

### AC-3 · `POST /search` — facets / relatedSearches 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `POST /search` |
| **契约变化** | ⚠️ **响应结构变化**(`facets` 从 `{}` 变真实聚合),**类型不变** |
| **Auth** | 无(白名单) |
| **Request** | `SearchRequestDTO`:`{q?, category?, page?, limit?, sort?}`(**不变**) |
| **Response 200** | `ResponseVO<{products:[], total:number, facets:{categories:[{name,count}], priceRanges:[{label,min,max,count}], ratings:[{value,count}]}, relatedSearches:string[]}>` |
| **Error** | n/a |
| **口径** | ① `categories`:按当前结果集 `product_type_id` 聚合<br>② `priceRanges`:固定 4 档 `$0–50 / $50–200 / $200–1000 / $1000+`<br>③ `ratings`:由 `product_order_evaluate.rate` 聚合(1–5 星);无数据 → `[]`<br>④ `relatedSearches`:取 `q` 的词 + 同分类高频词,上限 8 条;**空则返回 `[]`** |
| **前端影响** | ✅ **0 改动** —— `search.ts:11-20` 的 `SearchResults` 类型**已经**声明了这三个字段(只是 mock 分支在填)。后端补齐即可对齐 |

---

### AC-4 · `GET /merchants/{merchantId}/profile` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /merchants/{merchantId}/profile` |
| **契约变化** | ✅ **无变化**(字段集不变,值真实化)。前端 **0 改动** |
| **Auth** | 无(白名单 `/merchants/**`) |
| **Response 200** | `ResponseVO<{id, storeName, avatar, description, verified, joinedDate, location, responseTime, stats:{rating, totalReviews, totalProducts, totalSales, satisfactionRate, followers}, policies:{shipping,returns}, featuredProducts:[]}>` |
| **Error** | 现状:shop 不存在 → 返回 `{"storeName":"Unknown Store","verified":false}` + 200。**本轮保留**该行为(不改成 404,避免破坏店铺页);`featuredProducts` 改为 `GET /products/sales-top/{size}` 的同店筛选 Top 4 |
| **口径** | ① `stats.totalProducts`/`totalSales`:`product` 按 `shop_id` 聚合<br>② `stats.rating`/`totalReviews`/`satisfactionRate`:由 `product_order_evaluate` join `product.shop_id` 聚合(**这是目前唯一的评分来源** —— 买家侧评价端点已被删除,见 §8 D2)<br>③ `stats.followers`:`shop.fans_count`(字段已存在)<br>④ `policies`:读 `shop_setting`(DB-4);`shop_setting` 无记录 → 返回平台默认文案(可保留现有硬编码文案作为 fallback)<br>⑤ `location`/`responseTime`:读 `shop_setting` |

---

### AC-5 · `GET /admin/dashboard/stats` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/dashboard/stats` |
| **契约变化** | ✅ **无变化** → `ResponseVO<List<{label,value,change,icon}>>` |
| **Auth** | ADMIN(`AuthzRules.java:90` 的 `/admin/**` 已覆盖,**无需改表**) |
| **Request** | 可选 `@RequestParam(defaultValue="30") Integer days`(环比窗口,向后兼容) |
| **Response 200** | `{"code":200,"msg":"操作成功","data":[{"label":"Total Revenue","value":"$45,231.89","change":"+20.1%","icon":"DollarSign"}, …]}` |
| **Error** | n/a |
| **口径(必须遵守)** | `value` 与 `change` **是字符串**(含 `$`/`,`/`%`),沿用既有约定,前端**零改动**。<br>① Total Revenue = `SUM(payment.amount) WHERE status='已支付' AND paid_time >= 30天前`(按 `payment` 聚合,**不是** `product_order.total_money` —— 后者含未支付)<br>② Active Users = `user` 表总数<br>③ Sales = `COUNT(*) FROM payment WHERE status='已支付' AND paid_time >= 30天前`<br>④ **Active Now 无会话日志,MVP 不可计算** → `value="0"`, `change="n/a"`(**禁止编造数字**)。此项列入 §9 待用户确认<br>⑤ 环比:与前一个等长窗口比较;`change` 格式 `"+12.3%"` / `"-4.5%"` / `"n/a"`(分母为 0 时) |
| **实现提示** | 建议新增 `PaymentMapper` 聚合方法;**不要**用 `Collections.emptyList()` 或硬编码 map |

---

### AC-6 · `GET /admin/dashboard/revenue-chart` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/dashboard/revenue-chart` |
| **契约变化** | ✅ **无变化** → `ResponseVO<List<{date,value}>>` |
| **Auth** | ADMIN |
| **Request** | 可选 `@RequestParam(defaultValue="7") Integer days`(前端传 7) |
| **Response 200** | `{"code":200,"msg":"操作成功","data":[{"date":"2026-09-20","value":4000.00}, …]}` |
| **Error** | n/a |
| **口径** | 按 `DATE(payment.paid_time)` 分组,`SUM(amount)`,`status='已支付'`;**必须补齐缺失日期为 0**(ECharts 需要连续 X 轴);`date` 格式 `yyyy-MM-dd`(前端 `RevenueData.date` 是 `string`,mock 用 `Mon`,真实数据用 ISO 更稳) |
| **索引** | 依赖 **DB-8** `payment.idx_paid_time`(可选,非阻塞) |

---

### AC-7 · `GET /admin/dashboard/recent-users` 修正

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/dashboard/recent-users` |
| **契约变化** | ✅ **无变化** → `ResponseVO<List<{name,email,joinedAt}>>` |
| **Auth** | ADMIN |
| **Response 200** | `{"code":200,"msg":"操作成功","data":[{"name":"Alex","email":"a@x.com","joinedAt":"2026-09-26T10:00:00"}]}` |
| **口径** | ⚠️ **必须按 `create_time DESC` 排序后 `LIMIT 5`** —— 现状 `userService.list()` 全表进内存再 `.limit(5)`,返回的是**插入顺序的前 5 条**,不是"最近"(F5/G3) |

---

### AC-8 · `GET /admin/users` — 分页化 + 修 `role` 过滤 ⚠️ **契约变更**

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/users` |
| **契约变化** | 🔴 **破坏性(对前端)**:响应由 `ResponseVO<List<…>>` 改为 `ResponseVO<PageVO<…>>` |
| **Auth** | ADMIN |
| **Request** | `q?`(昵称/邮箱模糊) · `role?` · `page?`=1 · `limit?`=20 |
| **Response 200** | `{"code":200,"msg":"操作成功","data":{"list":[{"id":"1","name":"Alex","email":"a@x.com","role":"user","status":"active","joinedAt":"…"}],"total":128}}` |
| **Error** | 400 `page<1`/`limit<1`/`limit>100` |
| **口径** | ① 过滤下沉到 SQL(`queryConditions`),**禁止** `service.list()` 后内存 filter<br>② `role` 过滤当前恒返回空(F6):`role` 取值须映射到真实字段——`user`/`admin` 来自 `user` 表,`merchant`/`shop` 来自 `shop` 表;跨表查询建议**分两个 mapper 查询后合并**,或**只保留 `user` 表的 `user`/`admin` 角色**(KISS,推荐后者;`role` 选 merchant 时返回空)<br>③ `status` 保持 `启用→active` / 其他 → `suspended`<br>④ 排序 `create_time DESC` |
| **前端影响** | 🔴 `web/src/api/modules/adminUsers.ts` **必须改**:`get<AdminUser[]>` → `get<PageVO<AdminUser>>`,页面加分页控件 |
| **缓解** | 后端**同时**接受缺省 `page`/`limit` 并默认 `1/20`;后端落地与前端改造必须**同批次发布**,否则前端拿到数组却按 `{list,total}` 读会白屏。**这是本轮唯一的高风险契约变更**,已在 §7 列为 R1 |

---

### AC-9 · `GET /admin/products` — 分页化 + status 真实 ⚠️ **契约变更**

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/products` |
| **契约变化** | 🔴 同 AC-8:`List` → `PageVO` |
| **Auth** | ADMIN |
| **Request** | `q?` · `status?`(`all`/`active`/`banned`) · `page?`=1 · `limit?`=20 |
| **Response 200** | `{"code":200,"msg":"操作成功","data":{"list":[{"id":1,"title":"VR Strap","merchant":"Nexus","price":29.90,"status":"active","image":"…"}],"total":45}}` |
| **Error** | 400 `status` 非枚举值 |
| **口径** | ① 过滤下沉 SQL;**禁止** `page(…,1,100)` 静默截断(F5)<br>② `status` 读 `product.status`(DB-5),**不再恒为 `"active"`**(F8);前端已声明 `'active'\|'draft'\|'archived'\|'banned'`,**本轮只落地 `active`/`banned`** 两值,前端 union 里的 `draft`/`archived` 建议同步删除(见 §9 D4)<br>③ 排序 `create_time DESC` |
| **前端影响** | 🔴 `web/src/api/modules/adminProducts.ts:43-61` 需改(当前还在 mock 里内存 filter `:55-58`) |

---

### AC-10 · `GET /admin/orders` 分页化 ⚠️ **契约变更**

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/orders` |
| **契约变化** | 🔴 同 AC-8:`List` → `PageVO` |
| **Auth** | ADMIN |
| **Request** | `q?` · `status?` · `page?`=1 · `limit?`=20 |
| **Response 200** | `{"code":200,"msg":"操作成功","data":{"list":[{"id":"ORD-12","user":"u1","merchant":"s1","total":59.90,"status":"pending","date":"…","items":2}],"total":37}}` |
| **口径** | ① 过滤下沉 SQL;**禁止** `page(…,1,100)`<br>② 现状按 `order_no` 分组展示(`StorefrontOrderController`),管理端**本轮保持单行**(分组是买家端语义),但 `id` 必须去重暴露 `order_no`,否则多行订单在管理端显示为多条 `ORD-12`(数据正确性问题,列入实现自检)<br>③ 排序 `create_time DESC` |
| **前端影响** | 🔴 `web/src/api/modules/adminOrders.ts` 需改 |

---

### AC-11 · `GET /admin/reviews` 分页化 + `PUT /admin/reviews/{id}` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/reviews` |
| **契约变化** | 🔴 `List` → `PageVO`;`status` 字段从恒 `"visible"` 变真实值 |
| **Auth** | ADMIN |
| **Request** | `q?` · `status?`(`all`/`visible`/`hidden`) · `page?`=1 · `limit?`=20 |
| **Response 200** | `{"code":200,"msg":"操作成功","data":{"list":[{"id":"rev-3","productId":1,"productTitle":"…","userName":"u1","rating":5,"content":"…","createdAt":"…","status":"visible","replyContent":null}],"total":9}}` |
| **口径** | 过滤下沉 SQL(`evaluateService.list()` 全表 → 分页);`status` 读 `product_order_evaluate.status`(DB-7) |

**`PUT /admin/reviews/{id}`**

| 项 | 内容 |
|---|---|
| **Method / URL** | `PUT /admin/reviews/{id}` |
| **契约变化** | ⚠️ **请求体新增**(当前无 body 且不读取) |
| **Auth** | ADMIN |
| **Request** | `{status?: 'visible'\|'hidden', replyContent?: string}` —— 用 **DTO**,`@NotNull` 的 `status` 与可选 `replyContent`;`replyContent` 长度 ≤ 500 |
| **Response 200** | `ResponseVO<Void>` = `{"code":200,"msg":"操作成功","data":null}` |
| **Error** | 400 `status` 非法枚举 / `replyContent` 超长 · 404 评论不存在 |
| **口径** | ① 落 `product_order_evaluate.status`;② 传 `replyContent` 时一并写 `reply_content` + `reply_time=NOW()`<br>③ **历史数据回填**:`status` 默认 `'visible'`,与前端当前硬编码值一致,**无行为变化** |

---

### AC-12 · `GET /admin/settings` / `PUT /admin/settings`

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /admin/settings` · `PUT /admin/settings` |
| **契约变化** | 🔴 PUT **请求体新增** + 🔴 PUT **必须回显全量**(修 F2) |
| **Auth** | ADMIN |
| **Request** | `AdminSettingsDTO`:`{siteName:string(@NotBlank,≤120), maintenanceMode:boolean, allowRegistrations:boolean, commissionRate:decimal(0~100, 2位)}` —— **全部必填**(PUT 是全量覆盖语义,非 PATCH) |
| **Response 200 (GET)** | `ResponseVO<{siteName, maintenanceMode, allowRegistrations, commissionRate}>` |
| **Response 200 (PUT)** | `ResponseVO<{siteName, maintenanceMode, allowRegistrations, commissionRate}>` —— **读库后回显**。⚠️ 当前返回 `data:null`,前端 `adminSettings.ts:28` 声明 `Promise<AdminSettings>` 会拿到 null(**F2**) |
| **Error** | 400 校验失败(含 `commissionRate` 越界) |
| **口径** | KV 表 `system_setting`(DB-3);首次读无记录时用默认值建行。`commissionRate` 语义 = 平台抽佣百分比,范围 0–100 |
| **待决** | `maintenanceMode` / `allowRegistrations` **落库后是否要真正生效**(维护模式拦截 / 关闭注册)?本轮**只落库不接线**,列入 §9 D5 |

---

### AC-13 · `GET /merchant/settings` / `PUT /merchant/settings`

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /merchant/settings` · `PUT /merchant/settings` |
| **契约变化** | 🔴 PUT **请求体新增** + 🔴 PUT **必须回显全量**(修 F2);`description` 的取值来源从 `shop.nickname` 迁到 `shop_setting.description`(修 F11) |
| **Auth** | SHOP |
| **Request** | `MerchantSettingsDTO`:`{storeName(@NotBlank,≤120), description(≤500), logo(≤500), location(≤120), responseTime(≤60), policies:{shipping(≤500), returns(≤500)}, email(@Email), notifications:{email,push,sms}}` —— 全量覆盖语义 |
| **Response 200 (GET)** | `ResponseVO<{storeName, description, logo, location, responseTime, policies:{shipping,returns}, email, notifications:{email,push,sms}}>` |
| **Response 200 (PUT)** | **同上,读库后回显**(修 F2) |
| **Error** | 400 校验失败 · 403 当前 token 的 `shopId` 与目标不一致 |
| **口径** | ① `storeName`/`logo`/`email` 写 `shop` 表(`name`/`avatar_url`/`email`);其余写 `shop_setting`(DB-4)<br>② **归属**:`shopId` **只从 token 取**,**绝不接受请求体传入**(防越权改他人店铺)<br>③ `logo` 只接受 `/file/upload` 返回的相对文件名或外链 URL,**不得**接受任意路径(与 `FilesController` 的 MD5 命名约定一致)<br>④ `shop_setting` 无记录时 GET 返回平台默认文案(fallback 沿用现有硬编码值) |

---

### AC-14 · `GET /merchant/wallet`

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /merchant/wallet` |
| **契约变化** | ✅ **无变化** → `ResponseVO<{balance:number, pending:number, currency:string}>` |
| **Auth** | SHOP |
| **Response 200** | `{"code":200,"msg":"操作成功","data":{"balance":12450.00,"pending":340.00,"currency":"USD"}}` |
| **Error** | n/a |
| **口径** | `balance` = `shop.balance`;`pending` = `shop.pending`(DB-2);`currency` 恒 `"USD"`(与现有 mock 一致,**不做多币种**) |
| **数据来源(MVP)** | ① 新增:`shop.balance` 初始为 0<br>② **回填脚本**:对已支付订单按店铺归集 —— `balance += total_money × (1 - 抽佣率)`、`pending += …`。**这是历史数据迁移,须 database Agent 在迁移脚本中提供,并单独上报总控**(涉及金额写入) |

---

### AC-15 · `GET /merchant/wallet/transactions`

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /merchant/wallet/transactions` |
| **契约变化** | ✅ **无变化**(保持数组,**不**改 `PageVO` —— 见下方决策) |
| **Auth** | SHOP |
| **Request** | 可选 `@RequestParam(defaultValue="50") Integer limit`(上限 100) |
| **Response 200** | `ResponseVO<[{id:"TX-001", type:'sale', amount:899.00, status:'completed', date:'2026-09-26', description:'Order #ORD-…'}]>` |
| **Error** | 400 `limit` 越界 |
| **口径(决策)** | **KISS:保持 `List`,返回最近 N 条**。钱包流水页 MVP 不需要翻页,改 `PageVO` 会连带改前端 store + 页面,收益不抵成本。前端 `merchantWallet.ts:73-76` 零改动。<br>排序 `create_time DESC`;`amount` **有符号**(入账为正、出账为负),与既有 mock(`-5000.0`)一致 |
| **数据来源(MVP)** | 只读 `merchant_wallet_transaction`(DB-1);**sale 类型流水由「支付成功 → 商家入账」时写入**,`withdrawal` 由 AC-16 写入 |

---

### AC-16 · `POST /merchant/wallet/withdraw` ⚠️ **语义重定义**

| 项 | 内容 |
|---|---|
| **Method / URL** | `POST /merchant/wallet/withdraw` |
| **契约变化** | 🔴 **请求体生效**(当前静默丢弃,F3)+ 🔴 **响应体新增字段** |
| **Auth** | SHOP |
| **Request** | `WithdrawDTO`:`{amount: decimal(@NotNull,@DecimalMin("0.01"), ≤ shop.balance), destinationId: string(≤64, 必填), destinationLabel: string(≤120, 可选)}` |
| **Response 200** | `ResponseVO<{transactionId:int, balance:number, pending:number}>` —— 前端 `withdrawFunds` 声明 `Promise<void>`,多返回字段**无害**,前端零改动 |
| **Error** | 400 `amount` 缺失 / ≤0 / 格式错 / 缺 `destinationId` · **409 余额不足**(沿用 `CustomException` 默认)· 409 同一提现重复提交(见幂等) |
| **口径(MVP)** | ① 事务内:`balance -= amount` → 写 `merchant_wallet_transaction`(type=`withdrawal`,status=`pending`,amount 为负)→ `pending += amount`<br>② **不做真实打款**(无支付网关),提现即「申请中」,由管理端线下打款。**必须在响应 `msg` 或文档中说明**,避免用户误以为已到账<br>③ **幂等:MVP 不实现**。⚠️ 必须在**前端**做防重复提交(按钮 loading + 禁用)。列为 §7 R2 |
| **数据来源** | DB-1 + DB-2 |

---

### AC-17 · `PUT /addresses/{id}/default`

| 项 | 内容 |
|---|---|
| **Method / URL** | `PUT /addresses/{id}/default` |
| **契约变化** | ✅ **无变化** → `ResponseVO<Void>` |
| **Auth** | USER(`AuthzRules.java:63` `/addresses/**` 已覆盖) |
| **Request** | 无(路径参数 `{id}`) |
| **Response 200** | `{"code":200,"msg":"操作成功","data":null}` |
| **Error** | 404 地址不存在 · **403 非本人地址**(必须 `AccessGuard.checkOwner`,对齐 `StorefrontAddressController.java:43` 的既有写法) |
| **口径** | 事务内:① `UPDATE shipping_address SET is_default=0 WHERE user_id=?`(当前用户全部置 0)② `UPDATE … SET is_default=1 WHERE id=? AND user_id=?`,受影响行数 0 → 404/403<br>③ **首条地址兜底**:新建地址时若该用户无任何默认地址 → 自动置 `is_default=1`(否则用户永远没有默认地址) |
| **依赖** | DB-6(`is_default` 列 + `idx_user_default`) |
| **消费方** | 结算页 `POST /checkout/summary` 的收货人默认选择(**本轮只保证数据正确,不新增端点**) |

---

### AC-18 · `GET /merchant/dashboard/stats` 真实化

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /merchant/dashboard/stats` |
| **契约变化** | ✅ **无变化** → `ResponseVO<List<{label,value,change,icon}>>`,4 项指标保留 |
| **Auth** | SHOP |
| **Response 200** | `{"code":200,"msg":"操作成功","data":[{"label":"Total Sales","value":"$12,450.00","change":"+12.0%","icon":"DollarSign"}, {"label":"Orders","value":"156","change":"+8.0%","icon":"ShoppingCart"}, {"label":"Products","value":"45","change":"+0.0%","icon":"Package"}, {"label":"Conversion Rate","value":"82.4%","change":"n/a","icon":"TrendingUp"}]}` |
| **口径** | ① **Total Sales / Orders / Products**:仅统计 `shopId = token.id` 的行<br>② **Conversion Rate(⚠️ 口径决策)**:**定义为「已支付订单数 ÷ 订单总数」**(订单转化率)。这是当前数据模型下**唯一可诚实计算**的口径。⚠️ **不得**用 mock 的 `3.2%` 那种"访问转化"语义 —— 系统无访问日志,算不出来<br>③ `change`:与前 30 天比较;分母为 0 → `"n/a"` |
| **前端口径** | 前端 `MerchantStat` 不区分口径,无需改动。若 lead 希望保留"访问转化率"原义,需先建访问日志表 → 见 §9 D3 |

---

### AC-19 · `DELETE /admin/products/{id}/ban` 语义修复

| 项 | 内容 |
|---|---|
| **Method / URL** | `DELETE /admin/products/{id}/ban` |
| **契约变化** | ⚠️ **语义变更**(URL/方法/响应体不变)。前端 `adminProducts.ts:63-66` 在 mock 分支已把它当「状态改为 banned」,**行为对齐后前端零改动** |
| **Auth** | ADMIN |
| **Request** | 无 |
| **Response 200** | `ResponseVO<Void>` |
| **Error** | 404 商品不存在 |
| **口径** | ① `status='banned'`(**不是** `stock=0`)② **不再改 `stock`** —— 避免破坏库存回补链路(`ProductMapper.restoreStock` 会把商品加回来)<br>③ 商品是否对买家可见:`StorefrontProductController.getProducts` / `getProductById` / `sales-top` / `recommend` **一律过滤 `status='active'`** ⚠️ **这是本契约外溢面最大的一条**,漏一处就等于没下架 |
| **解除下架** | 🟡 **本轮不提供** `unban` 端点(前端也没有入口)。若 lead 要求,新增 `PUT /admin/products/{id}/unban`,契约同构 |
| **历史数据** | ⚠️ 迁移会把所有存量行回填 `status='active'`,包括此前被 `setStock(0)`「下架」的商品 —— **无法区分"真下架"与"真售罄"**。这是**非破坏性但语义有损**的迁移,列入 §7 R3 |
| **依赖** | DB-5(`product.status`) |

---

### AC-20 · `GET /merchant/orders/{id}` 越权修复(🔒 安全,必做)

| 项 | 内容 |
|---|---|
| **Method / URL** | `GET /merchant/orders/{id}` |
| **契约变化** | ✅ **无契约变化**,但**行为收紧** |
| **Auth** | SHOP |
| **Response 200** | `ResponseVO<ProductOrder>`(**不变**) |
| **Error** | **403** 订单存在但不属于本店 · **404** 订单不存在 |
| **口径** | 复用现成的 `utils/AccessGuard.java:20` `checkOrderOwner(order, currentUser)`,并在 `order.getShopId()` 与 token 的 shopId 不一致时抛 403。**不要新写工具类**(DRY) |
| **优先级** | 🔴 **最高**,批次 0,不等任何 DB 变更 |
| **测试影响** | ⚠️ `MerchantApiControllerTest` 若存在"用任意 id 查订单"的断言会转红 → **由 qa 在 PG-3 更新为越权 403 断言** |

---

### AC-21 · `POST /checkout/promo` 不信任前端 subtotal

| 项 | 内容 |
|---|---|
| **Method / URL** | `POST /checkout/promo` |
| **契约变化** | ✅ **无变化**(请求/响应结构不变),但 `subtotal` 改为**可选** |
| **Auth** | 无(白名单 `/checkout/summary`、`/checkout/promo`) |
| **Request(现状)** | `{code:string, subtotal:number}` → **新**:`{code:string, subtotal?:number, items?:[{productId, quantity}]}` |
| **Response 200** | `ResponseVO<…>`(**不变**) |
| **Error** | 400 `items` 为空且缺 `subtotal`(无法计算) |
| **口径(口径优先级)** | ① 若传 `items` → **按 DB `product.price` 重算 subtotal**(**必须**,与 `POST /checkout/summary` 同一套算法,DRY:抽公共方法)<br>② 仅传 `subtotal`(无 items)→ **降级为「仅校验优惠券门槛,不校验折扣基数」**,并在响应中标注;**不得**用前端 subtotal 计算折扣金额<br>③ 优惠码仍先查 `coupon` 表,未命中再走 `SAVE10`/`VIP15` 兜底(**保留**现有行为) |
| **归属** | backend,批次 0(安全类,无 DB 依赖) |

---

### 4.x 契约变更汇总

| 类别 | 端点 | 前端是否需改 |
|------|------|:---:|
| **无变化**(仅数据真实化) | AC-1,2,3,4,5,6,7,14,15,17,18,21 | ❌ 不需要 |
| **请求体新增**(PUT/POST 开始生效) | AC-11(评论状态)、AC-12(系统设置)、AC-13(商家设置)、AC-16(提现) | ⚠️ 前端已发送,后端开始读取 —— **前端零改动** |
| **响应体变化** | AC-12/AC-13 的 PUT 回显(修 F2)、AC-16 新增字段 | ❌ 不需要(前端声明更宽松) |
| **🔴 破坏性(必须前端同步)** | AC-8、AC-9、AC-10、AC-11(GET) — `List` → `PageVO` | ✅ **必须** |
| **语义变更(前端零改动)** | AC-19(下架)、AC-20(越权收紧) | ❌ 不需要 |

> **合计 21 条契约**(13 条无变化 / 4 条请求体新增 / 4 条破坏性需前端同步)。

---

## 5. 数据库变更评估

### 5.1 汇总

| ID | 类型 | 对象 | 破坏性 | 阻塞哪个批次 |
|:--:|------|------|:---:|------------|
| DB-1 | 新增表 | `merchant_wallet_transaction` | 🟢 非破坏性 | 批次 2 |
| DB-2 | 修改表 | `shop` **+2 列**(`balance`,`pending`) | 🟢 非破坏性 | 批次 2 |
| DB-3 | 新增表 | `system_setting` | 🟢 非破坏性 | 批次 2 |
| DB-4 | 新增表 | `shop_setting` | 🟢 非破坏性 | 批次 2 |
| DB-5 | 修改表 | `product` **+1 列 +1 索引**(`status`) | 🟡 非破坏性,但**语义有损**(R3) | 批次 2 |
| DB-6 | 修改表 | `shipping_address` **+1 列 +1 索引**(`is_default`) | 🟢 非破坏性 | 批次 2 |
| DB-7 | 修改表 | `product_order_evaluate` **+3 列 +1 索引**(`status`,`reply_content`,`reply_time`) | 🟢 非破坏性 | 批次 2 |
| DB-8 | 修改表 | `payment` **+1 索引**(`idx_paid_time`) | 🟢 非破坏性(可选) | 批次 1(可选,不阻塞) |
| DB-9 | 新增表 | `shop.status` 枚举扩展(不建列,改应用层取值域) | 🟢 非破坏性 | 批次 2 |
| — | ~~删表/删列/改类型~~ | — | — | **🟢 本轮破坏性变更 = 0 条** |

> ✅ **结论:本轮无任何破坏性数据库变更。无需上报总控审批破坏性操作。**
> 但有 **1 条涉及金额写入的数据回填**(DB-2),须 database Agent 出具脚本后**单独报总控**。

### 5.2 逐条明细

<details>
<summary><b>DB-1 · 新增表 <code>merchant_wallet_transaction</code></b> 🟢 非破坏性</summary>

```sql
CREATE TABLE IF NOT EXISTS merchant_wallet_transaction (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  shop_id          INT           NOT NULL COMMENT '店铺id',
  type             VARCHAR(20)   NOT NULL COMMENT 'sale|withdrawal|refund|fee',
  amount           DECIMAL(10,2) NOT NULL COMMENT '有符号:入账为正,出账为负',
  status           VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT 'pending|completed|failed',
  balance_after    DECIMAL(10,2) NULL COMMENT '该笔之后的可用余额(冗余,便于对账)',
  order_no         VARCHAR(64)   NULL COMMENT '关联 product_order.order_no',
  destination_id   VARCHAR(64)   NULL COMMENT '提现目标标识',
  destination_label VARCHAR(255) NULL COMMENT '提现目标可读名(打码后)',
  remark           VARCHAR(500)  NULL COMMENT '备注/描述',
  create_time      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shop_time   (shop_id, create_time),
  KEY idx_shop_status (shop_id, status)
) COMMENT '商家钱包流水';
```

**约束**:① 金额一律 `DECIMAL(10,2)`(禁 float);② 索引 `idx_shop_time` 必建 —— 钱包页是「按店铺 + 时间倒序」这一条主查询;③ H2 侧 **不得**写 `ENGINE`/`COMMENT`/反引号/**`ON UPDATE CURRENT_TIMESTAMP`**(F10)
</details>

<details>
<summary><b>DB-2 · 修改表 <code>shop</code>:新增 2 列</b> 🟢 非破坏性 / ⚠️ 含金额回填</summary>

```sql
ALTER TABLE shop ADD COLUMN balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '钱包可用余额';
ALTER TABLE shop ADD COLUMN shop   ;  -- 占位，实际为:
ALTER TABLE shop ADD COLUMN pending DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '钱包待结算(提现中)';
```

- **理由**:KISS —— 复用 `shop` 表,与既有 `user.balance`(`sql/schema.sql:51`)的约定一致;`shop` 已有 `fans_count` 这个反范式计数器,本表已有同类先例。避免为两个标量再建一张表(YAGNI)。
- **回填脚本(需总控确认)**:
  ```sql
  -- 一次性回填:按已支付订单归集
  UPDATE shop s
  JOIN ( SELECT shop_id, SUM(total_money) amt
         FROM product_order o JOIN payment p ON p.order_no = o.order_no
         WHERE p.status='已支付' AND o.status <> '已取消'
         GROUP BY o.shop_id ) t ON t.shop_id = s.id
  SET s.balance = ROUND(t.amt * 0.95, 2);   -- 0.95 = 预留 5% 平台抽佣(见 §9 D2)
  ```
- ⚠️ **必须先跑查重/核对 SELECT 再 UPDATE**,并在迁移脚本头部写明执行命令(`--default-character-set=utf8mb4`)
</details>

<details>
<summary><b>DB-3 · 新增表 <code>system_setting</code></b> 🟢 非破坏性</summary>

```sql
CREATE TABLE IF NOT EXISTS system_setting (
  setting_key   VARCHAR(64)  NOT NULL PRIMARY KEY COMMENT 'siteName|maintenanceMode|allowRegistrations|commissionRate',
  setting_value VARCHAR(500) NULL,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) COMMENT '平台系统设置(KV)';
```
**种子**(用 `INSERT ... ON DUPLICATE KEY UPDATE` 保证可重复执行):
`siteName='Nexus Market'` · `maintenanceMode='false'` · `allowRegistrations='true'` · `commissionRate='5.00'`
</details>

<details>
<summary><b>DB-4 · 新增表 <code>shop_setting</code></b> 🟢 非破坏性</summary>

```sql
CREATE TABLE IF NOT EXISTS shop_setting (
  shop_id         INT          NOT NULL PRIMARY KEY,
  description     VARCHAR(500) NULL COMMENT '店铺简介(替代复用 shop.nickname,见 F11)',
  location        VARCHAR(120) NULL,
  response_time   VARCHAR(60)  NULL COMMENT '如 "< 1 hour"',
  shipping_policy VARCHAR(500) NULL,
  returns_policy  VARCHAR(500) NULL,
  notify_email    TINYINT(1)   NOT NULL DEFAULT 1,
  notify_push     TINYINT(1)   NOT NULL DEFAULT 0,
  notify_sms      TINYINT(1)   NOT NULL DEFAULT 1,
  update_time     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) COMMENT '商家店铺设置(1:1 扩展表,避免把 9 个设置字段塞进 shop)';
```
**理由**:`shop` 已有 13 列且混用语义(F11);把设置拆到 1:1 扩展表,`shop` 保持"账号实体"的单一职责(SOLID/关注点分离),读设置不锁主表。
</details>

<details>
<summary><b>DB-5 · 修改表 <code>product</code>:新增 <code>status</code> 列</b> 🟡 非破坏性但语义有损</summary>

```sql
ALTER TABLE product ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active|banned';
ALTER TABLE product ADD KEY idx_status (status);
```
⚠️ **语义损失(R3)**:存量行全部回填 `'active'`。此前被 `setStock(0)`「下架」的商品与「真实售罄」商品**无法区分**,都将被恢复为 active。**非破坏性**(无数据丢失),但需在迁移脚本注释与 `docs/MODULES.md` 中写明。
</details>

<details>
<summary><b>DB-6 · 修改表 <code>shipping_address</code></b> 🟢 非破坏性</summary>

```sql
ALTER TABLE shipping_address ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否默认地址';
ALTER TABLE shipping_address ADD KEY idx_user_default (user_id, is_default);
```
**应用层必须配套**:新建地址时若该用户无默认 → 自动置 1(否则老用户永远没有默认地址)。
</details>

<details>
<summary><b>DB-7 · 修改表 <code>product_order_evaluate</code></b> 🟢 非破坏性</summary>

```sql
ALTER TABLE product_order_evaluate ADD COLUMN status VARCHAR(20)   NOT NULL DEFAULT 'visible' COMMENT 'visible|hidden';
ALTER TABLE product_order_evaluate ADD COLUMN reply_content VARCHAR(1000) NULL COMMENT '商家回复';
ALTER TABLE product_order_evaluate ADD COLUMN reply_time  DATETIME    NULL COMMENT '回复时间';
ALTER TABLE product_order_evaluate ADD KEY idx_status (status);
```
✅ `status` 默认 `'visible'` 与前端当前硬编码值一致(`AdminApiController.java:306`),**无行为变化**。
</details>

<details>
<summary><b>DB-8 · 修改表 <code>payment</code>:新增索引</b> 🟢 非破坏性(可选)</summary>

```sql
ALTER TABLE payment ADD KEY idx_paid_time (paid_time);
```
服务 AC-6 收入曲线。数据量小(<10 万行)时**可以不建**,MySQL 会全表扫后临时表聚合。**非阻塞**。
</details>

<details>
<summary><b>DB-9 · <code>shop.status</code> 取值域扩展</b> 🟢 非破坏性</summary>

**不建列**,只扩展应用层枚举,修 F7:
| 前端值 | DB 现值 | 新 DB 值 |
|--------|---------|---------|
| `active` | `启用` | `启用`(**不变**) |
| `pending` | — | `待审核`(新建商家默认态) |
| `suspended` | `禁用` | `禁用`(**不变**) |
| `rejected` | — | `已拒绝` |
⚠️ **副作用**:`POST /admin/merchants` 现在直接 `setStatus("启用")`(`AdminApiController.java:180`),应改为 `待审核` —— 但这会**改变现有演示流程**(管理员建商家后立即可用)。**是否改为待审核列入 §9 D6**,本轮默认**保持 `启用`**(最小变更原则)。
</details>

<details>
<summary><b>🟡 DB-10(不排期)· <code>stock_ledger</code> 库存流水表</b></summary>

REQUIREMENTS 3.6 指出「出入库不可追溯」。**本轮不排期**:无前端消费面、YAGNI。若用户要求,新增 `stock_ledger(id, product_id, delta, biz_type, biz_id, before_stock, after_stock, create_time)` + 索引,同样非破坏性。
</details>

### 5.3 迁移文件硬性要求(database Agent 必须遵守)

1. **文件名**:`sql/migrations/V6__task000_backoffice_realization.sql` + 回滚 `sql/migrations/rollback/V6__task000_backoffice_realization.sql`
2. **三处同步**:MySQL 迁移 · `src/test/resources/schema-h2.sql` · **`sql/schema.sql` 基线**(⚠️ 现有约定只要求前两处,但 `schema.sql` 是"全新库"的唯一入口 —— 只改迁移会导致**重建库时缺表**;请确认 entrypoint 的执行顺序后决定,不确定则**先报总控**)
3. **可重复执行**:用 `CREATE TABLE IF NOT EXISTS`;`ALTER TABLE ADD COLUMN` 在 MySQL 8 **不支持 `IF NOT EXISTS`** → 必须先查 `information_schema` 或写成"查后改"形式
4. **执行前自检查询**必须内置在脚本头部(`SELECT COUNT(*) … HAVING COUNT(*)>1` 风格)
5. **回滚脚本必须放 `rollback/` 子目录**(否则首次建库时会被 glob 当迁移执行)
6. **utf8mb4**:导入须 `--default-character-set=utf8mb4`
7. **H2 兼容**(F10):**禁用** `ENGINE` / `COMMENT` / 反引号 / `ON UPDATE CURRENT_TIMESTAMP` / `USING` 索引提示

---

## 6. 权限体系影响(`config/AuthzRules`)

### 6.1 结论先行

> ### 🟢 **本轮 `AuthzRules` 需新增的条目:仅 3 条。**
> 全部来自**批次 3**(可选范围);**批次 1 与批次 2 的所有端点都已落在既有 `/admin/**`、`/merchant/**`、`/addresses/**`、`/chat/**` 等前缀下,无需任何改动。**

### 6.2 逐端点核对表

| 契约 | 端点 | 命中规则 | 是否需新增 |
|------|------|---------|:---:|
| AC-1 | `GET /products/category-counts` | 白名单 `/products/**` | ❌ |
| AC-2 | `GET /search/trending` | 白名单 `/search/**` | ❌ |
| AC-3 | `POST /search` | 白名单 `/search/**` | ❌ |
| AC-4 | `GET /merchants/{id}/profile` | 白名单 `/merchants/**` | ❌ |
| AC-5/6/7 | `/admin/dashboard/*` | `/admin/**` → ADMIN | ❌ |
| AC-8/9/10/11 | `/admin/*` | `/admin/**` → ADMIN | ❌ |
| AC-12 | `/admin/settings` | `/admin/**` → ADMIN | ❌ |
| AC-13 | `/merchant/settings` | `/merchant/**` → SHOP | ❌ |
| AC-14/15/16 | `/merchant/wallet*` | `/merchant/**` → SHOP | ❌ |
| AC-17 | `PUT /addresses/{id}/default` | `/addresses/**` → USER | ❌ |
| AC-18 | `/merchant/dashboard/stats` | `/merchant/**` → SHOP | ❌ |
| AC-19 | `DELETE /admin/products/{id}/ban` | `/admin/**` → ADMIN | ❌ |
| AC-20 | `GET /merchant/orders/{id}` | `/merchant/**` → SHOP(**角色层已过,需服务层归属校验**) | ❌ |
| AC-21 | `POST /checkout/promo` | 白名单 | ❌ |

### 6.3 需新增的 3 条(仅当批次 3 获批)

| # | 规则 | 角色 | 配套端点 | 插入位置 |
|:--:|------|------|---------|---------|
| **N1** | `new Rule("/reviews/**", Set.of(USER))` | USER | 买家侧评价发布/列表/追评 | 「买家」分组内,`/returns/**` 之后 |
| **N2** | `new Rule("/merchant/returns/**", …)` | — | 🟡 **不需要**:已被 `/merchant/**` 覆盖 | — |
| **N3** | `new Rule("/admin/coupons/**", …)` | — | 🟡 **不需要**:已被 `/admin/**` 覆盖 | — |

> 修正:实际只需 **1 条新规则(N1)**,仅当 lead 批准「恢复买家侧评价端点」。上表 N2/N3 标注为**已覆盖,无需新增**。

**⚠️ 加规则时的注意事项(写死给 backend Agent)**:
1. **规则按声明顺序求值,首个命中者生效**(`AuthzRules.java:47-49`)。新规则**必须**放在比它更宽的通配规则**之前**。`/reviews/**` 无冲突,但**不得**放在 `/admin/**` 之后又不验证。
2. 加完规则**必须**在 `AuthzRulesTest.java` 补两类断言:
   - `frontendSurfaceIsAllowed()` 里加入 `/reviews/**` 的买家路径
   - `rolesCannotCrossDomains()` 里加入 `assertFalse(isAllowed("/reviews/1", SHOP))` / `ADMIN`
3. **不得**为了省事把 `/reviews/**` 写成 `/review*`(会命中 `/reviews-admin` 之类),或用 `String.startsWith`。
4. 新增一级前缀时,**同步更新 `AuthzRules.java:92-99` 的「刻意没有规则」注释块**,否则该文件会变成误导性文档。

### 6.4 白名单(`SpringMvcConfig.excludePathPatterns`)影响

🟢 **无需改动**。⚠️ 但两条纪律要守住:
1. **不要**为了图省事把 `/merchant/**`、`/admin/**`、`/addresses/**` 加进白名单 —— 那会让角色层失效,只剩服务层守卫。
2. `/error` 必须保持在白名单(`SpringMvcConfig.java:35`),否则默认拒绝会把错误渲染变成 403,客户端拿不到真实 4xx/5xx。

---

## 7. 技术风险清单

| # | 风险 | 影响 | 概率 | 缓解措施 | 归属 |
|:--:|------|------|:---:|---------|------|
| **R1** | 🔴 **AC-8/9/10/11 的 `List`→`PageVO` 契约变更**,前后端若不同步发布,前端按 `{list,total}` 读数组会**白屏** | 管理端 4 个页面崩溃 | **高** | ① 契约已冻结在本文档 §4;② 后端**必须**与前端在**同一批次(建议同一提交/同一发布窗口)**;③ 前端改动点集中(`adminUsers/adminProducts/adminOrders/adminReviews.ts` 各 1 处取值);④ 在 PG-2 增设**契约联调检查**:backend 完成后**立即**通知 frontend,不要等 backend 整个批次 2 收尾 | backend + frontend |
| **R2** | 提现接口**无幂等**,用户双击/网络重试会重复扣款 | 资金损失 | 中 | ① 前端按钮 loading + 禁用 + 成功后立即 `refreshWallet()`;② 金额按 `WHERE balance >= amount` 条件 UPDATE,受影响行数 0 → 409(防超支,但不防重复);③ **MVP 不引入幂等键**(YAGNI),但**文档与代码注释必须写明"不保证幂等"**;④ 若 lead 认为不可接受,见 §9 D1 | backend + frontend |
| **R3** | `product.status` 迁移回填导致**此前被 `setStock(0)` 下架的商品全部复活** | 违规/敏感商品短暂上架 | 中 | ① 迁移脚本头部输出「被封禁行」清单 `SELECT id,name,stock FROM product WHERE stock=0` 供人工核对;② 脚本提供**可选的手工清单** `UPDATE product SET status='banned' WHERE id IN (...)`,默认注释掉;③ 在 `docs/TASK-000/03-DATABASE.md` 写明 | database |
| **R4** | 钱包**金额回填脚本**按历史已支付订单归集,若订单表有脏数据(同一 `order_no` 多行、金额为 0)会算出错账 | 商家余额不准 | 中 | ① 回填前输出**对账报表**:逐店铺 `SUM(total_money) × 0.95` 与写回值;② 抽佣率抽成**配置项**(读 `system_setting.commissionRate`,默认 5%),不写死在 SQL;③ **回填脚本须经总控确认后手工执行**,不进 entrypoint 自动流程 | database + 总控 |
| **R5** | 团队**缺前端与测试执行者**(§2.2),批次 3/4 无法启动 | 项目停在"后端真了,前端还是假数据" | **高** | 🔴 **请总控立即增补 `frontend` 与 `qa` 两名 teammate**(含写 scope) | 总控 |
| **R6** | **`mvn clean` 撞 OneDrive 同步锁**(`DEVELOPMENT.md` §7 明确记录) | 测试/构建间歇性失败,误判为代码缺陷 | 中 | ① 任何 `mvn` 前先 `pkill -f "[s]pring-boot:run"`;② 把 `target/` 排除出 OneDrive 同步;③ 失败时**先重试**再判定为缺陷 | qa + devops |
| **R7** | 新表未同步 `schema-h2.sql` → 后端测试报表不存在 | 测试批量红,被误报为"代码有问题" | 中 | ① X3 规则:**只有 database 可改 `schema-h2.sql`**;② DB 批次收尾前 database 必跑一次 `mvn -B clean test` 验证 | database |
| **R8** | **下架过滤外溢**:AC-19 要求买家侧 4 个商品查询全部过滤 `status='active'`,漏一处 = 没下架 | 封禁商品仍可购买 | 中 | ① 在 AC-19 明确列出 4 个端点(`getProducts`/`getProductById`/`sales-top`/`recommend`);② Review Gate 逐个核对;③ 加测试:封禁商品不出现在 `GET /products` | backend + qa |
| **R9** | 内存过滤 + 硬截断(AC-8~11)改成 SQL 分页后,**过滤条件拼错会导致数据泄漏或空列表** | 管理端看错数据 | 中 | ① 过滤条件必须走 XML `queryConditions` 的 `#{}` 绑定(**严禁 `${}` 字符串拼接**,SQL 注入);② Review Gate 把「SQL 注入」列为 Blocker 检查项 | backend + Review Gate |
| **R10** | `/checkout/promo` 改口径后,前端若仍只传 `subtotal` 会**折扣基数不准确**(按降级路径) | 优惠金额偏差 | 低 | ① 前端 `checkout.ts` 补传 `items`;② 后端在降级路径的响应里标注;③ 契约已明确优先级 | backend + frontend |
| **R11** | `docs/backend-api.md`、`docs/MODULES.md` 与代码漂移 | 后续 Agent 依据错误文档做决策 | 中 | ① X1/X6 规则:TASK-000 期间不改这些文件;② 收尾由总控指派专人统一同步(本 Agent 可承接) | 总控 + architect |
| **R12** | `pom.xml` 覆盖的 mockito 5.11.0 未进 `.m2` 时**离线构建失败** | CI/离线环境构建挂 | 低 | 沿用 `DEVELOPMENT.md` §4.4 约定:**保持现状不动**;新环境先联网构建一次 | devops |
| **R13** | 4 个高危 no-op 端点(提现/两处设置/评论状态)在**修复前**被真实用户调用 | 静默数据丢失、用户误以为成功 | **高(当前已存在)** | 🔴 **修复前在 UI 上明确标注**「该功能开发中」,或由 frontend Agent 在 PG-2 先行加禁用态;**不得**继续让 UI 显示"操作成功" | frontend(临时)+ backend(根治) |

---

## 8. 架构红线(开发 Agent 必须遵守)

> 违反任一条即视为架构不一致,Review Gate 应判 **Blocker**。

### 后端
1. **单一控制器前缀**:面向前端页面的端点一律进**门面控制器**(`Storefront*` / `AdminApi` / `MerchantApi`),路径与 `web/src/api/modules/*.ts` 一一对应。
2. **分层单向**:`controller → service → mapper → DB`。**禁止** controller 直连 mapper。
3. **禁止 `@RequestBody Entity`** —— 一律 DTO + `@Valid`(反例 F9)。
4. **禁止 `Map<String,Object>` 承载金额计算** —— 金额用 `BigDecimal`,服务端按 DB 价计算(反例 F2/F12)。
5. **禁止硬编码返回假数据**(空 Map / 空 List / `$0` 冒充真实指标)。**拿不到就返回空集合或 `"n/a"`,不编造数字**。
6. **服务层守卫必须"成对写"**:`page()` 有过滤则 `list()` 也要有;`insert()` 判角色则 `updateById()`/`removeByIds()` 也要判(`DEVELOPMENT.md` §4.1 已点名的系统性遗漏)。
7. **异常**:业务错误抛 `CustomException(HttpStatus, msg)`;**禁止** `return ResponseVO.fail(404, ...)`(会返回 HTTP 200)。
8. **新端点若挂在 `/admin/**`、`/merchant/**`、`/addresses/**` 下 → 无需改 `AuthzRules`;新增一级前缀必须先在本文档 §5 登记。**
9. **Mapper 过滤用 `#{}` 绑定,严禁 `${}` 拼接。**
10. **不新增依赖**(尤其不引入 Redis/ES/新序列化库)—— 需新依赖先报总控(§9)。

### 前端
11. **请求必须走 `web/src/api/modules/*.ts` → `http.ts`**,页面/composable 不得裸调 axios。
12. **新接口必须保留 mock 分支**(否则 mock 模式登录会 401 死循环,已发生过)。
13. **页面取数一律 `useAsyncTask()`**,不手写三件套。
14. **四态齐全**:Loading(`Skeleton`)/ Empty(`EmptyState`)/ Error(`ErrorState`+retry)/ Success。**不得**只写成功态。
15. **错误文案走 `toErrorMessage(e, 兜底)`**,不读 `e.response.data.msg`。
16. **TS 严格**:新代码不写 `any`;类型与 `ResponseVO` 对齐;`vue-tsc` 零新增错误。
17. **不新增运行时依赖**(TanStack Query / Zod / VeeValidate / Sentry 均**不引入**)—— `web/CLAUDE.md` §1 已明确。
18. **移动端 <768px 无横向滚动**。

### 数据库
19. **三处同步**:MySQL 迁移 + `schema-h2.sql`(+ `schema.sql` 基线,见 §5.3-2)。
20. **金额 `DECIMAL(10,2)`**;字符串 `utf8mb4`。
21. **回滚脚本放 `sql/migrations/rollback/`**。
22. **不写破坏性 DDL**(删表/删列/改类型)—— 本轮为 0 条,后续如需,先报总控。
23. **H2 兼容**:禁用 `ENGINE`/`COMMENT`/反引号/`ON UPDATE CURRENT_TIMESTAMP`(F10)。

### 全员
24. **TASK-000 期间不修改** `docs/backend-api.md`、`MODULES.md`、`REQUIREMENTS-GAP.md`、`ROADMAP.md`、`ARCHITECTURE.md`、`DEVELOPMENT.md`(X1/X6)。
25. **不改技术栈**;发现问题按 §9 上报。

---

## 9. 待用户确认的重大决策(⛔ 不可逆 / 超出本轮范围,**一律不自行实施**)

| # | 决策 | 选项 | 架构影响 | 我的建议 |
|:--:|------|------|---------|---------|
| **D1** | **提现幂等**:MVP 是否需要幂等键? | (a) 不做,前端防重提交(本轮) · (b) 加 `idempotency_key` 唯一列 | (b) 需 DB-1 加列 + 索引 + 唯一约束,**非破坏性但增加本轮范围** | 🟢 **(a)**,并把"不保证幂等"写进代码注释与 UI 文案 |
| **D2** | **平台抽佣率**:`shop.balance` 回填按 5% 预留是否正确?抽佣扣款要不要真的从商家余额扣? | (a) 只回填不扣款 · (b) 回填时扣款并写 `type='fee'` 流水 | (b) 更真实,但要求抽佣率可配置且可追溯 | 🟡 **(a) 本轮**,抽佣率读 `system_setting.commissionRate` 参数化;真正扣款留待 Phase 4 |
| **D3** | **商家"Conversion Rate"语义**:当前无访问日志,无法算"访问转化率" | (a) 弱化为「已支付订单数÷订单总数」· (b) 新建 `page_view` 表做真实漏斗 | (b) 是**新增表 + 新采集链路**,显著扩大范围;性能与隐私合规亦需评估 | 🟢 **(a)**(已在 AC-18 写死)。若 lead 要求 (b),应单独立项 |
| **D4** | **`AdminProduct.status` 前端联合类型含 `draft`/`archived`**,本轮只落地 `active`/`banned` | (a) 保留多余枚举值 · (b) 同步删掉 | (a) 留下永不出现的死枚举;(b) 前端要改 | 🟢 **(b)** —— YAGNI,删掉 |
| **D5** | **`maintenanceMode` / `allowRegistrations` 落库后是否接线生效?** | (a) 只落库不接线 · (b) 接维护模式拦截 + 关闭注册 | (b) 需新增全局拦截器 + 改 `AuthzRules` 白名单(`/common/register`) | 🟢 **(a)** —— 本轮只保证数据不丢,行为变更留待专门迭代 |
| **D6** | **新建商家默认状态**:`POST /admin/merchants` 现在直接 `setStatus("启用")` | (a) 保持 `启用`(不变)· (b) 改 `待审核`,必须审核后才能登录 | (b) 会改变现有演示流程,可能让演示账号 shop1 失效 | 🟢 **(a)** 保持现状,最小变更 |
| **D7** | **买家侧评价端点**(2026-09-24 随遗留控制器一并删除,导致买家无法发评论/看评论) | (a) 本轮不恢复(记为已知功能回退)· (b) 恢复 `/reviews/**` | (b) 需新增 1 条 AuthzRules 规则 + 新端点 + 商品详情页评论区从 localStorage 切后端 | 🟡 **(a) 本轮不做**,列为 Phase 5。理由:范围大、涉及前端大改,且 `AdminProduct`/评价页当前是纯前端 localStorage |
| **D8** | **多级类目(`product_type` 三级树)与 SPU/SKU 拆分** | (a) 维持单层扁平(推荐)· (b) 建模重构 | (b) 是**数据模型级重构**,涉及商品/订单/购物车/库存全链路 | 🟢 **(a)** —— 当前无前端消费多级类目/多规格,YAGNI。若用户明确要做,须单独立项并**由总控上报破坏性变更** |
| **D9** | **前端购物车仍用 localStorage**(`REQUIREMENTS-GAP` §3.3),登录态下与后端 `/shoppingCart` 双轨 | (a) 本轮统一到后端 · (b) 维持现状 | (a) 涉及 `stores/cart.ts` 重写 + guest 降级逻辑 | 🟡 归入 **frontend** 批次 3 的评估项,**由 lead 定优先级**,架构侧不阻塞 |

---

## 10. Review Gate(task-7)核对清单

architect 将按以下清单执行一致性检查:

- [ ] AC-1~AC-21 的 URL / Method / Request / Response 与本文档 §4 **逐字一致**
- [ ] 所有新端点返回 `ResponseVO`,分页返回 `PageVO` —— 无裸 `Map` 裸返回
- [ ] 所有 `PUT`/`POST` 的请求体用 **DTO + `@Valid`**,无 `@RequestBody Entity`(F9)
- [ ] `PUT /admin/settings`、`PUT /merchant/settings`、`POST /merchant/wallet/withdraw` **确实读取了请求体**,且 **PUT 回显全量**(F2/F3)
- [ ] 无任何硬编码 `$0` / 空 Map 冒充真实指标(AC-1~AC-7、AC-18)
- [ ] 金额**未信任前端传入值**(AC-14/15/16/21)
- [ ] `GET /merchant/orders/{id}` 有 `AccessGuard` 归属校验(F1)
- [ ] Mapper XML **无 `${}` 拼接**(SQL 注入)
- [ ] 新端点的角色与 §6 核对表一致;`AuthzRules` 只在 §5 允许处改动
- [ ] `AuthzRulesTest` 的 `frontendSurfaceIsAllowed` / `rolesCannotCrossDomains` 断言与新规则同步更新
- [ ] 所有 `CustomException` 的 HTTP 状态与 body `code` 一致(无 HTTP 200 + body 4xx 陷阱)
- [ ] DB 变更三处同步(F10 H2 兼容:无 `ENGINE`/`COMMENT`/`ON UPDATE`)
- [ ] 回滚脚本在 `sql/migrations/rollback/`
- [ ] 前端:新接口保留 mock 分支 · 页面四态齐全 · `vue-tsc` 零新增错误 · <768px 无横向滚动
- [ ] 前端无裸调 axios、无新增运行时依赖

---

## 附录 A · 本轮**不**做的事(YAGNI)

明确排除,避免下游 Agent 自行扩张:

| 项 | 排除理由 |
|---|---|
| Redis / Elasticsearch / 消息队列 / 微服务拆分 | 技术栈由用户决定;当前数据量下单体足够 |
| 真实支付网关(微信/支付宝) | 需商户号与资质,超出本轮 |
| SPU/SKU、多级类目 | 见 §9 D8 |
| 库存预占(soft-hold) | 当前"下单即实扣 + 30min 超时回补"已满足主链路;预占是优化不是缺陷 |
| 运费模板 / 物流轨迹对接 / 自动收货 | 需第三方对接 |
| 秒杀/拼团/积分/会员 | REQUIREMENTS 明确不在本期 |
| RBAC 权限后台可配 | 规则表当前是代码常量;做成可配需要新表 + 新 UI,范围过大 |
| `page_view` 访问日志 / 真实转化漏斗 | 见 §9 D3 |
| Web Push / OAuth 第三方登录 / 发票 / 礼品卡 | ROADMAP Phase 5,未排期 |

---

## 附录 B · 端点状态总览(改造后目标态)

| 区域 | 端点 | 现状 | 目标 | 契约 |
|------|------|:---:|:---:|:---:|
| 商品 | `GET /products/category-counts` | 🔴 全 0 | 🟢 真实 | AC-1 |
| 搜索 | `GET /search/trending` | 🔴 硬编码 | 🟢 真实 | AC-2 |
| 搜索 | `POST /search` facets | 🔴 空 | 🟢 真实 | AC-3 |
| 店铺 | `GET /merchants/{id}/profile` | 🟡 部分硬编码 | 🟢 真实 | AC-4 |
| 管理端 | `GET /admin/dashboard/stats` | 🔴 `$0` | 🟢 真实(Active Now 例外) | AC-5 |
| 管理端 | `GET /admin/dashboard/revenue-chart` | 🔴 空 | 🟢 真实 | AC-6 |
| 管理端 | `GET /admin/dashboard/recent-users` | 🟡 全表扫 | 🟢 真实排序 | AC-7 |
| 管理端 | `GET /admin/users` | 🔴 截断 + role 恒空 | 🟢 分页 | AC-8 🔴 |
| 管理端 | `GET /admin/products` | 🔴 截断 + status 恒 active | 🟢 分页 | AC-9 🔴 |
| 管理端 | `GET /admin/orders` | 🔴 截断 100 | 🟢 分页 | AC-10 🔴 |
| 管理端 | `GET /admin/reviews` | 🔴 全表 | 🟢 分页 | AC-11 🔴 |
| 管理端 | `PUT /admin/reviews/{id}` | 🔴 no-op | 🟢 真实 | AC-11 |
| 管理端 | `GET/PUT /admin/settings` | 🔴 硬编码 + no-op + 返回 null | 🟢 落库 + 回显 | AC-12 |
| 管理端 | `DELETE /admin/products/{id}/ban` | 🟡 语义错误 | 🟢 status | AC-19 |
| 商家端 | `GET /merchant/dashboard/stats` | 🔴 `$0` | 🟢 真实 | AC-18 |
| 商家端 | `GET /merchant/wallet` | 🔴 恒 0 | 🟢 真实 | AC-14 |
| 商家端 | `GET /merchant/wallet/transactions` | 🔴 空 | 🟢 真实 | AC-15 |
| 商家端 | `POST /merchant/wallet/withdraw` | 🔴 no-op 吞 body | 🟢 真实 | AC-16 |
| 商家端 | `GET/PUT /merchant/settings` | 🔴 硬编码 + no-op + 返回 null | 🟢 落库 + 回显 | AC-13 |
| 商家端 | `GET /merchant/orders/{id}` | 🔴 **越权** | 🟢 归属校验 | AC-20 |
| 地址 | `PUT /addresses/{id}/default` | 🔴 no-op | 🟢 真实 | AC-17 |
| 结算 | `POST /checkout/promo` | 🟡 信任前端 subtotal | 🟢 服务端重算 | AC-21 |

> **🟢 21 / 23 端点本轮可完全真实化;其中 4 条需要前端配合改契约(AC-8~AC-11)。**

---

*本文档为 TASK-000-B 交付物。TASK-000-A 产出后由 architect 做 v2 对齐修订。*
*下游 Agent 若发现本文档与代码冲突 → 上报总控,不得自行改契约。*
