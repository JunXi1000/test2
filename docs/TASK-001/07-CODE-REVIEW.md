# TASK-001-C 未提交改动代码审查（Code Review Gate）

- **审查对象**：`E:\OneDrive\Desktop\test2`，HEAD = `f4df6ac`，工作树 56 个已跟踪改动（+1895/−714）+ 4 个暂存改动（−293/+7067）+ 45 个未跟踪条目
- **审查方式**：**只读静态审查**。逐行读 `git diff`、`git diff --cached`、全部未跟踪文件正文；未运行 `mvn` / `npm` / 容器（容器独占锁在 env-verifier）
- **审查人**：code-reviewer（§26.15：只发现问题 + 报告 + 给修复建议，不修代码）
- **产物**：本文件（本次唯一写入）

## 0. Verdict

**verdict = `conditional`**（有条件通过：主体方向正确、绝大多数文件可直接保留，但存在 **4 个 Blocker**，修完才是可验收基线）

> **「这批未提交改动能否原地保留作为可验收基线？」→ ❌ 不能原地保留。**
> 不是「全批应回退」—— 没有任何一个文件需要整体回退到 HEAD；但**当前工作树不具备「可验收基线」资格**，因为：
> ① 12 个已跟踪的既有测试会变红（`mvn test` 必失败，不是猜测，见 B-1/B-2）；
> ② 结算链路「显示金额 ≠ 实际扣款」这条本轮声称已修的问题**端到端仍未修通**，且新增了一条队内不一致（购物车 vs 结算页，见 B-3/B-4）。
>
> 逐文件处置见 §4，全部为「可保留 / 需修后保留」，**无「应回退」**。

### Blocker 计数（供 TASK-001-A2 决策）

| 级别 | 数量 |
|---|---|
| **Blocker** | **4** |
| Major | 11 |
| Minor | 12 |

**给 TASK-001-A2 的直接结论**：迁移是否应用**与本次 Blocker 无关**。`sql/migrations/V6~V11` 在本工作树的 Java 代码里**零消费者**（§2.3 已逐符号核实），应用它们不会修掉任何一个 Blocker，也不会引入新的功能阻断；因此**不要为了「修 Blocker」去应用迁移**，A2 可以按自己的节奏（是否要 H2/MySQL schema 对齐、是否要那 5 条索引）独立决策。

---

## 1. 审查范围与方法

| 类别 | 内容 |
|---|---|
| 已跟踪未暂存 | 56 文件，`git diff` 全量逐块阅读 |
| 已暂存 | `docs/API接口说明.md`(删)、`src/package-lock.json`(删)、`web/README.md`(删)、`web/package-lock.json`(增 7067 行) —— 用 `git diff --cached` 单独看 |
| 未跟踪（新文件） | `sql/migrations/V6~V11` + `rollback/`、`AnalyticsService`/`AnalyticsServiceImpl`/`AnalyticsMapper`(+xml)、10 个新 VO、2 个新测试、`mockito-extensions/`、`docs/STARTUP.md`、`docs/TASK-000/*`、`.github/workflows/`、`docker/scripts/`、根目录 8 个脚本、`Agent-System-Prompt.txt`、`uploads/demo-avatar.png`、`web/public/img/p{1,2,3}.jpg` |
| 未做 | 任何编译、任何测试执行、任何容器操作、任何 dev server 启动 |

**取证原则**：每条 must_fix 都给了「文件:行号 + 证据（代码原文/测试原文）」。凡属**运行期才能确证**的，一律进 §7 未验证项，不假装已验。

---

## 2. 三个必须独立核验的事实（已核）

### 2.1 新端点是否在 `AuthzRules` 登记 → **是，无需改动；且新闸门测试逻辑成立**

- `config/AuthzRules.java` **本次未被修改**（不在 56 个改动里）。逐条枚举 `src/main/java/.../controller/*.java` 的全部 `@RequestMapping` 后核实：本批次**没有新增任何 handler 路径**（`/admin/dashboard/revenue-chart`、`PUT /admin/reviews/{id}`、`/merchant/orders/{id}/status`、`/checkout/summary`、`/checkout/promo` 全部是既有路径）。全部命中既有规则或白名单：
  - `/admin/**`→ADMIN、`/merchant/**`→SHOP、`/dashboard/**`→USER、`/orders/**`、`/payments/**`、`/coupons/**`、`/addresses/**`、`/account/**`、`/returns/**`、`/stock-alerts/**`、`/chat/**`、`/notifications/**`、`/file/**`、`/common/{currentUser,updateCurrentUser,updatePassword,resetPassword}`、`/shoppingCart/{page,add,update,delBatch}`
  - `SpringMvcConfig.excludePathPatterns`（`config/SpringMvcConfig.java:20-36`）覆盖 `/checkout/summary`、`/checkout/promo`、`/products/**`、`/search/**`、`/merchants/**`、`/common/{login,register,sendResetCode,retrievePassword}`、`/error`
  - 刻意未登记且被闸门豁免的仅 `/shoppingCart/{list,selectById/**,createOrder}`
- **结论：本批次不存在「端点漏登记 → 静默 403」类缺陷。** 这一项可以从风险清单里移除。
- 新测试 `src/test/java/com/project/platform/config/AuthzRegistrationGateTest.java` 的思路正确（从容器现取 handler 路径）。但见 M-10：它的白名单是**手抄副本**，不是从 `SpringMvcConfig` 派生。

### 2.2 线上 dev 库只有 23 张表 / V6~V11 未应用 → **与代码一致，且能解释成因**

- `docker/entrypoint.sh:103` 的整批标记 `${DATA_DIR}/.schema-imported`：**该文件存在就整块跳过**导入（新增的 per-file 标记 `${DATA_DIR}/.imported/` 只在「品牌新库」的首次导入里生效）。已存在的 dev 库正是卡在这里 → V6~V11 不会自动补上。
- 反过来：**全新 clone 的库会自动导入 V6~V11**（`for f in /workspace/sql/migrations/*.sql` 是 glob，`rollback/` 在子目录里所以不会被误执行）。
- ⚠️ 阻塞性文档漂移：`docs/STARTUP.md:78`、`:198` 仍写「`sql/migrations/V1…V5.sql`」，`:244` 仍写「新增迁移（V4/V5 等）需手工执行」。**实际是 V1…V11**。A2 执行前必须先更正，否则运维照文档操作会误判。

### 2.3 V6~V11 的 Java 侧消费者 = **零**

逐符号 grep（`src/main` 全域）结果：

