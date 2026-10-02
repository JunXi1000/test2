# TASK-001-A2 重启后端 + 运行态行为复验 + 迁移裁决（DevOps Agent）

- **任务**：TASK-001-A2 / `task-4`（**范围已由 Lead 改判：本轮不应用 V6~V11，不写库**）
- **执行者**：env-verifier（DevOps Agent，§九/§26.18）
- **执行时间**：2026-10-01 21:02–21:0x（容器内 CST）
- **git HEAD**：`f4df6ac53dfeaa5777a70e1e00bc8ed311bc1455`（工作树含未提交 Phase 3 改动，与本任务同一份代码）
- **一句话结论**：**运行态已确认为当前工作树代码（行为级证据，非 mtime 推断）**；**V6~V11 为孤儿 schema（Java/MyBatis 引用数全 0），本轮不应用**，并给出未来应用的前置条件清单。

---

## 0. 范围变更记录

| 项 | 原任务书（task-4 rev1） | Lead 改判后（rev2，本次执行） |
|---|---|---|
| 应用 V6~V11 到 `template_v3` | **必做** | **取消**（本轮不写库） |
| 重启后端 + 就绪 | 必做 | 必做 |
| 运行态复验 | 必做 | 必做，且**改为行为级取证**（登录后的已登记路径） |
| 产出 | `08b-MIGRATION-APPLY.md` | `08b-RUNTIME-STATE.md` |
| 迁移缺口 | 待修复的缺陷 | 转为**问题清单条目**（文档漂移 + 运维缺陷），留待下一轮 |

改判依据（Lead 给出 4 条，本 Agent 逐条独立复核结果见 §5）：

1. 迁移对象**零消费者**（双向核实：Java 逐符号 + `src/main/resources` mapper）。
2. 纯增量但**不可重复执行**（V8~V11 的 `ADD COLUMN/ADD KEY` → 1060/1061），且 U-14（`AFTER` 列序）未验证 ⇒ 有**部分应用**风险。
3. 应用会让 `AdminApiController`、`docs/backend-api.md`、`schema-h2.sql` 中"库中尚无该列"的表述变成假话 ⇒ 制造**新漂移**，而本轮禁改代码。
4. 用户本轮范围＝"只做跑通与验收"；§十二 要求 DB 变更先评估必要性 ⇒ 零收益 + 有风险 + 制造漂移 ⇒ 不做。

**本 Agent 的补充复核（供裁决参考，不推翻裁决）**：

- 第 1 条**成立且更强**：不仅 Java 零引用，`src/main/resources` 全量 mapper 只有 `ShopMapper.xml:28` 的 `shop.status`（基础 schema，非 V6~V11 对象）——见 §4。
- 第 2 条的"U-14 未验证"可以**部分消除**：本次用只读 `show columns` 核实了 V8/V10 全部 `AFTER` 锚点列**均存在于现网 23 表基线**（`product_order_evaluate.rate`、`product.sales_volume`、`shipping_address.user_id` 都在）⇒ 这两条 `AFTER` 子句**不会**成为失败原因；**不可重复执行**（1060/1061）与"无版本登记表、无法判断已应用"的风险**依然存在**，裁决不变。
- 第 3 条**成立**，且应记为 **6 处**而非 4 处（清单见 §5.3）。

---

## 1. 重启前基线（T4-1）

```text
=== A2 STEP1: baseline BEFORE restart ===
Thu Oct  1 09:03:00 PM CST 2026
--- DB table count ---
23
--- backend :1000 reachable? ---
http_code=000
curl_exit=7
--- frontend :5173 ---
http_code=200
--- old backend log archived ---
saved /tmp/backend-before-a2.log (2649 lines)
```

| 项 | 值 | 说明 |
|---|---|---|
| DB 表数 | **23** | 与 A 阶段一致，未变（V6~V11 从未应用） |
| 后端 :1000 | `http_code=000` / `curl_exit=7` | A 阶段闸门按要求停掉，未就绪 |
| 前端 :5173 | `200` | Vite 全程未动（PID 9921，19:25:55 起） |
| `target/classes` | 当前工作树字节码 | A 阶段 `mvn clean` 已重建（153 源文件） |
| 旧后端日志 | 归档到 `/tmp/backend-before-a2.log`（2649 行） | 保留 A 阶段"15:28 编译 140 文件"等证据 |

---