| 迁移产物 | 代码引用 |
|---|---|
| `merchant_wallet` / `merchant_wallet_transaction` | **0 处**（`MerchantApiController:259-279` 的 wallet 三端点仍是硬编码 `0` / 空列表 / no-op，本批次**未改**） |
| `admin_setting` / `merchant_setting` | **0 处**（`/admin/settings`、`/merchant/settings` 仍硬编码/no-op） |
| `product_order_evaluate.review_status` 等 4 列 | **0 处**（`AdminApiController:394` 反向依赖「库里没有该列」） |
| `product.status` | **0 处**（`AdminApiController:301` 同样反向依赖「没有该列」） |
| `shipping_address.is_default` | **0 处**（`PUT /addresses/{id}/default` 仍 no-op） |
| V9/V11 的 5 条索引 | 仅影响执行计划，不影响正确性 |

**推论（对 A2 有用）**：应用 V6~V11 是**纯增量、无行为变化**（`product.status NOT NULL DEFAULT 'active'`、`is_default DEFAULT 0`，存量行可见性/前端语义不变），**但它不会让任何一个「假的端点」变真**。同时，应用之后 §4 里若干「因为库里没有该列，所以只能返回空集/空串」的注释与 `docs/backend-api.md:327` 的记述会**变成假话**，必须同批更正。V8/V9/V10/V11 的 `ALTER ... ADD COLUMN/ADD KEY` **不可重复执行**（MySQL 8 报 1060/1061），依赖 per-file 标记或人工记账，不能盲跑两次。

---

## 3. must_fix 清单

归属采用项目自己的角色名（`docs/TASK-000/00-AGENT-REGISTRY.md`）：`backend` / `frontend` / `database` / `devops` / `qa` / `architect`。

### 🔴 Blocker（4）

#### B-1 `StorefrontCheckoutController` 把商品参数错误由 409 改成 400，既有测试断言 409 → `mvn test` 变红
- **文件:行号**：`src/main/java/com/project/platform/controller/StorefrontCheckoutController.java:84`（另 `:78-80` 对应 `CheckoutSummaryDTO.java:14-15` 的 javadoc 仍写「均为 409」）
- **证据**：
  - 代码：`throw new CustomException(HttpStatus.BAD_REQUEST, "结算商品参数不合法");`（`:84`）
  - 既有测试（**已跟踪、本批次未改**）：`src/test/java/com/project/platform/controller/RequestShapeTest.java:78-80`
    ```java
    post("/checkout/summary", "", Map.of("items", List.of(bad)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value(409));
    ```
  - 对照：`ErrorModelTest.java:100-109` 期望「空 items → 400」并**已通过** HEAD（说明 400 化的方向本身是对的），但同一个端点的另一条校验被留在 409 上。
- **影响**：`mvn -B clean test` 至少 1 条失败；CI / 验收闸门直接红。前端 `http.ts` 拦截器按状态码分流，409→400 也是**对外可见的契约变更**（未记入 `docs/backend-api.md` 的变更说明）。
- **修复建议（backend）**：二选一并保持单一事实来源 —— ① 保留 409（回退这一行）；或 ② 确认为 400，则**同批**改 `RequestShapeTest.java:78-80` 的断言、`CheckoutSummaryDTO.java:14-15` 的 javadoc、`docs/backend-api.md:104` 的说明，并作为契约变更上报总控。**不允许只改代码不改测试**。
- **归属**：backend（测试改动可由 qa 复核）

#### B-2 `/checkout/promo` 语义变更（必须登录 + 必须已领券 + 删除硬编码回退）未同步既有测试 → `StorefrontPromoTest` 11 条用例全红
- **文件:行号**：`CouponServiceImpl.java:110-137`（`userId == null → 400`、归属校验、`used` 校验、未命中 400）、`StorefrontCheckoutController.java:148`
- **证据**：`src/test/java/com/project/platform/controller/StorefrontPromoTest.java`（**已跟踪、本批次未改**）用匿名请求调该端点：
  ```java
  private ResultActions promo(String code, String subtotal) throws Exception {
      return post("/checkout/promo", "", Map.of("code", code, "subtotal", subtotal));  // token = ""
  }
  ```
  11 条用例（`percentCouponBelowCap` / `percentCouponCappedByMaxDiscount` / `percentCouponRoundsHalfUpToCents` / `fixedCoupon` / `fixedCouponAtExactMinOrder` / `belowMinOrderRejected` / `unknownCouponTypeYieldsZero` / `expiredCouponIsIgnored` / `disabledCouponIsIgnored` / `legacyFallbackCodeStillWorks` / `unknownCodeYieldsZero`）中：
  - 10 条隐含要求 HTTP 200（`discountOf()` 内 `.andExpect(status().isOk())`）→ 新代码匿名一律 400「请先登录后再使用优惠码」；
  - `legacyFallbackCodeStillWorks:129-131` 断言 `SAVE10 → 15.00` —— 该回退已被本批次**刻意删除**，与用例直接对立；
  - `belowMinOrderRejected:94-97` 断言 409，新代码在登录检查处就 400 返回。
- **影响**：`mvn test` 再红 11 条。合计 B-1+B-2 至少 12 条测试失败（占 163 条的 7.4%）。
- **修复建议（backend + qa）**：语义变更本身**是正确且应该保留的**（删掉可无限重复使用的假券码是本批次最有价值的改动之一）。必须做的是**同批重写这批用例**：改为带 `userToken()`、先用 `user_coupon` 造「已领取」行、把「未命中/过期/已停用/未知码」的期望从 `200 + 0.00` 改为 `400`，并删除 `legacyFallbackCodeStillWorks`。另：匿名可用性变化（见 M-4）要同步前端与 `docs/backend-api.md:105`。
- **归属**：backend（主）/ qa（补场景：并发核销只成功一次、`markUsedIfUnused` 抢占）

#### B-3 结算链路「显示金额 = 实际扣款」端到端**未打通**：新增的 `code` 字段没有任何客户端会发送
- **文件:行号**：
  - `src/main/java/com/project/platform/service/impl/ProductOrderServiceImpl.java:190-198`（只有 `dto.getCode()` 非空才折扣）
  - `web/src/composables/usePaymentFlow.ts:126-141`（`createPaymentIntent` 的 payload **没有 `code`/`promoCode`**）
  - `web/src/api/modules/checkout.ts:64`：`return post<OrderSummary>('/checkout/summary', { items, zip })`（**没有 `code`**）
  - `web/src/composables/useOrderSummary.ts:108`：`calculateOrderSummary(items.value, getZip())`
- **证据**：`usePaymentFlow.ts:129` 只发 `amount: total.value`，而后端 `ProductOrderServiceImpl` **不读前端 amount**（服务端按 DB 重算），券只有 `dto.getCode()` 一条路径。前端却把这个 `total.value` 当成应付额展示（`total = subtotal − summary.discount − promoDiscount − pointsDiscount`，`useOrderSummary.ts:54-70`）。
- **影响**：只要用户用了优惠码或积分，**页面显示金额 < 实际扣款金额**（差额正是优惠额 + 积分抵扣）。这正是本批次 `StorefrontCheckoutController` 类注释与 `StorefrontCheckoutDTO.java:17-24` 所宣称要修的「金额诚信（AC-04）」，而 `CheckoutSummaryDTO.java:29-33` 的 javadoc 明确写着「结算页把同一个码同时发给 `/checkout/summary` 与 `/payments/create`」——**该陈述与前端实现相反**。属资损方向缺陷 + 断言性文档与代码不符。
- **修复建议（frontend + backend）**：
  1. `calculateOrderSummary` 增加 `code?: string` 并透传（`checkout.ts:51-64`）；`useOrderSummary.fetchSummary()` 在已应用优惠码时带上 `promoCode.value`；
  2. `usePaymentFlow` 的 payload 增加 `code: promoCode`（`usePaymentFlow.ts:126-141`），与后端 `StorefrontCheckoutDTO.getCode()` 对齐；
  3. 积分抵扣同样未下发 —— 要么同批把积分也接到服务端，要么前端**不得**把它算进「应付金额」（否则差额依旧存在）；
  4. 修完必须由 qa 用真实后端跑一条「有券下单」的端到端，断言 `summary.total == payments/create 的 amount == Σ(product_order.total_money)`（AC-04.2/AC-04.3 目前**无自动化证据**）。
- **归属**：frontend（主）/ backend（契约确认）

#### B-4 购物车页仍在展示并计入**后端不存在的**运费/税/满减 → 购物车总价 ≠ 结算页总价 ≠ 实际扣款
- **文件:行号**：`web/src/pages/Cart.vue:31`（`shipping`）、`:32`（`tax`）、`:35-36`（前端 `getTieredDiscount` 满减）、`:58-62`（`total`）、模板 `:413-424`、`:425-430`
- **证据**：
  ```ts
  const shipping = computed(() => (subtotal.value >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE))
  const tax = computed(() => +(subtotal.value * TAX_RATE).toFixed(2))
  const total = computed(() => +(subtotal.value + shipping.value + tax.value - discount.value - tieredDiscount.value).toFixed(2))
  ```
  同一批次里 `web/src/pages/Checkout.vue:980-990` 已把运费行/税行**删掉**（注释：「运费模板尚未建模，后端不再返回」），后端 `StorefrontCheckoutController.calculateSummary` 也已把 `shipping`/`tax`/满减档位全部移除。**只有购物车页没跟上。**
- **影响**：同一个订单，购物车显示 `小计 + 运费 + 税 − 前端满减 − 优惠码`，结算页显示另一个数，实际扣款又是第三个数（= 小计）。这是本次改动**新造出来的队内不一致**（改动前两页同口径地错，现在一页改了一页没改），对用户是「越看越便宜/越贵」的信任损伤，也是 qa 最容易漏掉的一条。
- **修复建议（frontend）**：按 `Checkout.vue` 的同一口径处理 `Cart.vue`：删除运费行、税行、满减行与对应的 3 个 computed；如仍想保留「满 $200 免邮」的营销展示，必须明确标注为「未计入应付金额」并等运费模板落地后再接入。**不允许购物车和结算页各算一套。**
- **归属**：frontend

### 🟠 Major（11）