## 2. 重启与就绪（T4-2）

起点：`/workspace`，与 `docker/entrypoint.sh:239` 同法（`mvn spring-boot:run`，日志 `/var/log/backend.log`），用 `setsid nohup` 脱离 exec 会话：

```text
=== A2 STEP2: start backend (same way as entrypoint) ===
launched mvn spring-boot:run, shell pid=16645
  16645   16631 Thu Oct  1 21:02:59 2026 /opt/java/openjdk/bin/java ... spring-boot:run
```

就绪轮询（判据＝**收到真实 HTTP 响应**）：

```text
t+10s  http_code=000
t+20s  http_code=000
t+30s  http_code=000
t+40s  http_code=000
t+50s  http_code=000
t+60s  http_code=000
t+70s  http_code=000
t+80s  http_code=401      ← 判据成立
```

启动日志（`/var/log/backend.log`）：

```text
2026-10-01 21:04:45.759 INFO  [no-request-id] o.s.b.w.e.tomcat.TomcatWebServer - Tomcat started on port 1000 (http) with context path ''
2026-10-01 21:04:45.819 INFO  [no-request-id] c.project.platform.ProjectManagement - Started ProjectManagement in 56.977 seconds (process running for 60.805)
```

| 项 | 值 |
|---|---|
| Maven 启动 | 21:02:59（PID 16645，PPID=1，已 detach） |
| 应用 JVM | 21:03:44（PID 16711，PPID 16645） |
| Tomcat :1000 | 21:04:45（应用自身启动 56.977s；含编译总计约 106s） |
| 就绪判决 | **401 + JSON body** —— 按 STARTUP.md §3 / `dev.sh:147-167`，401 即就绪 |
| 当前状态 | `backend / HTTP=401`、`frontend / HTTP=200` |

> 与 A 阶段对照：A 装的那次 JVM（15:30:54）用旧字节码；本次 JVM **21:03:44 装载的正是 20:58 `mvn clean` 重建的当前工作树字节码**。

---

## 3. 行为级"现行性"取证（T4-3）—— 关键交付

匿名 401 无法区分端点存在与否（A 阶段结论），故一律用**登录后的已登记路径**，并与 DB 逐项交叉核对。登录返回体里 JWT 放在 `data`（字符串），不是 `token` 对象——这一点记录在此，供 QA 复用：

```text
--- 3.1 POST /common/login (ADMIN admin/123456) ---
{"code":200,"msg":"操作成功","data":"eyJhbGciOiJIUzI1NiJ9...."}   ← data 即 JWT
admin token_len=449 ; shop token_len=340
```

### 3.1 逐条证据

| # | 端点 | 旧代码（注释所述"改动前"） | **本次实测（21:05，重启后）** | DB 交叉核对（只读） | 判定 |
|---|---|---|---|---|---|
| 1 | `GET /admin/dashboard/stats`（admin token） | 4 指标全硬编码 `"$0"/"0"/"+0%"` | `[{"Total Revenue":"$0.00","+0%"},{"Active Users":"3","+100%"},{"Sales":"0","+0%"},{"Active Now":"0","+0"}]` HTTP 200 | `user` 表 **3** 行；`product_order` **0** 行 / `sum(total_money)=0.00` | ✅ **真实聚合**（`"3"`、`"+100%"` 不可能是硬编码常量） |
| 2 | `GET /admin/dashboard/revenue-chart?days=7` | 恒返回**空列表** | 7 个连续自然日 `2026-09-25 … 2026-10-01`，各 `value:0`，HTTP 200 | 0 订单 ⇒ 按日补零 | ✅ **真实聚合**（日期随当前日期滚动生成） |
| 3 | `GET /admin/dashboard/recent-users` | — | 3 个真实用户 + `joinedAt":"2026-09-27T18:21:35"`，HTTP 200 | `user` 3 行，`create_time` 均为 `2026-09-27 18:21:35` | ✅ 读库 |
| 4 | `GET /search/trending`（白名单，匿名） | 硬编码固定数组（注释：`"Phone"/"Laptop"/…`） | `["无线蓝牙耳机","简约纯棉T恤","智能运动手表","数码产品","服装"]` HTTP 200 | `product` 按 `sales_volume DESC` = 无线蓝牙耳机(10)、简约纯棉T恤(5)、智能运动手表(3)；分类 = 数码产品、服装 ⇒ **顺序与内容逐一吻合**（销量排序 + 分类名补齐，`TRENDING_LIMIT=5`） | ✅ **真实聚合** |
| 5 | `GET /products/category-counts`（白名单，匿名） | 全部 `0` | `{"All":3,"数码产品":2,"服装":1}` HTTP 200 | `product` 共 3；`product_type_id=1` 2 条、`=2` 1 条；类型名 数码产品/服装 | ✅ **真实聚合**（数字与 DB 完全一致） |
| 6 | `POST /search`（`facets`，白名单，匿名） | `facets` 恒为**空 Map** | `facets:{categories:[{数码产品:2},{服装:1}], priceRanges:[{$50-$200:3}], ratings:[]}` HTTP 200 | 同上；价格区间 $50~$200 覆盖 99/149/199 三件 | ✅ **真实聚合** |
| 7 | `GET /merchant/dashboard/stats`（shop1 token） | 硬编码 | `[{"Total Sales":"$0.00"},{"Orders":"0"},{"Products":"2"},{"Conversion Rate":"0.0%"}]` HTTP 200 | `product` 按 `shop_id`：**shop 1 → 2 件**、shop 2 → 1 件 | ✅ **真实聚合（按店隔离）**（`"2"` 只能是按 shop_id 聚合的结果） |