| ID | 文件:行号 | 证据 | 影响 | 修复建议 | 归属 |
|---|---|---|---|---|---|
| M-1 | `service/impl/AnalyticsServiceImpl.java:83-84`、`:134-135` | `revenuePrevious = sumPaidRevenue(null, previousStart)`，而 `AnalyticsMapper.xml:13-21` 的 `paidOrderFilter` **只有 `create_time >= since`、没有上界** → previous 是 `[now-60d, ∞)`，**是 recent `[now-30d, ∞)` 的超集** | Admin「Total Revenue」与 Merchant「Total Sales」的环比**恒为 0 或负**（previous ≥ recent 恒成立）。本批次的立项目的就是「把硬编码 $0 换成真数据」，结果换成了一条**必然错**的环比。注意同文件 `:91`/`:103`/`:143` 的用户数/订单数**都做了减法**（正确），说明这是遗漏而非设计 | 加窗口上界：新增 `sumPaidRevenueBetween(shopId, from, to)` 或在片段里加 `<if test="until != null">AND create_time < #{until}</if>`；或服务层用两次调用相减（收入不能相减？可以，收入是可加的） | backend |
| M-2 | `service/impl/AnalyticsServiceImpl.java:158-163` | `int allRecent = ordersRecent;` → `conversionRecent = ratio(ordersRecent, allRecent)` **恒等于 100.0%**；`signedPercent(conversionRecent - conversionPrevious)` 因此恒为 `100.0 - 某值` | Merchant「Conversion Rate」卡片的 change 是**结构性错误值**，无论真实转化率是多少 | 分母要按「同一时间窗内的全部订单单数」算：新增 `countDistinctOrders(shopId, since)`（带窗口），`conversionRecent = ratio(ordersRecent, allRecent)` 才成立；若做不到就**如实展示 `+0%`**（与本文件 `:152` 对 Products 卡片的处理一致） | backend |
| M-3 | `service/impl/AnalyticsServiceImpl.java:114-118` | `activePrevious = countDistinctOrderingUsers(now-48h)`，`signedCount(activeNow - activePrevious)`；注释却写「与前一个 24h 的绝对差值」 | 48h 窗口**包含** 24h 窗口，差值是「24h 内下单人数 − 48h 内下单人数」，语义与注释/前端标签均不符；且 `countDistinctOrderingUsers` 本身近似（见 M-4） | 要么用 `[24h,48h)` 的显式窗口查询，要么去掉 change、只展示绝对值 | backend |
| M-4 | `AdminApiController.java:45-48` + `AnalyticsServiceImpl.java:109-118` + `web/src/pages/admin/AdminHome.vue:172` | 卡片字面量仍是 `"Active Now"`，前端区块标注 `Real-time`，实际口径是「近 24h 内**下过单**的去重用户数」（库里无 session/last_login） | 向管理员宣称「实时在线」而实际是「近 24h 下单人数」—— 本批次反复强调「不要编数据/不要虚假宣称」，此处仍是一条**会被读成实时在线**的宣称 | 要么改前端文案（`Real-time` → `Last 24h, placed an order`），要么改成真实可算的口径；`label` 字面量属前端契约，须 frontend+backend 同批改 | frontend（主）/ backend |
| M-5 | `service/impl/AnalyticsServiceImpl.java:369-372` vs `AnalyticsMapper.xml:220-222` | Mapper 注释明写「无评价时 AVG 返回 NULL → avgRating 为 null（不是 0：**0 分会被读成「差评」**），调用方需自己处理」；调用方却 `stats.setRating(0.0)`、`satisfactionRate=0` | 店铺页（`web/src/pages/StorePage.vue:308`、`components/ui/chat/MerchantInfoPanel.vue:156`）会渲染成 **「0.0 rating / 0% positive」**，即「无评价」被显示成「极差评价」，与本批次「宁可空态，不要假数据」的原则相反 | 契约改为 `rating: number \| null` 并由前端隐藏该区块；或 service 层返回 `null` + 前端 `v-if`。不要用 0 冒充 | backend + frontend |
| M-6 | `web/src/pages/admin/AdminHome.vue:158-166` | 新增空态 `v-if="!isLoadingRef && revenueData.length === 0"`，但后端 `AnalyticsServiceImpl.adminRevenueChart():190-198` **永远返回 `span` 个点**（无订单的日期补 0），mock 分支 `web/src/api/modules/adminDashboard.ts:41-49` 也非空 | 该空态**不可达**：本批次新增的「Revenue 无数据」提示永远不会出现，而 ECharts 会画一条全 0 的假曲线 —— 恰好推翻它自己的注释「避免『没数据』和『没加载出来』看起来一模一样」 | 二选一：后端在「窗口内零订单」时返回 `[]`（并让前端补轴），或前端去掉该空态、改为在 ECharts 上标注「近 7 天无已支付订单」 | frontend（主）/ backend（口径确认） |
| M-7 | `docs/backend-api.md:104`、`:105`、`:326` | `:105` 仍写「未命中再兜底硬编码 `SAVE10`/`VIP15`」——**该回退已被本批次删除**（`StorefrontCheckoutController.java:148-157` 已无回退分支）；`:104`/`:326` 仍写 summary「重算小计/运费/税/满减」——三项已全部移除 | 契约文档与代码**反向相反**：照文档写客户端会实现一个不存在的回退；也会让后来者以为金额口径没变 | 同批更新这三处，并补上 `code` 入参、`discountCode` 出参、以及「未登录用券 → 400」的行为 | backend（文档）/ lead（契约核准） |
| M-8 | `docs/backend-api.md:159`、`:201` | 写「`Sales` / `Orders` = 累计已支付**订单行数**」；代码 `AdminApiController.java:47` → `AnalyticsServiceImpl.java:101`、`:141` 用的是 `countDistinctPaidOrders`（**订单单数**，按 `order_no` 去重），且代码注释专门解释了为什么不能用行数 | 口径文档写错，管理员核对钱包/对账时会按错误口径理解 | 改为「订单**单数**（同一 `order_no` 多行算一单）」 | backend |
| M-9 | `web/src/pages/merchant/Wallet.vue:750-777` 的读取侧没错，但后端 `MerchantApiController.java:259-279` | `/merchant/wallet` 返回 `balance=0`、`/wallet/transactions` 恒空列表、`/wallet/withdraw` **返回 200 但没有任何副作用**（注释自认「入参已去掉以如实表达输入被忽略」） | 钱包页现已被本批次改成「失败必显 ErrorState」，但对**成功返回的 0 元/no-op** 无从分辨：商家点「Withdraw」会拿到 200 与成功 toast，一分钱都没动 —— 正是本批次反复要消灭的「静默成功」。**注意：这三条端点在本批次未改动，属既有缺陷，但 V6 已就位而代码未接，A2 应用 V6 后**仍不修**此缺陷** | 短期：`/withdraw` 明确返回 `501/400 + 明确文案`（或前端禁用按钮），不要 200；长期：接 D2 的 wallet 实现 | backend |
| M-10 | `src/test/java/com/project/platform/config/AuthzRegistrationGateTest.java:68-80` | 类注释宣称「故意不维护任何端点清单」，但 `PUBLIC_WHITELIST` 是 `SpringMvcConfig.excludePathPatterns` 的**手抄副本**；只要有人改 `SpringMvcConfig` 而没同步这里，闸门就会**假绿** | 假绿的具体路径：新增端点 + 顺手加进本测试白名单（但忘了加进 `SpringMvcConfig`）→ 测试通过，生产 403。这恰好是本测试要防的缺陷 | 让白名单有单一事实来源：在测试里 `new SpringMvcConfig()` 并传入一个捕获用的 `InterceptorRegistry`（或反射读 `excludePathPatterns`），与 `PUBLIC_WHITELIST` 做集合相等断言 | qa / backend |
| M-11 | `pom.xml:22-42`、`src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker` | 覆盖 `<mockito.version>5.11.0</mockito.version>` + 新增 `mockito-subclass` + 全局把 MockMaker 切成 `mock-maker-subclass` | ① `docs/DEVELOPMENT.md` 自己记录了 `mockito-bom:pom:5.11.0 (absent)` 的**离线构建失败**（现已写入正文），即本改动使离线/内网构建变脆；② 全局切 `mock-maker-subclass` 与默认 `mock-maker-inline` 的能力不同（final 类/静态方法 mock 行为变化），属**与功能无关的测试基础设施变更**混在业务批次里 | 与 B-1/B-2 的测试修复一起由 `mvn -B clean test` 实证；若 `mockito-subclass` 不是必需，回退到不覆盖版本、不切 MockMaker（拆成独立 chore 提交） | devops / qa |

### 🟡 Minor（12）

| ID | 文件:行号 | 证据 / 问题 | 建议 | 归属 |
|---|---|---|---|---|
| m-1 | `service/impl/ProductOrderServiceImpl.java:253` | `BigDecimal hundred = new BigDecimal(100);` 声明后**从未使用**；`:149` 的 javadoc `{@link #allocateDiscount}` 指向**不存在的方法**（真名 `applyDiscountToRows`） | 删除死变量；修正 javadoc 链接 | backend |
| m-2 | `controller/StorefrontMerchantController.java:136`、`StorefrontSearchController.java:126` | `type.getName().equals(category)` —— `product_type.name` 为 NULL 时 NPE（`AnalyticsServiceImpl.java:226-229` 处理了 NULL，这里没有） | 改为 `category.equals(type.getName())` 或先判空 | backend |
| m-3 | `controller/StorefrontMerchantController.java:144-157` | `shopCategories()` 用 `productService.page(query, 1, MAX_PAGE_SIZE=100)` 拉全店商品**只为取分类名**；店铺商品 >100 时分类列表**静默截断**（潜在少显示分类） | 加一条 `SELECT DISTINCT pt.name FROM product p JOIN product_type pt ... WHERE p.shop_id=?` 的 mapper 方法；分类名解析同理（`resolveTypeId` 每次 `productTypeService.list()` 全表查） | backend |
| m-4 | `controller/StorefrontMerchantController.java:116-122`、`StorefrontSearchController.java:83-90` | 分类名**查不到时不按分类过滤、返回全部商品**（注释自认「查不到就不按分类过滤」）。这与本批次反复强调的「静默过滤器是缺陷」自相矛盾：用户点了/传了一个不存在的分类，却看到「全店商品」，会以为是正确筛选结果 | 统一口径：未命中分类 → 返回空集（或 400/404），不要静默退化为「不过滤」 | backend |
| m-5 | `controller/StorefrontSearchController.java:108-117` + `service/impl/AnalyticsServiceImpl.java:264-281` | 控制器花一次 DB 查询算出 `typeId` 传进去，`searchFacets(keyword, productTypeId)` 的实现**始终传 `null`**（有意为之，注释解释「每维只应用关键字」）。参数是**死的**，且浪费一次 `productTypeService.list()` | 删掉该参数（或改成 `searchFacets(keyword)`），把「不带分类」的理由留在方法注释里 | backend |
| m-6 | `mapper/AnalyticsMapper.java:54`、`:87` | `countPaidOrders` / `countOrders` 在整个 `src/main` **零引用** | 删除或标注为「仅供后续使用」 | backend |
| m-7 | `controller/StorefrontSearchController.java:124-132` vs `StorefrontMerchantController.java:134-142` | `resolveTypeId(String)` **逐字重复两份** | 抽到公共工具（如 `ProductTypeService.resolveIdByName`） | backend |
| m-8 | `web/src/api/modules/coupons.ts:165`、`:79` | 前端 mock 仍保留 `SAVE10` / `VIP15` 硬编码券与「匿名可用」语义；后端已删除回退且要求登录+归属 → mock 与真实后端**行为分叉**（mock 下可用、真实下 400） | mock 表与后端 `coupon` 种子对齐；`usePromoCode` 增加「未登录 → 明确提示先登录」分支 | frontend |
| m-9 | `web/src/api/modules/product.ts:356-362` | 商品详情 mock 仍伪造 `rating: +(3.8 + (id % 13) * 0.1)`（本批次已把伪造评价 `SEED_REVIEWS` 关掉） | mock 分支保留可以，但应加显式注释「mock 专用、非真实评分」；若该 `enriched` 不在 `USE_MOCK` 保护内则是 Major，需 qa 确认 | frontend |
| m-10 | `src/main/resources/mapper/ProductOrderMapper.xml:64-69`、`AdminApiController.java:332`、`MerchantApiController.java:143` | `keyword` 跨列 `LIKE '%x%'` 四列 OR，无法走索引；管理端一次拉 100 条（`AdminApiController.java:334` `page(query,1,100)`）后再内存过滤 | 可接受（管理端低频）；建议加注释说明「故意不在 SQL 里做分页前过滤的取舍」，或改 `FULLTEXT`/前缀匹配 | backend |
| m-11 | `web/vite.config.ts:27-46` | `optimizeDeps.include` 是 **dev-only**，对 `build` 无影响（结论：**不影响生产构建**，`manualChunks` 未改动）；但 `include: ['element-plus/es', ...]` 若入口名与实际 exports 不符，dev server 会启动失败 | 需 env-verifier/qa 起一次 dev server 自证；建议 `pnpm/npm run dev` 后确认无 `Failed to resolve` 与 `optimized dependencies changed` 重载 | devops / qa |
| m-12 | 仓库根 `Agent-System-Prompt.txt`（30984 B，未跟踪）、`uploads/demo-avatar.png` | 前者是**内部 Agent 系统提示词**被放在仓库根，一旦 `git add .` 就会入库（含内部流程/治理规则），属信息外泄面；后者是 `sql/schema.sql:40` 头像所指的占位图（`.gitignore` 已加 `!uploads/demo-avatar.png` 例外），**必须入库** | `Agent-System-Prompt.txt` 加入 `.gitignore`（或移到仓库外的 `docs/TASK-000/` 之外的私有位置）；`uploads/demo-avatar.png` 保留入库 | lead / devops |

---

## 4. 逐文件结论表

**处置口径**：`可保留` = 本次可原样进入基线；`需修后保留` = 方向正确但必须先生效 §3 的某几条；`应回退` = 建议整体撤销（**本次为 0 个**）。

### 4.1 后端 Java（含未跟踪新文件）

| 文件 | 改动性质 | 结论 | 关联 must_fix |
|---|---|---|---|
| `controller/StorefrontCheckoutController.java` | summary 去运费/税/满减、改为只认 coupon 表；promo 严格化并去回退 | **需修后保留** | B-1、B-2、M-7、m-4 |
| `service/impl/CouponServiceImpl.java` | 严格模式 + 归属校验 + 封顶 + 条件核销 | **需修后保留**（逻辑本身是本批次最扎实的一块） | B-2（测试）、M-4（匿名语义）、m-8 |
| `service/CouponService.java` | `applyByCode` 加 `userId`、新增 `redeem` | **需修后保留** | B-2 |
| `mapper/UserCouponMapper.java` | 新增 `markUsedIfUnused`（条件 UPDATE 乐观锁） | **可保留**（并发核销防重的正确做法） | — |
| `service/impl/ProductOrderServiceImpl.java` | 优惠按行比例分摊（Hare 配额）、核销入事务 | **需修后保留**（算法正确，但上游没有客户端发 `code`） | B-3、m-1 |
| `dto/StorefrontCheckoutDTO.java` | 新增 `code` + getter/setter | **需修后保留**（字段本身对，缺下游） | B-3 |
| `dto/CheckoutSummaryDTO.java` | 新增 `code` | **需修后保留**（javadoc 与代码/测试冲突，`:14-15` 与 `:29-33`） | B-1、B-3 |
| `service/impl/AnalyticsServiceImpl.java`（新） | 看板真实聚合、facets、热门词、店铺统计 | **需修后保留** | M-1、M-2、M-3、M-5、m-5 |
| `mapper/AnalyticsMapper.java` + `resources/mapper/AnalyticsMapper.xml`（新） | 12 个只读聚合 SQL，「已支付」白名单口径集中在 `paidOrderFilter` | **需修后保留**（口径白名单 + `COALESCE` + 去重键都正确；需加窗口上界） | M-1、m-6 |
| `vo/{StatVO,ShopPublicStatsVO,SearchFacetsVO,RevenuePointVO,ShopRatingVO,ShopRevenueVO,CategoryCountVO,PriceBucketCountVO,PriceRangeCountVO,RatingCountVO}.java`（新） | 纯数据载体，字段与前端契约逐项对得上 | **可保留**（`rating` 的「null 还是 0」见 M-5） | M-5 |
| `controller/AdminApiController.java` | 看板/商家营收/关键词/角色 全部真实化；`status` 过滤在「无该列」前提下如实返回空集 | **需修后保留** | M-2/M-8（口径与文档）、M-4 |
| `controller/MerchantApiController.java` | 订单状态机 + 400；`shopId` 只取 token 集中到 `currentShopId()`；`shipped` 不再擦单号 | **需修后保留**（状态机与 IDOR 收口是正确改动） | M-9（wallet 未动）、m-4 |
| `controller/StorefrontDashboardController.java` | Pending 由减法推导改为显式计数 | **可保留**（消除「未知状态被算进 Pending」） | — |
| `controller/StorefrontMerchantController.java` | 404 for missing shop、真实 stats/featuredProducts/categories | **需修后保留** | M-5、m-2、m-3、m-4 |
| `controller/StorefrontProductController.java` | `category-counts` 真实化 | **可保留** | — |
| `controller/StorefrontSearchController.java` | `trending`/`facets`/`relatedSearches` 真实化 | **需修后保留** | m-2、m-4、m-5、m-7 |
| `service/ProductService.java` / `service/impl/ProductServiceImpl.java` / `mapper/ProductMapper.java` | 新增 `salesVolumeTopByShopId`（按店而非全局榜） | **可保留**（修掉了「小店铺恒空」） | — |
| `resources/mapper/ProductOrderMapper.xml` | 新增 `keyword` 跨列模糊条件 | **可保留** | m-10 |
| `src/test/java/.../MerchantOrderOwnershipTest.java`（新） | 11 条归属/状态机回归（含 `shop2Token()` 正向用例） | **可保留**（`BaseControllerTest` 已有 `shop2Token()`，依赖齐备） | — |
| `src/test/java/.../config/AuthzRegistrationGateTest.java`（新） | 从容器枚举 handler 的授权登记闸门 | **需修后保留** | M-10 |
| `src/test/resources/schema-h2.sql` | H2 补齐 V6~V11 的表/列/索引 + 种子 | **需修后保留**（H2 现在**领先** MySQL：`review_status`/`product.status`/`is_default` 在 H2 已有、MySQL 没有 → 与 `AdminApiController:394` 的注释矛盾，见 M-7/§2.3） | M-7、M-8 |