### 3.2 对照组（证明"未登记/越权"仍被正确拒绝）

| 请求 | 结果 | 含义 |
|---|---|---|
| `GET /admin/dashboard/stats`（**无** token） | `401` | 匿名默认拒绝 |
| `GET /admin/dashboard/stats`（**SHOP** token） | **`403`** | 端点已登记 + 角色隔离生效（403 而非 401） |
| `GET /search/facets?keyword=`（我的路径假设） | `404` | ⚠️ **本 Agent 的探测勘误**：`facets` 不是独立端点，而是 `POST /search` 响应体里的字段（`StorefrontSearchController.java:117`）。已用 §3.1 #6 更正取证 |

### 3.3 结论（确定）

> **重启后的运行态 = 当前工作树的 Phase 3 代码。** 判据不是 mtime 推断，而是**行为级**：7 个差异端点全部返回**与真实 DB 逐项吻合**的动态聚合值（用户数 3、shop1 商品数 2、分类计数 2/1、trending 按 `sales_volume` 的真实顺序），而旧实现这些位置是硬编码常量/空集。硬编码值不可能产出 `"3"`/`"+100%"`/`"2"`/按销量排序的商品名，因此"运行态仍是旧代码"被排除。

> 与 A 阶段的过期判定闭环：A 用 mtime 链证明"旧 JVM 是过期代码"，A2 用行为证明"新 JVM 是当前代码"。

---

## 4. 孤儿 schema 对照表（T4-4）—— 本任务最有价值的产出

### 4.1 对象清单 ↔ 引用位置与引用数

引用统计口径：`Java` = `src/main/java/**` 全文命中（含注释，逐条注明）；`SQL` = `src/main/resources/**`（MyBatis mapper）；`H2` = `src/test/resources/schema-h2.sql`（测试库是否已有）。