### 4.2 SQL / 迁移 / schema

| 文件 | 结论 | 关联 |
|---|---|---|
| `sql/migrations/V6__merchant_wallet.sql`（新） | **可保留**（设计完整：`DECIMAL(14,2)`、幂等键唯一、出参符号契约写明）。**但代码零消费者，应用后不生效果** | §2.3、M-9 |
| `sql/migrations/V7__platform_settings.sql`（新） | **可保留**（`uk_singleton`/`uk_merchant_setting_shop_id` 存在，`INSERT IGNORE` 可重复执行）；同样零消费者 | §2.3 |
| `sql/migrations/V8__review_moderation.sql`（新） | **可保留但需记账**：`ADD COLUMN`（无 `IF NOT EXISTS`，MySQL 8 不支持）**不可重复执行**（1060）；应用后 `AdminApiController.java:394`、`docs/backend-api.md:327`、`schema-h2.sql` 注释需同批更正 | M-7、§2.3 |
| `sql/migrations/V9__dashboard_aggregate_indexes.sql`（新） | **可保留**：`idx_create_time` 与 V4 的 `idx_status_create_time` 不重名；`ADD KEY` 同样不可重复执行（1061） | §2.3 |
| `sql/migrations/V10__product_status_and_default_address.sql`（新） | **可保留**：`NOT NULL DEFAULT 'active'` / `DEFAULT 0`，存量语义不变；3 条索引不与 V4 重名。注意 `idx_shop_status` 与 V4 的 `idx_shop_id` 功能部分重叠（无害） | §2.3 |
| `sql/migrations/V11__order_dashboard_indexes.sql`（新） | **可保留**：两条复合索引与 V4 不重名 | §2.3 |
| `sql/migrations/rollback/V6~V11`（新，6 个） | **可保留**（未逐行核；V6/V7 应为 `DROP TABLE`，V8/V10 应为 `DROP COLUMN`，V9/V11 应为 `DROP KEY`） | — |
| `sql/schema.sql` | **可保留**（仅注释 + admin 头像改为入库的 `demo-avatar.png`，修掉「全新 clone 后 admin 顶栏裂图」） | — |
| `src/test/resources/schema-h2.sql` | 见 4.1 最后一行 | M-7 |

### 4.3 前端

| 文件 | 结论 | 关联 |
|---|---|---|
| `web/src/composables/usePaymentFlow.ts`（**未改动，是 B-3 的另一半**） | **需修后保留**（必须加 `code`） | B-3 |
| `web/src/api/modules/checkout.ts` | **需修后保留**（`shipping?/tax?` 可选化是对的；缺 `code` 透传） | B-3 |
| `web/src/composables/useOrderSummary.ts` | **可保留**（`amount()` 兜 NaN 是对的做法） | B-3（上游） |
| `web/src/composables/useOrderSummary.spec.ts` | **可保留**（口径改动已同步，含「后端不返回运费/税也不 NaN」的新用例） | — |
| `web/src/pages/Cart.vue` | **需修后保留**（删除运费/税/满减行与 3 个 computed） | **B-4** |
| `web/src/pages/Checkout.vue` | **可保留**（删运费/税行、去 `Truck` 徽章、`Number(...) \|\| 0` 落库，均自洽） | B-3（同链路） |
| `web/src/pages/Home.vue` | **可保留**（移除 Recommended/RecentlyViewed 板块；`Skeleton`/`router`/`Product` 仍被使用，`noUnusedLocals` 不会报错，已逐个核实） | — |
| `web/src/pages/ProductDetail.vue` | **可保留**（移除已删的 `:product-id` prop） | — |
| `web/src/pages/admin/AdminHome.vue` | **需修后保留**（新增空态不可达） | M-6 |
| `web/src/pages/admin/Settings.vue` | **可保留**（骨架屏 + `initialLoading:true`，`useAsyncTask` 确有此选项 `:53/:66`） | — |
| `web/src/pages/merchant/MerchantHome.vue` | **可保留**（空态，`Package` 图标已在作用域） | — |
| `web/src/pages/merchant/Settings.vue` | **可保留**（`ErrorState` + retry；`toast` 仍在使用，无未用导入） | — |
| `web/src/pages/merchant/Wallet.vue` | **可保留**（`ErrorState`/骨架/`#empty`；`PayoutWalletIcon` 已导入 `:403`） | M-9（后端未接） |
| `web/src/components/ui/product/ReviewSection.vue` | **可保留**（`mergedReviews` 确认在作用域 `:54`） | — |
| `web/src/components/ui/product/ProductGallery.vue` | **可保留** | — |
| `web/src/composables/useProductGallery.ts` | **可保留**（去掉 picsum 两级转移链，失败直接落内联占位图，零外部请求） | — |
| `web/src/utils/imagePlaceholder.ts` | **可保留**（注释同步） | — |
| `web/src/utils/format.ts` | **可保留**（`toAmount` 兜 NaN/Infinity） | — |
| `web/src/api/modules/product.ts` | **可保留**（`images: [item.image]` 去重复三份） | m-9 |
| `web/src/api/modules/reviews.ts` | **可保留**（`SEED_REVIEWS_ENABLED=false` 关掉伪造评价；副作用真实：真实后端无评价端点 → 生产显示空态，属「诚实降级」） | — |
| `web/src/main.ts` | **可保留**（全量 `element-plus/dist/index.css`，与 `importStyle:false` 配套；删除的两条 `style/css` 已被全量 CSS 覆盖） | m-11 |
| `web/vite.config.ts` | **可保留**（`optimizeDeps` 仅影响 dev；`build.rollupOptions` 未改 → **不影响生产构建**） | m-11 |
| `web/src/i18n/locales/en.ts` | **可保留**（删除随板块一起去掉的 4 个键；`checkout.freeShip`/`cart.shipping` 等成为未用键，无害） | — |
| `web/src/components.d.ts` | **可保留**（unplugin 生成物） | — |
| `web/.gitignore` | **可保留**（`package-lock.json` 改为入库 —— 这是**必需的修复**：Dockerfile 的 `COPY web/package-lock.jso[n]` 与 `npm ci` 都依赖它） | — |
| `web/package-lock.json`（新增，7067 行） | **可保留**：`lockfileVersion 3`，根 `dependencies`/`devDependencies` 与 `package.json` 逐项一致（已比对），`resolved` 指向 `registry.npmmirror.com`（国内镜像）且带 `integrity` —— 构建机需能访问该镜像 | — |
| `src/package-lock.json`（删除） | **可保留**（残留文件） | — |
| `web/README.md`（删除）、`docs/API接口说明.md`（删除） | **可保留**（内容已并入 `README.md`/`docs/STARTUP.md`；后者本就是「历史文档，不要当契约」） | — |
| `web/tests/{e2e-functional,features,product-gallery}.spec.ts` | **可保留**（跟随 UI 删除同步断言，且**没有**把「删掉板块」写成假通过；product-gallery 改用 video 缩略图这一改动与 mock 只回一张图的事实一致） | — |

### 4.4 构建 / 环境 / 文档

| 文件 | 结论 | 关联 |
|---|---|---|
| `docker/Dockerfile` | **可保留**（依赖预热层；`COPY web/package-lock.jso[n]` 的通配写法是对「锁文件曾缺席」的防御） | M-11（镜像构建需联网） |
| `docker/entrypoint.sh` | **可保留且是重要修复**（按文件记导入完成度，修掉「一次失败即永久跳过」） | §2.2 |
| `docker/docker-compose.yml` | **可保留**（entrypoint 改为执行工作区副本 + `tr -d '\r'`，修掉「镜像里旧脚本导致前端打不开」） | — |
| `docker/.env.example`、`docker/README.md` | **可保留** | — |
| `.github/workflows/dev-env-image.yml`（新） | **可保留**（触发路径、`packages: write`、双架构、GHCR 小写归一化都对） | — |
| `docker/scripts/{dev.sh,dev.ps1,publish-image.sh,verify-realtime.ps1}`（新） | **可保留**（未逐行核；`reset` 会删数据卷 —— `stop.sh:6` 已明确提示，可接受） | — |
| `start/stop/logs/dev.{sh,bat}`（新，8 个） | **可保留**（薄封装，逻辑在 `docker/scripts/dev.sh`） | — |
| `docs/STARTUP.md`（新，15514 B） | **需修后保留** | §2.2（`:78`/`:198`/`:244` 仍写 V1…V5） |
| `README.md` | **可保留**（启动章节收敛到 `STARTUP.md`，消除两份说法） | — |
| `docs/DEVELOPMENT.md` | **可保留**（新增 §8/§9：XML 良构性、陈旧 class、并行写竞态、H2/MySQL 索引命名 —— 都是真实踩过的坑）；注意 §9.1 提到的 `AnalyticsMapper.xml:151` 裸 `<` 是**历史**缺陷，当前文件已是 `&lt;`（已核） | — |
| `docs/backend-api.md` | **需修后保留** | M-7、M-8 |
| `.gitattributes` | **可保留**（新增 `*.bat`/`*.ps1 eol=crlf`） | — |
| `.gitignore` | **可保留**（`!uploads/demo-avatar.png` 例外，与 `sql/schema.sql` 头像一致） | m-12 |
| `pom.xml` | **需修后保留** | M-11 |
| `Agent-System-Prompt.txt`（未跟踪，仓库根） | **需修后保留**（加 `.gitignore` 或移出仓库） | m-12 |
| `docs/TASK-000/*`（未跟踪，11 份）、`docs/aiagant-backend.md` | **可保留**（本轮治理文档） | — |
| `web/public/img/p{1,2,3}.jpg`（未跟踪） | **可保留**（修掉了「商品图 404 → Vite SPA 回落 index.html → 200 text/html → @error → 打 picsum」的根因） | — |
| `uploads/demo-avatar.png`（未跟踪） | **可保留且必须入库** | m-12 |

---

## 5. 「未提交改动能否原地保留」——明确结论

**结论：不能原地保留作为可验收基线（❌）；但也不应整批回退。**

| 判断维度 | 结论 |
|---|---|
| 有没有文件需要整体回退到 HEAD？ | **没有**。4 个 Blocker 全是「局部 hunk + 未同步的测试/未接的下游」，不是方向性错误 |
| 修完 4 个 Blocker 需要多长时间？ | 估计：B-1 改 1 行或改 1 条测试；B-2 重写 1 个测试类（11 条）；B-3 前端补 `code` 透传（3 个文件、约 15 行）；B-4 删购物车 3 行模板 + 3 个 computed。**均在一个工作单元内可完成** |
| 修完就能验收吗？ | 不能只靠静态审查宣告。还需要 qa 用**真实后端**跑三条端到端：① 有券下单金额三方一致（B-3）；② 购物车→结算→扣款三处金额一致（B-4）；③ 商家越权/状态机（已有新测试，需真跑）。另需 env-verifier 重启后端后复验（当前运行中的 JVM 早于这些改动，属过期运行态） |
| 迁移要不要在验收前应用？ | **与该门槛无关**（§2.3）。V6~V11 应用与否都不改变这 4 个 Blocker 的成立与修法 |
| 若时间不够，最小可交付是什么？ | B-1 + B-2（让 `mvn test` 回绿）+ B-3 的「前端不再展示未真正减免的金额」（可以先隐藏而非接通）+ B-4。B-4 与 B-3 的「隐藏」方案加起来不到 30 行，是性价比最高的一步 |

---

## 6. 本批次值得肯定的部分（不建议在整改中被削掉）