| 迁移 | 新增对象 | 类型 | Java 引用 | SQL(mapper) 引用 | H2 测试库 | **实现引用数** | 若应用，端点会变真实吗 |
|---|---|---|---|---|---|---|---|
| V6 | `merchant_wallet` | 表 | **0** | 0 | ✅ `schema-h2.sql:356` + 种子 `:519` | **0** | ❌ 否 —— `/merchant/wallet` 是 `MerchantApiController:261-265` 的硬编码字面量 |
| V6 | `merchant_wallet_transaction` | 表 | **0** | 0 | ✅ `:369` + 索引 `:393-396` | **0** | ❌ 否 —— `/merchant/wallet/transactions` 恒 `[]` |
| V6 | `INSERT IGNORE` 钱包种子 | DML | **0** | — | ✅ `:519` | **0** | ❌ 否（无消费者） |
| V7 | `admin_setting` | 表 | **0** | 0 | ✅ `:402` + 种子 `:523` | **0** | ❌ 否 —— 无对应 Java 消费者 |
| V7 | `merchant_setting` | 表 | **0**（唯一命中是**注释** `StorefrontMerchantController.java:51`） | 0 | ✅ `:418` + 种子 `:526` | **0** | ❌ 否 —— `PUT /merchant/settings` 从不读 body（`MerchantApiController:303`） |
| V8 | `product_order_evaluate.review_status` | 列 | **0**（仅注释 `AdminApiController.java:364`、`:393`） | 0 | ✅ `:122` | **0** | ❌ 否 —— `AdminApiController:387` 把 `status` 硬写成 `"visible"` |
| V8 | `reviewer_id` / `review_time` / `review_remark` | 列 | **0** | 0 | ✅ `:123-125` | **0** | ❌ 否 |
| V8 | `idx_review_status_time` | 索引 | 0 | 0 | ✅ `:501`（H2 名 `idx_poe_review_status_time`） | 0 | ❌ 否（索引不改变行为） |
| V9 | `product_order.idx_create_time` | 索引 | 0 | 0 | ✅ `:438`（H2 名 `idx_ord_create_time`） | 0 | ❌ 否（仅查询性能） |
| V9 | `product_browsing_history.idx_create_time` | 索引 | 0 | 0 | ✅ `:445` 区 | 0 | ❌ 否 |
| V10 | `product.status` | 列 | **0**（`Product.java` 中无 `status` 字段） | 0 | ✅ 注释 `:445-448` | **0** | ❌ 否 —— 实测 `show columns from product` **无该列**，而全部探针 200 |
| V10 | `shipping_address.is_default` | 列 | **0**（`ShippingAddress.java` 中无 `isDefault` 字段） | 0 | ✅ `:139` | **0** | ❌ 否 —— `GET /addresses` 返回体无默认标记 |
| V10 | `idx_shop_status` / `idx_status_id` / `idx_user_default` | 索引 | 0 | 0 | ✅ `:451-458` | 0 | ❌ 否 |
| V11 | `idx_ord_shop_status_time` / `idx_ord_user_time` | 索引 | 0 | 0 | ✅ `:470-471` | 0 | ❌ 否 |

**汇总：V6~V11 新增对象合计 18 个（**4 张表 + 6 个列 + 8 条索引**；上表按 14 行归类列出，另有 V6/V7 的种子 DML），其**实现引用数一律为 `0`（孤儿 schema）**；全仓仅有 2 处注释提及（`StorefrontMerchantController.java:51`、`AdminApiController.java:364/393`）。**

独立复核原始证据：

```text
# Java 侧（src/main/java）
grep -r "merchant_wallet|merchantWallet|wallet_transaction|WalletTransaction"  → 0 命中
grep -r "admin_setting|adminSetting|merchant_setting|merchantSetting"          → 1 命中，且是注释：StorefrontMerchantController.java:51
grep -r "review_status|reviewer_id|review_time|review_remark"                  → 2 命中，均是注释：AdminApiController.java:364 / :393
grep -r "isDefault|is_default|defaultAddress"                                  → 0 命中
# mapper 侧（src/main/resources）
grep -r "review_status|is_default|merchant_wallet|admin_setting|merchant_setting|product.status|p.status|wallet"
  → 唯一命中 ShopMapper.xml:28  `AND shop.status = #{query.status}`  ← 基础 schema 的 shop.status，与 V6~V11 无关
```

### 4.2 直接反证：这些端点在**迁移之前**就已经是"假数据/no-op"

| 端点 | 实测（重启后，当前代码） | 结论 |
|---|---|---|
| `GET /merchant/wallet`（shop1 token） | `{"balance":0,"pending":0,"currency":"USD"}` HTTP 200 | 硬编码字面量（`MerchantApiController:262-264`）；**即使应用 V6，因为 Java 不查 `merchant_wallet`，输出不变** |
| `GET /merchant/wallet/transactions` | `[]` HTTP 200 | 恒空 |
| `GET /merchant/settings` | `storeName/description/logo/email` **来自 shop 表**（真实）+ `location:"Unknown"`、`responseTime:"< 1 hour"`、`notifications{...}`、`policies{...}` 硬编码 | 半真半假；`merchant_setting` 无消费者 |
| `GET /addresses`（user1 token） | 1 条真实地址（`体验用户一`）**无 isDefault 字段** | 默认地址能力仍未实现（`docs/backend-api.md:327` 亦如此记载） |

### 4.3 答案：**若未来应用 V6~V11，哪些端点会真正变为真实实现？→ 一个都没有。**

| 端点 | 应用迁移后是否会变真实 | 阻塞点（真正需要的东西） |
|---|---|---|
| `/merchant/wallet*`（余额/流水/提现） | ❌ 仍假 | 缺 `MerchantWalletMapper` / Service / 结算入账逻辑（D2） |
| `/merchant/settings` PUT、`/admin/settings` | ❌ 仍 no-op | 缺 settings 的读写实现（表建了也无人用） |
| `PUT /admin/reviews/{id}`、`GET /admin/reviews?status=hidden` | ❌ 仍 no-op / 恒 fake `"visible"` | 缺审核状态写入与查询映射（`AdminApiController:387` 硬编码） |
| `PUT /addresses/{id}/default` | ❌ 仍 no-op | 缺 `ShippingAddress.isDefault` 字段与"每用户至多一个默认"的事务实现 |
| 全部 8 条新索引 | ⚪ 仅查询性能 | 无行为变化 |

> 附带的**反向 schema 漂移**（值得单独记账）：`src/test/resources/schema-h2.sql` **已经包含** V6/V7 的表、V8 的四列、V10 的两列以及 V9/V10/V11 索引的 H2 命名变体（`:356/369/402/418/122-125/139/438/451-471`）⇒ **测试库（H2）比真实 dev 库（MySQL 23 表）更完整**。含义有两层：① 171 个单测能在真实库缺列的情况下跑绿，是因为它们跑在 H2 上；② **"mvn test 通过"不能证明真实库具备同等 schema**，端到端验收必须在 MySQL 上做（正是 task-5 的意义）。
>
> 另：`schema-h2.sql:445-448` 的注释声称"后端 `Product.status` / `ShippingAddress.isDefault` 两个**实体字段**"存在，但本次核实 `entity/Product.java`、`entity/ShippingAddress.java` **均无这两个字段**（`grep isDefault src/main/java` = 0 命中）⇒ 该注释不实。**Minor，供 Lead 记账，本轮不改。**

---

## 5. 迁移裁决（T4-5）

### 5.1 裁决

> **本轮不应用 V6~V11。** 采纳 Lead 的 4 条依据（§0），并补充 2 条本 Agent 独立证据：
> - 补 1：migrate 与本次 12 个测试失败**无关**（失败在 H2/MockMvc 层的优惠码登录守卫与 409→400，见 `08-ENVIRONMENT.md` §4.4），应用迁移不会让 `mvn test` 变绿。
> - 补 2：应用后**没有任何端点可验收为"真实"**（§4.3），零收益结论得到端点级反证。

### 5.2 本 Agent 对风险项的修正（不改裁决）

| Lead 风险项 | A2 复核 | 影响 |
|---|---|---|
| U-14：V8/V10 的 `AFTER` 列序是否满足目标库 | **已可静态确认**：锚点列全部存在 —— `product_order_evaluate.rate`（V8 `AFTER rate`）、`product.sales_volume`（V10 `AFTER sales_volume`）、`shipping_address.user_id`（V10 `AFTER user_id`） | 该未知项**消除**；但**未执行**，不作为"可以直接放手执行"的理由 |
| 不可重复执行 | **确认**：V8/V10 `ADD COLUMN` → 1060；V9/V11 `ADD KEY` → 1061；库内**无版本登记表**（`show tables like '%migration%'` 为空），重复执行会失败且无从判断已应用状态 | 风险维持 |
| 制造漂移 | **确认并细化为 6 处**（§5.3） | 风险维持 |

### 5.3 应用迁移时会变成假话的 6 处表述（未来同批修正）

| # | 位置 | 现表述 |
|---|---|---|
| 1 | `AdminApiController.java:387` | `m.put("status", "visible")`（硬编码，假定库中恒为 visible） |
| 2 | `AdminApiController.java:393-396` | `/** 缺省 / all / visible 命中;hidden 因库中尚无 review_status 列而返回空集 */` |
| 3 | `docs/backend-api.md:147` | `status` 依赖 `review_status` 列,暂只有 `visible` 一档 |
| 4 | `docs/backend-api.md:148` | `updateReviewStatus 仍 no-op(需 review_status 列,属 TASK-000-D2)` |
| 5 | `docs/backend-api.md:327` | `/addresses/:id/default` **仍 no-op**:`shipping_address` 表无默认标记列 |
| 6 | `docs/backend-api.md:334` | `product.status` / `review_status` 列未落地 → 只有单一取值 |
| （附） | `schema-h2.sql:445-448` | 备注称存在 `Product.status` / `ShippingAddress.isDefault` 实体字段（**当前不实**，见 §4.3） |

### 5.4 未来要应用时的前置条件清单（建议写入下一轮计划）

1. **先决策"是否真要这套 schema"**：与 D2 的 Java 实现（钱包/设置/评论审核/默认地址）**同批交付**，否则继续维持孤儿 schema。
2. **U-14 已静态排雷**（§5.2），但仍在**一次性**执行前用 `SHOW COLUMNS` 复核锚点列（防目标库不是本机这份 23 表基线）。
3. **一次性执行 + 记账**：库内无版本登记表 ⇒ 建议①建 `schema_migration` 登记表，或②至少写入 `/var/lib/mysql/.imported/V*.sql` 标记；**并同时修 `docker/entrypoint.sh:105` 的批次标记短路**（否则新卷之外的库永远漏迁移，`restart` 不自愈 —— 见 `08-ENVIRONMENT.md` §6）。
4. **执行前备份**：`mysqldump template_v3` 或卷快照（V8/V10 虽为纯增量，但不可重复执行）。
5. **一律 `--default-character-set=utf8mb4`**（本库有中文）；逐条执行并留原始输出。
6. **执行后复核**（精确口径：**表 +4 = 23 → 27**；**列 +6**；**索引 +8**）：
   - 表 27：V6 `merchant_wallet`、`merchant_wallet_transaction`；V7 `admin_setting`、`merchant_setting`；
   - 列 6：V8 `review_status`/`reviewer_id`/`review_time`/`review_remark`；V10 `product.status`、`shipping_address.is_default`；
   - 索引 8：V8 `idx_review_status_time`(1)、V9 `idx_create_time`×2、V10 `idx_shop_status`/`idx_status_id`/`idx_user_default`(3)、V11 `idx_ord_shop_status_time`/`idx_ord_user_time`(2)。
7. **同步更正 §5.3 的 6 处表述**（本轮禁改代码/文档，故未做）。
8. **复跑 `mvn -B clean test`** 与端到端验收，确认无行为回归（预期结果不变）。
9. 回滚可用性：`sql/migrations/rollback/V6~V11` **齐全**（V6/V7 `DROP TABLE IF EXISTS`；V8/V10 `DROP COLUMN`+`DROP INDEX`；V9/V11 `DROP INDEX`）—— 但 `DROP COLUMN` **有数据丢失语义**，回滚前必须备份。

---

## 6. 关于 `mvn test`（T4-6）

**按 Lead 指示未复跑**，直接引用 A 阶段结论：

```text
（A 阶段，20:54:27–20:58:13，重启前的同一份工作树代码）
Tests run: 171, Failures: 11, Errors: 1, Skipped: 0   → rc=1
失败集中在 StorefrontPromoTest(10F+1E) 与 RequestShapeTest(1F)
```

- **未复跑原因**：A2 的代码与 schema 相对 A 阶段**无任何变化**（只有 JVM 重启；DB 未写），复跑只会重复同一结果；且 A2 的取证重点是**运行态行为**而非测试闸门（Lead 明确"可省"）。
- **可推断性**：这 12 个失败在 H2/MockMvc 层由 `CouponServiceImpl:114-116`（匿名拒绝）与 `StorefrontCheckoutController:84`（400 取代 409）触发，**与 V6~V11 迁移、与重启均无关**；因此应用迁移后仍会失败（见 §5.1 补 1）。
- **注意**：`schema-h2.sql` 已含 V6~V10 的对象（§4.3），所以测试库并不会因为真实库缺迁移而失败 —— 这也解释了为什么 12 个失败与 schema 无关。

---

## 7. 环境状态（移交前快照）

| 组件 | 状态 |
|---|---|
| 容器 `nexus-dev` | Up（未重启） |
| 后端 :1000 | **运行中（新代码，21:03:44 起）**；`GET /` → `401` 即就绪 |
| 后端进程 | `16645`（mvn spring-boot:run，PPID 1）+ `16711`（应用 JVM，PPID 16645） |
| 前端 :5173 | 运行中 → `200`（Vite PID 9921，19:25:55 起；服务当前工作树源码） |
| MySQL / 库 | **未写任何 DDL/DML**；表数仍 **23**（V6~V11 未应用） |
| 唯一写库动作 | 无（仅登录 + 只读 GET/SELECT；JWT 无状态，登录不落库） |
| `target/` | 当前工作树字节码（20:58 重建，21:03:44 装载） |
| 容器独占锁 | **本次执行完毕，锁交回 Lead**（本 Agent 不再执行容器操作） |

---

## 8. 阻塞项 / 记账清单（上报 Lead）

| # | 等级 | 事项 | 归属建议 |
|---|---|---|---|
| A2-1 | Major | **孤儿 schema**：V6~V11 全部对象引用数 0；下一轮须与 D2 实现同批决策（§4.3、§5.4） | 下一轮计划 |
| A2-2 | Major | **entrypoint 批次标记短路**：已有卷永久漏迁移、`restart` 不自愈（`docker/entrypoint.sh:105`）；配合 §5.4-3 一起修 | docker/ + docs |
| A2-3 | Major | **`docs/STARTUP.md` 漂移**：§3(78 行)/§8.1(198 行) 写"迁移只到 V1…V5"，与 entrypoint 的 glob 不符 | docs |
| A2-4 | Major | **H2 测试库比真实库更完整**（§4.3）：`mvn test` 绿 ≠ 真实库就绪；端到端必须在 MySQL 上验（task-5 依据） | QA / 文档 |
| A2-5 | Minor | `schema-h2.sql:445-448` 注释称存在 `Product.status`/`ShippingAddress.isDefault` 实体字段，实际不存在 | 下一轮 |
| A2-6 | Minor | 应用迁移会令 §5.3 的 6 处表述变假 —— 需与实现同批修正 | 下一轮 |
| A2-7 | 记录 | 本次 12 个测试失败与迁移/重启**无关**（引 A 结论，未复跑）；详见 `08-ENVIRONMENT.md` §4.4 | code-reviewer / QA |
| A2-8 | 记录 | 登录响应把 JWT 放在 `data`（字符串），不是 `token` 字段 —— QA 写脚本时别再踩 | QA |
| A2-9 | 记录 | `facets` 不是独立端点，而是 `POST /search` 响应字段（本 Agent 曾误探 `/search/facets` → 404，已更正） | QA |

---

## 9. 附：原始命令（可复现）

```bash
# 1) 重启前基线
mysql -uroot -p123456 -N -e 'select count(*) from information_schema.tables where table_schema="template_v3";'   # 23
curl -s -o /dev/null -w '%{http_code}\n' --max-time 5 http://127.0.0.1:1000/                                      # 000