1. **删掉 `SAVE10`/`VIP15` 硬编码回退**并加上归属/有效期/已用/门槛四重校验 —— 修掉了「任何人输入任意码都能打折、同一码无限次使用」的实质资损口子。
2. **`markUsedIfUnused` 条件 UPDATE 抢占**（`UserCouponMapper.java:33-34`）—— 用乐观锁而不是「先查后写」，并发核销只成功一次，写法正确。
3. **优惠按行比例分摊（Hare 配额）+ 封顶为小计**（`ProductOrderServiceImpl.java:241-292`）—— 数学论证完整（含「末行兜余数会造出比原价还贵的行」的反例），`Σ(各行 total_money) == 应付` 这个不变式是真的成立的（在 `code` 能送达的前提下）。
4. **`AnalyticsMapper.xml` 的「已支付」白名单口径集中在一处**（`paidOrderFilter`）—— fail-closed，新增状态默认不计入营收；`COALESCE` 兜零、`COUNT(DISTINCT COALESCE(order_no, 'legacy-'+id))` 兜住历史 NULL 行。**这是本次质量最高的 SQL。**
5. **订单状态机前置校验**（`MerchantApiController.java:37-53`）—— 关掉了「待支付一步跳已完成」；归属校验保持在 Service 层不重复叠加，`currentShopId()` 集中取 token，杜绝了「日后某个端点改读参数就开出横向越权」。
6. **`entrypoint.sh` 按文件记导入完成度** —— 修掉了「一次导入失败被永久钉死、数据库残缺且永不自愈」。
7. **诚实化的一贯性**：`getProfile` 不再编 `4.5 分 / 95% 好评 / Unknown Store`（改 404）、`SEED_REVIEWS` 关掉、`/search/trending` 不再返回固定数组、`useProductGallery` 去掉 picsum 假图、`Home.vue` 删掉「推荐」板块 —— 方向完全正确，仅是**没走完**（B-3/B-4/M-5/M-6）。

---

## 7. 未验证项清单（不得当成已验）

> 以下全部需要 **env-verifier / qa-acceptance** 提供运行期证据。本审查为只读静态审查，未执行任何编译或测试。

| # | 未验证项 | 需要谁、怎么验 | 关联 |
|---|---|---|---|
| U-1 | `mvn -B clean test` 的真实结果（含 B-1/B-2 预测的 12 条失败、其余 151 条是否全绿） | qa / env-verifier：干净编译后跑全量测试；**先验证 Mapper XML 良构性**（`docs/DEVELOPMENT.md §9.1` 的 147 连挂陷阱） | B-1、B-2 |
| U-2 | `pom.xml` 的 `mockito.version=5.11.0` 覆盖 + `mockito-subclass` + 全局 `mock-maker-subclass` 是否真能跑通（含离线场景） | qa：`mvn -o` 与联网各一次 | M-11 |
| U-3 | 新增 `AnalyticsMapper.xml` 的 SQL 在 **MySQL 8** 与 **H2(MODE=MySQL)** 下是否都执行成功（`GROUP BY bucket` 用别名、`COALESCE(SUM()*100/NULLIF(COUNT(),0),0)` 的 DECIMAL→int、`DATE(create_time)`） | qa：H2 侧由 `mvn test` 覆盖；MySQL 侧需 env-verifier 在真实库跑一次 4 个看板端点 | M-1~M-4 |
| U-4 | `countEnabledUsers` 用的 `user.status = '启用'` 是否与种子的字面量一致（未核对种子行） | qa：`GET /admin/dashboard/stats` 的 Active Users 与 `SELECT COUNT(*) FROM user WHERE status='启用'` 对拍 | — |
| U-5 | 前端 `npm run typecheck`（`strict + noUnusedLocals + noUnusedParameters`）是否全绿 | qa：`npm run typecheck`（我已逐个核实 `Cart.vue` 的 `Tag`、`Home.vue` 的 `Skeleton/router/Product`、`Wallet.vue` 的 `PayoutWalletIcon`、`ReviewSection.vue` 的 `mergedReviews` 均**仍被使用**，但 `Checkout.vue`/`Cart.vue` 全量未逐行扫） | B-4 |
| U-6 | `npm run test:unit`（含改动过的 `useOrderSummary.spec.ts`）；`npm run lint` 是否有新增告警 | qa | — |
| U-7 | `vite.config.ts` 的 `optimizeDeps.include: ['element-plus/es', ...]` 是否可解析（dev server 能起、无 `Failed to resolve`、无 `optimized dependencies changed` 重载） | env-verifier / qa：起一次 dev server 并打开一个含 `el-*` 的页面 | m-11 |
| U-8 | `npm run build-prod` 是否成功、CSS 体积是否如注释所述（约 357KB） | qa | m-11 |
| U-9 | `web/package-lock.json` 与 `package.json` 是否 `npm ci` 级一致（我只比对了根 `dependencies`/`devDependencies`） | env-verifier：`docker build`（Dockerfile 第 5b 步会跑 `npm ci`） | — |
| U-10 | 前端 mock 分支 `product.ts` 的 `enriched`（含伪造 `rating`）是否在 `USE_MOCK` 保护内 | qa：`VITE_USE_MOCK=false` 构建后确认详情页评分来源 | m-9 |
| U-11 | 备份/回滚脚本 `sql/migrations/rollback/V6~V11` 的内容正确性（未逐行核） | database / env-verifier | §4.2 |
| U-12 | 端到端金额一致性（AC-04：`summary.total == payments amount == Σ total_money`）、有券并发核销只成功一次、真实后端下购物车/结算/扣款三处一致 | qa-acceptance：必须**真实后端 + 真实库**，不能用 mock 或 Playwright（其 `storageState` 注入 `RUNTIME_USE_MOCK='true'`，**永远不会打到后端**，对 B-3/B-4 零感知） | B-3、B-4 |
| U-13 | 运行中的后端 JVM 早于本批改动（过期运行态），重启后是否正常启动 | env-verifier：干净编译 + 重启 + 真实 HTTP 探活（`docs/DEVELOPMENT.md §9.2`：陈旧 class 会伪装成「服务正常」） | — |
| U-14 | V6~V11 在**真实 MySQL 8** 上是否逐条执行成功（尤其 V8/V10 的 `ADD COLUMN ... AFTER` 在目标库列名/顺序是否满足） | env-verifier / database（**A2 范围内，但不属本审查的 Blocker**） | §2.3 |

---

## 8. 审查者自述与边界

- 本次**只写** `docs/TASK-001/07-CODE-REVIEW.md`，未改动任何业务代码、测试、SQL、配置。
- 未使用 docker、未运行 mvn/npm —— 遵守「容器独占锁在 env-verifier 手里」的约束。因此所有「测试会红」是**基于代码与测试原文的推演**（已给出双侧行号与原文），仍需 U-1 实证。
- §26.15：本报告只负责发现问题、报告、给修复建议；**修复由对应 Developer Agent 执行**（归属列已给出）。
- 已独立核验但**未推翻**既有结论：HEAD=`f4df6ac`；V6~V11 未应用；运行中 JVM 属过期运行态；`AuthzRules` 覆盖完整。