# 2) 重启（与 entrypoint 同法）
cd /workspace && setsid nohup mvn spring-boot:run > /var/log/backend.log 2>&1 < /dev/null &

# 3) 行为级取证（登录 → 已登记端点 → 与 DB 交叉核对）
curl -s -X POST http://127.0.0.1:1000/common/login -H 'Content-Type: application/json' \
     -d '{"type":"ADMIN","username":"admin","password":"123456"}'          # data 即 JWT
TOKEN=$(... sed -n 's/.*"data":"\([^"]*\)".*/\1/p')
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:1000/admin/dashboard/stats
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:1000/admin/dashboard/revenue-chart?days=7"
curl -s http://127.0.0.1:1000/search/trending                 # 白名单，匿名可达
curl -s http://127.0.0.1:1000/products/category-counts        # 白名单，匿名可达
curl -s -X POST http://127.0.0.1:1000/search -H 'Content-Type: application/json' -d '{"q":"","page":1,"limit":10}'
mysql -uroot -p123456 template_v3 -N -e 'select id,name,shop_id,sales_volume from product order by sales_volume desc;'
mysql -uroot -p123456 template_v3 -N -e 'show columns from product;'                 # 确认无 status 列
mysql -uroot -p123456 template_v3 -N -e 'show columns from shipping_address;'        # 确认无 is_default 列
mysql -uroot -p123456 template_v3 -N -e 'show columns from product_order_evaluate;'  # 确认无 review_status 列

# 4) 迁移与现状
ls -la sql/migrations sql/migrations/rollback
"show tables;" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N     # 仍 23 表
```

> 执行方法与 A 阶段一致：宿主临时文件 + **LF 行尾** + `Get-Content -Raw | docker exec -i nexus-dev bash`，长输出重定向到容器内 `/tmp/*.log` 留原始日志（如 `/tmp/backend-before-a2.log`）。
