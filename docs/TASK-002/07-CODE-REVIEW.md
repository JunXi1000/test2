# TASK-002-E Review Gate：修复 diff 与契约落实审查

- **审查对象**：TASK-002 本轮修复（backend-fix 的 `src/main/**` + frontend-fix 的 `web/src/**` + qa 的 `src/test/**`、`web/tests/**`）
- **契约真源**：`docs/TASK-002/00-AGENT-REGISTRY.md` §二 的 C0–C7 表（含三处勘误：C0 两步、C2=409、C6 取代"字段对齐"）
- **审查者**：code-reviewer（§26.15 只发现问题 + 报告 + 给修复建议）
- **方式**：**只读静态审查**；以 `git diff` 与本轮改动文件的**当前内容**为准；未进容器、未跑 `mvn` / `npm`——所有运行期结论标注"需 qa 提供"
- **产出**：本文件（本轮唯一写入）

---

## 0. Verdict

**verdict = `conditional`**

**可否进入最终验收：可以进入 D 阶段闸门，但"可验收"要先解决 1 个 Blocker。**

| 项 | 结论 |
|---|---|
| C0（两步） | ✅ **已落实**（白名单已删两条 + `AuthzRules` 已加 `/checkout/** → USER`；闸门测试白名单已同步） |
| C1 / C2 / C3 / C5 / C6 / C7 | ✅ **已落实**（逐条见 §2） |
| C4（金额只有一处权威来源） | ⚠️ **部分落实**：券那条链已收口（`promoDiscount` 确已零算术用途），**但前端仍自算"应付总额"**——且该自算把积分减了进去，而后端完全不认积分 ⇒ 用到积分时"页面显示额 < 实际扣款"。见 **BLK-E1** |
| 前端闸门（G2）与后端闸门（G1） | ❓ 未见运行结果 —— 需 qa 提供（§5） |

**Blocker：1 个（BLK-E1）。** 其余为 4 个 Major、6 个 Minor；**均不需要回退本轮任何一处修复**。

> 本轮修复的**方向与质量明显高于上一轮**：C0 的两步同时落地并配了双锚点测试、4 个写端点的 501 都做了"零副作用 + 鉴权优先"的断言、`/account/notifications` 只改校验没有误降级、文档反向漂移大部分被清除。BLK-E1 是**上一轮 BLK-4 同一类缺陷的最后一个存活实例**，且它之所以能存活，是因为 `05-FRONTEND-FIX.md` 的 C4 论证用了一个与代码相反的前提（§3 BLK-E1 证据 6）。

---

## 1. 审查范围与方法

| 类别 | 本轮涉及 |
|---|---|
| 后端 | `config/SpringMvcConfig`、`config/AuthzRules`、`controller/{StorefrontCheckout,StorefrontAccount,StorefrontAddress,AdminApi,MerchantApi}`、`dto/{CheckoutSummaryDTO,NotificationPrefsDTO,StorefrontCheckoutDTO}`、`service/{CouponService}`、`service/impl/CouponServiceImpl` |
| 前端 | `api/modules/{checkout,payment}`、`composables/{usePaymentFlow,useOrderSummary,usePromoCode,useCartSummary*,useWriteEndpointAvailability*}`、`pages/{Checkout,Cart}`、`pages/admin/Settings`、`pages/merchant/{Settings,Wallet}`、`router/index`、4 份 `*.spec.ts` |
| 测试 | `RequestShapeTest`、`StorefrontPromoTest`、`AuthzRulesTest`（改）+ `CheckoutMoneyConsistencyTest`、`NotImplementedEndpointsTest`、`AccountNotificationContractTest`（新） |
| 定位文件 | `04-BACKEND-FIX.md`、`05-FRONTEND-FIX.md`、`06a-TEST-SYNC.md`（用于交叉核对"声称"与"实际"） |
| **不重审** | TASK-001 的旧改动（Analytics 系列、pricing 系列、migrations、docker/CI 等）—— 仅在它影响本轮判断时引用 |

---

## 2. 逐契约落实核对表（核的是代码，不是文档的声称）

### C0 —— 两步缺一不可 ✅

| 步骤 | 证据 | 结论 |
|---|---|---|
| ① 移出白名单 | `SpringMvcConfig.java:20-39`：`excludePathPatterns` 中**已无** `/checkout/summary`、`/checkout/promo`，并留了 `:30-35` 说明"白名单是全有或全无，没有可选鉴权这一档" | ✅ |
| ② 登记角色 | `AuthzRules.java:73-81`：`new Rule("/checkout/**", Set.of(USER))`，且注释解释了"只做一步会换成另一种死法" | ✅ |
| 闸门测试同步 | `AuthzRegistrationGateTest.java:68-83`：白名单已移除两条，并注明"若有人加回来，`whitelistAndAuthzRulesDoNotOverlap` 会立刻报冲突" | ✅ |
| 单元级锚点 | `AuthzRulesTest.java:87-92`（USER 放行 `/checkout/summary`、`/checkout/promo`）、`:137-142`（SHOP/ADMIN **被拒**） | ✅ |
| HTTP 级锚点 | `CheckoutMoneyConsistencyTest.anonymousSummaryIsRejected:153-161`（匿名 401）、`StorefrontPromoTest` 的匿名 401 例（`:135-140`） | ✅ |

> **注**：`AuthzRules.isCovered` 方向性由 `AuthzRulesTest:55-58` 的既有断言（`/admin/**` 不命中 `/admin-accounts`）间接保证；本次新增规则**未**改动 `isCovered`，故 §七 第 6 步的更正结论仍然成立。

### C1 —— `/checkout/summary` ✅

| 契约 | 代码 | 测试 |
|---|---|---|
| 无 `code` → 200 且 `discount=0` | `StorefrontCheckoutController.java:110-117`（仅当 `code` 非 blank 才调 `applyByCode`） | `CheckoutMoneyConsistencyTest:144-151` |
| 有 `code` 未领券 → 400「您未领取该优惠券」 | `CouponServiceImpl.java:126` | `CheckoutMoneyConsistencyTest:132-142`（**逐字断言 msg**） |
| 已用 → 400「该优惠券已使用」 | `CouponServiceImpl.java:129` | `CheckoutMoneyConsistencyTest:123-129`（同一张券第二次下单） |
| 正常 → 200 带真实减免 | `:112-117`，且 `:119-121` 做 `discount ≤ subtotal` 封顶 | `CheckoutMoneyConsistencyTest:99-105`（198 → 19.80） |
| `shipping`/`tax` 可选、已移出契约 | `OrderSummary` 标 `?`（`checkout.ts:14-16`）；`prePointsTotal` 里没有它们（`useOrderSummary.ts:92-94`） | `checkout.spec.ts:121-124`（`not.toHaveProperty('shipping'/'tax')`） |

### C2 —— `/checkout/promo`：409 保留、无硬编码兜底 ✅

| 契约 | 代码 | 测试 |
|---|---|---|
| 必须登录 → 匿名 401 | 白名单已移除 ⇒ 拦截器 `LoginInterceptor.java:61` 抛 401 | `StorefrontPromoTest:135-140` |
| 必须已领券 → 未领 400 | `CouponServiceImpl.java:122-127` | `StorefrontPromoTest:145-153` |
| 无效/过期/停用 → 400 | `CouponServiceImpl.java:118-120`（`selectByCode` 带 `status='enabled'` 与 `expires_at`） | `StorefrontPromoTest:169-193`、`:221-227` |
| **未达门槛 → 409**（勘误后口径） | `CouponServiceImpl.java:131-134` 用 `new CustomException("未达到优惠券使用门槛")`，而 `CustomException(String)` 的默认状态在 `CustomException.java` 里是 `HttpStatus.CONFLICT` ⇒ **409** | `StorefrontPromoTest:196-202` `.isConflict()` ✅ 与代码一致 |
| 无 `SAVE10`/`VIP15` 兜底 | `StorefrontCheckoutController.java:148-157` 已无回退分支 | `StorefrontPromoTest:209-217`（`SAVE10 → 400`） |
| 只读不核销 | `/promo` 只调 `applyByCode`，`redeem` 只在 `/payments/create` 链路（`ProductOrderServiceImpl.java:197`） | `CheckoutMoneyConsistencyTest:90-130` 用同一张券二次下单必须 400 |

### C3 —— `/payments/create` 带 `code` 核销；前端 `price`/`amount` 一律忽略 ✅

| 契约 | 证据 |
|---|---|
| 前端发 `code` | `usePaymentFlow.ts:140-142`（payload 带 `code: discountCode.value`）；`payment.ts:17-24`（`PaymentCreatePayload.code?`）；`Checkout.vue:169-171`（单一来源 `paymentDiscountCode`） |
| 两处同一个码 | `Checkout.vue:160`（`getCode: () => paymentDiscountCode.value`）与 `:363`（`discountCode: paymentDiscountCode`）**同一个 computed** |
| 客户端金额被忽略 | 后端 `StorefrontCheckoutDTO` **没有** `amount` 字段（只有 `code`/`items`/`shipping`/`channel`/`cartItemIds`）⇒ 根本不绑定；`CheckoutMoneyConsistencyTest:167-194` 断言"塞 `price/amount` 一律无效" |

### C4 —— ⚠️ **部分落实**（见 BLK-E1）

| 子项 | 结论 |
|---|---|
| 券减免只有一个来源 | ✅ `useOrderSummary.ts:72` `tieredDiscount = summary.discount`；`:92-94` 不再减 `promoDiscount`；模板只渲染一行（`Checkout.vue:1005-1008`） |
| `promoDiscount` 是否真的零算术用途 | ✅ **已核**：`grep -n promoDiscount web/src` 的 21 处命中里，页面侧**全是注释**（`Checkout.vue:145/262/1004`），其余在 `usePromoCode` 内部、`useOrderSummary` 的返回值、以及 `*.spec.ts` 的断言里 —— **没有任何页面/算术路径消费它** |
| 后端四方一致（无券 / 用券） | ✅ `CheckoutMoneyConsistencyTest:70-85`、`:89-130`（先 confirm，再比 `payment.amount` 与 `Σ product_order.total_money`：`:226-243`） |
| **前端"应付总额"是否只有一处权威来源** | ❌ **否**。服务端的 `summary.total` 在 `web/src` 里**零消费者**（`grep` 只命中注释 `useOrderSummary.ts:46`）；两个页面都在客户端重算：`useOrderSummary.ts:121`（含积分）、`useCartSummary.ts:55` |

### C5 —— 4 个写端点真 501 且不写库 ✅

| 端点 | 501 抛出点 | 是否触碰 DB |
|---|---|---|
| `PUT /admin/settings` | `AdminApiController.java:459-463`（方法体只有 `throw`，连 body 都不收） | ❌ 无 |
| `PUT /merchant/settings` | `MerchantApiController.java:314-318` | ❌ 无 |
| `POST /merchant/wallet/withdraw` | `MerchantApiController.java:282-286` | ❌ 无 |
| `PUT /addresses/{id}/default` | `StorefrontAddressController.java:69-76`：**先 `AccessGuard.checkOwner` 再抛 501**（`:71-73`），注释写明"归属不属于调用方的地址不该与'这是你的地址但功能没做'得到同一个回答" | ❌ 无 |

**零副作用不是推测，是被断言的**：`NotImplementedEndpointsTest` 每条用例都做「调用前 GET → 调用 → 调用后 GET，逐字比较」：
- `:43-56`（admin settings，`assertEquals(before, after)` 逐字）
- `:62-75`（merchant settings）
- `:81-98`（wallet 余额 **与流水** 两处都比）
- `:104-115`（地址列表）
- `:121-135`（鉴权优先：4 个端点匿名一律 401，跨角色 403 —— "501 不得盖过鉴权"）

前端侧配套（不是把按钮钉死，而是"本环境是否有实现"）：`useWriteEndpointAvailability.ts:22` + `admin/Settings.vue:27/41/155`（禁用 + 提示条 + 二次拦截）、`merchant/Settings.vue:19/32/597`、`merchant/Wallet.vue:19/33/404/830`；错误文案走 `toErrorMessage(e, …)` 以保留后端 501 的具体原因。

### C6 —— `/account/notifications`：真缺陷是缺校验，**不是** 501 ✅（附 1 个 Major）

| 契约 | 代码 | 测试 |
|---|---|---|
| 字段名保持 `emailOrder`/`emailPromo`/`smsOrder` | `StorefrontAccountController.java:68-70`（GET）、`:103-105`（POST）；`NotificationPrefsDTO` 三字段同名 | `AccountNotificationContractTest:71-99`（写后 GET 真变化，证明**不是 501**） |
| 三个偏好全缺 → 400 | `:95-98` | `:127-138`（空 body）、`:142-156`（**商家端形状 `{email,push,sms}` → 400**，即"错字段名不再被静默当成默认值写入"） |
| 部分缺失仍可用（C6 冻结口径） | `:103-105` 未给的按默认值 | `:159-167` ✅ 与契约一致 —— 但见 **MAJ-E3**（副作用：静默重置另两项） |
| 没有误改 501 | `:106` 正常 `upsert` 落库；`NotImplementedEndpointsTest` 类注释 `:30-35` 明确说明"**刻意不包含**它" | ✅ |

### C7 —— 「结算商品参数不合法」= 400 ✅（附 1 个 Major）

- 代码：`StorefrontCheckoutController.java:98-100` `HttpStatus.BAD_REQUEST`；`:90-92` 空 items 也 400；`:101-104` 商品不存在 → 404；类 javadoc `:73-80` 已把三档口径写清。
- 测试：`RequestShapeTest.java:75-81` 已改为 `.isBadRequest()` / `code=400` ✅。
- ⚠️ 但同一个文件的**类 javadoc `:29` 还写着「结算项不合法仍是 409」** → 见 **MAJ-E2**。

---

## 3. 根因级检查：`excludePathPatterns` 全表扫描（本轮最有价值的一项）

### 3.1 白名单逐条判定

判定问句：**该路径的控制器/服务链是否依赖"只有拦截器才会填充"的状态（`CurrentUserThreadLocal`）？**

| # | 白名单路径 | 入口与依赖链 | 是否依赖 ThreadLocal | 结论 |
|---|---|---|---|---|
| 1 | `/common/login` | `CommonController.java:59-68` → `getCommonService(loginDTO.getType())` → `login()`；`UserServiceImpl`/`ShopServiceImpl`/`AdminServiceImpl` 的 `login` 均只用 `username/password` | ❌ | **已核、安全** |
| 2 | `/common/register` | `CommonController.java:74-83`：先 `!"USER".equals(type) → 403`，再走 `UserServiceImpl.register`（`:181-199` 只写 `data`）。**双层**：`AdminServiceImpl.register:121-124` 虽有 ThreadLocal 读取，但只有 ADMIN 类型能到达它，而 Controller 已把非 USER 全挡 | ❌ | **已核、安全**（有双重保险） |
| 3 | `/common/sendResetCode` | `CommonController.java:119-127`：`data.type/tel` + `resetCodeStore` | ❌ | **已核、安全** |
| 4 | `/common/retrievePassword` | `CommonController.java:136-141`：`retrievePasswordDTO.getType()` | ❌ | **已核、安全** |
| 5 | `/products/**` | `StorefrontProductController` → `ProductServiceImpl.page:40-44`（**显式判空**："公开接口(如 /products)可能无登录用户,需判空"）、`recommended:139-143`（**显式判空**，无登录直接返回热门序）；`selectById/list/salesVolumeTop/salesVolumeTopByShopId` 不读 ThreadLocal | ❌ | **已核、安全**（两个判空**在 HEAD 就存在**，非本轮新增） |
| 6 | `/search/**` | `StorefrontSearchController` → 只经 `productService.page`（判空）+ `productTypeService.list` + `AnalyticsService`（该服务把 `userId` 作为**入参**，自身不读 ThreadLocal） | ❌ | **已核、安全** |
| 7 | `/merchants/**` | `StorefrontMerchantController` → `shopService.selectById`、`productService.page`（判空）、`productTypeService.list`、`AnalyticsService.shopPublicStats/salesVolumeTopByShopId` | ❌ | **已核、安全** |
| 8 | `/error` | Spring `BasicErrorController` | ❌ | **已核、安全** |

### 3.2 拦截器自身的两个 bypass（不在白名单里，但同样不填 ThreadLocal）

| bypass | 位置 | 判定 |
|---|---|---|
| **OPTIONS 全路径 `return true`** | `LoginInterceptor.java:37-39` | 注册的 handler 中没有 OPTIONS 端点（`HttpOptionsHandler` 只回 Allow，不触碰业务/用户态）⇒ **不存在"守卫永远无法满足"的问题**。属**既有**行为，非本轮引入；若将来给某路径加 OPTIONS 路由，须重新评估 |
| `GET /file/*.{jpg,jpeg,png,gif,webp,bmp}` 图片公开 | `LoginInterceptor.java:42-45` + `isPublicImage:99` | `FilesController.getFile` 不读 ThreadLocal；上传 `POST /file/upload` **不在**该分支（需登录） ⇒ **已核、安全** |

### 3.3 全表扫描结论

**白名单里没有第二个「同类隐患」。C0 揭示的那一类（"路径被排除 ⇒ 守卫永远无法满足"）在本次全表扫描中是——且仅是——`/checkout/*` 这一例。** 8 条白名单路径全部为纯公开读或匿名自助（登录/注册/找回），无一依赖登录态。

### 3.4 但有一条需记账的「近邻风险」（无现存缺陷）

`page()` 里**未判空**的 `CurrentUserThreadLocal.getCurrentUser().getType()` 有 4 处：

- `ProductOrderEvaluateServiceImpl.java:32`
- `ShippingAddressServiceImpl.java:26`
- `ShoppingCartServiceImpl.java:43`（及 `:62/:72/:88/:107`）
- `ProductOrderServiceImpl.java:64`（及 `:100/:155`）

它们目前**都只在受 `AuthzRules` 保护的路径上**（`/shoppingCart/*`、`/addresses/*`、`/orders/*`、以及管理端评论），拦截器必然已填充 ⇒ **现在安全**。但"把某条路径挪进白名单"这个动作（正是 C0 做的）会**立刻**把它们变成 NPE → 500，而**没有任何自动化闸门会报出来**。见 **MIN-E6** 的护栏建议。

---

## 4. 新发现问题（本轮引入或本轮应处理而未处理）

### 🔴 Blocker（1）

#### BLK-E1 前端「应付总额」仍是客户端自算，且自算里含积分 —— 用到积分时**页面显示额 < 实际扣款**（C4/G4 未达成）

**文件:行号（全链条）**

| 环节 | 位置 | 内容 |
|---|---|---|
| ① 客户端算出总额 | `web/src/composables/useOrderSummary.ts:92-94`、`:97`、`:121` | `prePointsTotal = amount(subtotal) - amount(discount)`；`pointsDiscount = Math.floor(pointsToUse / POINTS_PER_DOLLAR)`；`total = prePointsTotal - pointsDiscount` |
| ② 购物车同样自算 | `web/src/composables/useCartSummary.ts:44`、`:55` | `total = +(serverSubtotal - discount).toFixed(2)` |
| ③ 页面把 `total` 当应付展示 | `web/src/pages/Checkout.vue:1015` | `<span class="text-primary">${{ formatPrice(total) }}</span>`（行标签是 `cart.total`） |
| ④ 积分入口真的可用 | `Checkout.vue:1052-1094`（`v-if="pointsUsable"` 输入框 + "Use Max"），`:316-319`（下单后本地 `spendPoints`/`recordSpend`/`earnPoints`） | `pointsUsable = isAuthenticated && points ≥ 100`（`useOrderSummary.ts:104-106`）；积分由上一单本地累加（`stores/loyalty.ts` 的 `earnPoints`，`EARN_RATE = 1`） |
| ⑤ 但积分**从不发给后端** | `web/src/composables/usePaymentFlow.ts:135-153`（payload 只有 `items/amount/currency/code/channel/cartItemIds/shipping`）；`web/src/api/modules/payment.ts:7-27`（`PaymentCreatePayload` 无积分字段） | — |
| ⑥ 后端根本不认积分 | `grep -E "pointsUsed\|loyalty\|积分" src/main` → **0 命中**；`dto/StorefrontCheckoutDTO.java` 只有 `code`（`:27`）；`ProductOrderServiceImpl.createStorefrontOrder` 只调 `couponService.applyByCode` | 客户端 `amount` **连 DTO 字段都没有**，属装饰值 |
| ⑦ 服务端权威 `total` 无人消费 | `grep -n "summary\.total" web/src` → 仅 `useOrderSummary.ts:46` 的注释命中 | 权威字段被弃用 |
| ⑧ 反向证据（"后端按 amount 收"是错的） | `src/test/java/.../CheckoutMoneyConsistencyTest.java:167-194` | 用例名即断言：`serverRecalculatesPriceEvenIfClientSendsItsOwn` —— **"前端传的 amount 必须被忽略"** |
| ⑨ 该行为还被单测钉成"预期" | `web/src/composables/useOrderSummary.spec.ts:147-156` | `login(10_000)` → `pointsToUse = 5_000` → `expect(api.total.value).toBe(50) // 100 - 50` |
| ⑩ 覆盖缺口 | `CheckoutMoneyConsistencyTest` 只有「无券」`：70-85` 与「用券」`:89-130` 两条四方一致用例；**无积分场景** | `06a-TEST-SYNC.md` §10「未覆盖项」也未列此项 |

**影响（可复现的用户路径）**：登录买家下单一次（`Checkout.vue:319` 按 `paid` 本地返积分，$1 = 1 分）→ 第二单结算页出现积分输入框 → 输入 5000 分 → 页面「Total」$50 而实扣 $100（均以 100 元小计为例）。差额 = 积分抵扣额。且 `finalizeOrder` 用同一个偏低的 `total` 记账（`Checkout.vue:256/317-319`），误差会自我强化。**这正是 G4「同一次下单四处金额一致」要消灭的失效模式，只是通道从"券"换成了"积分"。**

**根因（也是它能存活的原因）**：`docs/TASK-002/05-FRONTEND-FIX.md:24` 的 C4 行写着 ——

> `total = summary.total − pointsDiscount`，积分是**前端**这一层且**后端 `create` 也按 `amount` 收**，故四方仍有同一基准

**这句话与代码和测试都相反**（后端不绑定、不读取 `amount`，且有一条测试专门断言它被忽略）。契约制定/实现双方都基于这个错误前提豁免了积分，于是上一轮 BLK-4 的同类缺陷在积分通道上原样保留。

**最小修复建议（frontend-fix，一处修完即同时满足 C4）**

让两个页面**消费服务端权威值**，而不是自己重算：

```ts
// useOrderSummary.ts
const prePointsTotal = computed(() => amount(summary.value.total))  // 不再 subtotal - discount
const total = computed(() => prePointsTotal.value)                  // 积分退出"应付"
```

```ts
// useCartSummary.ts
const total = computed(() => amount(summary.value.total))
```

配套（三选一，按代价从低到高）：
1. **推荐**：积分输入区本轮**整块下线**（`Checkout.vue:1052-1094` 加 `v-if="false"` 或删除，`pointsUsable` 置 false），并在 i18n/注释说明"积分抵扣待服务端支持后开放"。同步改 `useOrderSummary.spec.ts:147-169/173-238`（把"积分影响 total"的断言改为"积分不影响应付"或直接移除该 describe）。
2. 保留 UI 但只作展示（"可用 5000 分 ≈ $50，本轮不可抵扣"）——仍需 `total` 不参与积分。
3. 后端实现积分（新增字段 + 服务端校验/核销）——**属 D2 范围，不建议本轮做**。

**无论选哪种，必须同时**：
- 更正 `docs/TASK-002/05-FRONTEND-FIX.md:24` 的错误论证（否则下一轮还会有人据此豁免别的通道）；
- 在 `CheckoutMoneyConsistencyTest` 或 `06a` §10 显式记一条 known-gap；
- 若决定"顺延到下一轮"，则**G4 的验收口径必须显式限定为「不含积分场景」**，否则 G4 名不副实。

**归属**：frontend-fix（实现）+ Lead（裁决"修 / 顺延 + 收窄 G4"）

---

### 🟠 Major（4）

| ID | 文件:行号 | 证据 | 影响 | 修复建议 | 归属 |
|---|---|---|---|---|---|
| **MAJ-E1** | `docs/backend-api.md:318` | 写「`AuthzRules` 的 `/checkout/**` → **三角色**(**需登录**,匿名 401)」；而 `AuthzRules.java:81` 是 `Set.of(USER)`，且 `AuthzRulesTest.java:137-142` **专门断言** SHOP/ADMIN 被拒（"结算摘要不该对商家放行 —— 它按 token 里的 userId 算券折扣"） | 文档说"三角色"、代码只给 USER、测试断言另两个角色 403 —— **三方相反**。本轮目标之一就是消除反向漂移，此处是残留；照文档实现/评审会得出错误结论 | 改为「**仅 USER**（匿名 401、SHOP/ADMIN 403）」 | backend-fix |
| **MAJ-E2** | `src/test/java/com/project/platform/controller/RequestShapeTest.java:29` | 类 javadoc 仍写「原有校验与状态码不变:例如**结算项不合法仍是 409**、优惠码为空是 400」；而同文件 `:75-81` 已是 `.isBadRequest()`（C7 定为 400） | 注释与断言相反，是本轮最危险的一种残留：后来者"照注释改回去"会让 C7 反复失效，且 diff 里看不出来 | 把 `:29` 改成「结算项不合法 → **400**（C7 裁决）；优惠码为空 → 400」 | qa-acceptance |
| **MAJ-E3** | `src/main/java/com/project/platform/controller/StorefrontAccountController.java:103-105`（+ `AccountNotificationContractTest.java:159-167`） | `pref` 是**新建实体**（`:100`），未提交的字段一律按默认值填入（`true / false / true`）后 `upsert`（`:106`）。C6 冻结口径只覆盖"全缺 → 400"，并明确"未给的按默认值兜底"（`:85-87`） | **副作用**：用户只改一个开关（例如只提交 `emailPromo=true`）时，另两项会被**静默重置**为默认值 —— 若用户此前把 `emailOrder` 关过，它会被悄悄打开。前端整块提交所以线上难触发，但直接调 API（或用旧的局部提交客户端）会静默改写用户偏好，与"不要静默"的本轮原则相抵 | 二选一：① `upsert` 前先 `getByUserId` 读旧行，仅覆盖**非 null** 的字段（真正"只改一个开关"）；② 或维持现状但把 C6 的口径与副作用写进 `docs/backend-api.md:88`，让"未给 = 重置为默认"成为**显式**契约而非隐含行为 | backend-fix（+ Lead 确认口径） |
| **MAJ-E4** | `docs/TASK-002/05-FRONTEND-FIX.md:24` | C4 行以「后端 `create` 也按 `amount` 收」为由豁免积分；代码与测试相反（见 BLK-E1 证据 6/8） | 定位文档把错误前提**固化成结论**，直接造成了 BLK-E1 存活；也会误导 D 阶段验收（照它核对 C4 会得出"已达成"） | 更正该行：写明"客户端 `amount` 被后端忽略；积分未接入服务端 ⇒ 积分不得进入应付口径（见 BLK-E1）" | frontend-fix / Lead |

### 🟡 Minor（6）

| ID | 文件:行号 | 问题 | 建议 | 归属 |
|---|---|---|---|---|
| **MIN-E1** | `web/src/pages/Cart.vue:408` + `useCartSummary.ts:44-46` | 小计有**两条 fallback 链**：模板 `formatPrice(serverSubtotal \|\| summarySubtotal)` 与组合式内部 `serverLoaded ? serverSubtotal : localSubtotal`。两者语义重复，且 `useCartSummary.ts:55` 的 `total` 又不走 fallback ⇒ 三处判据不一致（当前结果正确，但改一处漏一处就会不一致） | 模板直接渲染 `formatPrice(summarySubtotal)`，把"服务端/本地镜像"的判据**只留在组合式一处** | frontend-fix |
| **MIN-E2** | `useCartSummary.ts:70` | `calculateOrderSummary(items.value, undefined, code)` 把 `zip` 传 `undefined`；而 `calculateOrderSummary` 的签名是 `(items, zip: string \| undefined, code)`，`useOrderSummary` 传的是 `getZip()`。同一个参数两种传法，语义靠注释（"购物车不参与运费"）承载 | 传 `''` 并在此处加一行注释说明"购物车不采集邮编，zip 与运费/税均不参与金额（契约已移除）"；或在签名上把 zip 收进 options 对象消除位置参数歧义 | frontend-fix |
| **MIN-E3** | `web/src/composables/useWriteEndpointAvailability.ts:22` | `isWriteImplemented = computed(() => RUNTIME_USE_MOCK.value)` —— 用"是否 mock 模式"代理"端点是否有实现"。真实后端 + `RUNTIME_USE_MOCK=true`（联调/演示常用）时 UI 会放行 → 用户点到 501 才报错。反之若将来后端实现了而 mock 仍开，又会误禁用 | 用**独立开关**表达（如 `VITE_WRITE_ENDPOINTS_IMPLEMENTED`）或让 mock 分支与真实分支各自返回该位；至少在该文件注释里写清"这是代理判据及其失效场景"（当前注释写了动机，未写失效场景） | frontend-fix |
| **MIN-E4** | `CheckoutMoneyConsistencyTest`（整体） | 覆盖缺口两处：① **积分场景**（= BLK-E1，本轮无法靠后端测试发现，因为后端不认积分）；② **"未生效的码被发下去"** 的负例（前端应只发**已生效**的码，`Checkout.vue:169-171` 已做到，但没有测试钉住"输入框改了但没点 Apply 时不得发新码"这一类回归） | ① 归 BLK-E1 的修复；② 在 `usePromoCode.spec.ts` / `useOrderSummary.spec.ts` 补"输入偏离 → 生效态作废 → 不发码"的断言（`usePromoCode.ts:63-70` 的 watch 已实现该不变式，`usePromoCode.spec.ts` 需覆盖） | qa-acceptance（②）/ frontend-fix（①） |
| **MIN-E5** | `web/src/composables/useOrderSummary.spec.ts:45` | `BASE_SUMMARY = { subtotal: 100, shipping: 10, tax: 5, discount: 0, total: 115 }` —— `total: 115` 是**旧口径**（含运费税）的产物，与服务端契约 `total = subtotal - discount` 不自洽。当前它只作"字段被忽略"的输入，无害，但会误导后来者以为服务端 `total` 含运费 | 改为 `total: 100`（并把"刻意让 shipping/tax 非零"的注释保留，两者不冲突） | frontend-fix |
| **MIN-E6** | `LoginInterceptor.java:74`（护栏建议）+ §3.4 的 4 处未判空 `page()` | C0 暴露的是一**类**模式，而目前只有"人肉 review"能发现它。`AuthzRegistrationGateTest` 已经能拿到全部 handler 路径，具备扩展条件 | 建议给闸门加第 3 条断言：**白名单路径不得对应到任何"未判空即解引用 `CurrentUserThreadLocal`"的 handler**（可用反射/静态扫描实现，或退化为把 §3.1 的表固化成本文 §3 的清单 + 在该测试类注释里写明"新增白名单路径时须逐条核对登录态依赖"）。**无现存缺陷，属防护** | qa-acceptance / architect |

---

## 5. 未验证项（需 qa-acceptance 在 D 阶段提供）

| # | 未验证项 | 需要的证据 | 关联 |
|---|---|---|---|
| U-1 | **G1 后端闸门**：`mvn -B clean test` 的 `run / failures / errors` 真实数字。`06a-TEST-SYNC.md:35` 预期 "约 186 run，failures=0、errors=0"（基线 171/11F/1E） | qa 的 `06-TEST-REPORT.md` 原始输出 | G1 |
| U-2 | **G2 前端闸门**：`npm test`（= `vue-tsc` 两个 project + `eslint` + `vitest`）；`npm run build-prod` 的 rc | 同上 | G2 |
| U-3 | **G3 券链路端到端**：登录 + 已领券 → `/checkout/promo` 200 且减免正确；匿名 401 | 真实 HTTP（**不能用 Playwright**，它注入 `RUNTIME_USE_MOCK=true` 打不到后端） | G3 |
| U-4 | **G4 金额一致**：`summary.total == payments/create.amount == payment.amount == Σ product_order.total_money`。⚠️ **必须明确是否含积分场景** —— 若含，BLK-E1 会让它失败；若不含，请在报告里写明口径 | 同上 | G4 / BLK-E1 |
| U-5 | `AuthzRegistrationGateTest` 的两条约束是否真的绿（`everyRegisteredEndpointIsEitherRegisteredOrPublic`、`whitelistAndAuthzRulesDoNotOverlap`）。**静态核过**：白名单 8 条无一被 `AuthzRules` 覆盖（`/merchants/**` 与规则 `/merchant/**` 按路径段不误命中），但**必须实跑确认** | `mvn test` 输出 | C0 |
| U-6 | 本轮新增 3 个测试类的**真实**通过数（`CheckoutMoneyConsistencyTest` 5 / `NotImplementedEndpointsTest` 5 / `AccountNotificationContractTest` 5，`06a` 预期 15 条 + `StorefrontPromoTest` 重写后的条数） | 同上 | C1–C7 |
| U-7 | 运行中后端 JVM 是否已重启到含本轮改动的 class（`docs/DEVELOPMENT.md §9.2` 的"陈旧 class 伪装成服务正常"陷阱） | env-verifier / qa：干净编译 + 重启 + 真实 HTTP 探活 | 全部 |
| U-8 | 浏览器首帧是否仍闪 "$0.00"（`Checkout.vue:955-964` 已有 `v-if="isLoadingRef"` 骨架；`useOrderSummary` 也传了 `initialLoading: true`。**静态判断不会闪**，但需一次真实页面确认） | qa 手工/e2e | 复核项 |
| U-9 | 本轮**未**触碰 `sql/migrations`、未应用迁移 —— 与 `00-AGENT-REGISTRY.md §六` 一致（本轮不做）。确认 D 阶段也没有顺手应用 | 环境事实核对 | §六 |

---

## 6. 对 D 阶段与终验的建议

1. **BLK-E1 必须先有裁决再进终验**：要么修（推荐 §4 的最小修复，改动量约 10 行 + 一份 spec），要么由 Lead 显式把 G4 收窄为"不含积分场景"并在 `REPORT.md` 写明。**不接受"不提就默认达成"**——`05-FRONTEND-FIX.md:24` 的错误论证正是这样产生的。
2. MAJ-E1/E2/E4 是**纯文档/注释**修正（3 处），可与 BLK-E1 同批完成，不必单独开任务。
3. MAJ-E3（通知偏好部分提交静默重置）建议 Lead 明确"维持现状 + 写进契约"或"改为 merge 语义"其中之一，避免留成无人认领的隐式行为。
4. MIN-E6 的护栏建议值得排入下一轮：C0 这类缺陷的**复发成本**远高于加一条断言的成本。
5. 本轮**不需要回退任何修复**：C0 两步、501 诚实降级、notice 参数校验、`code` 贯通、购物车匿名不取数与三态、`/checkout` 的 `requiresAuth` —— 全部经静态核对与契约一致，且都有测试锚点。

---

## 7. 审查者边界声明

- 本次**只写** `docs/TASK-002/07-CODE-REVIEW.md`；**未修改**任何业务代码、测试、SQL、配置。
- **未进容器**（qa 在 D 阶段独占容器锁），**未运行** `mvn` / `npm`。凡"是否会红"的结论均标注为**静态推演**并给出双侧证据（代码行 + 断言行），最终以 U-1/U-2/U-5/U-6 的实跑结果为准。
- 已按 §26.15 只做"发现问题 + 报告 + 修复建议"，修复归属已逐条给出，未代改。
- 已按要求做的三项专项核查及结论：**根因全表扫描**（§3，结论：白名单内无第二例同类隐患，8 条逐条列明"已核、安全"）；**C4 单一来源**（§2，结论：券已收口、`promoDiscount` 确认零算术用途，但应付额仍为客户端自算 ⇒ BLK-E1）；**C5 真 501 不写库**（§2，结论：4 处纯 `throw` + 5 条零副作用断言）；**闸门不重叠**（§2 C0，结论：静态成立，待 U-5 实跑）。

---
---

# 第二轮：BLK-E1 复审（TASK-002-I）

> 本轮对象＝修复 delta：task-14（G1 前端：BLK-E1）/ task-15（G2 后端+docs）/ task-19（G1c 购物车）。
> 上文 §0–§7 为第一轮原文，**保留不动**；本轮结论只覆盖 delta 与它引出的新发现。
> 方式同上：**只读静态审查**，未进容器、未跑 `mvn`/`npm`。凡运行期结论标注"需 qa 提供"。

## R2.0 Verdict

**verdict = `conditional`**

| 问题 | 结论 |
|---|---|
| **BLK-E1 是否真闭环**（客户端自算应付额这一**缺陷类**） | ✅ **是，闭环**。两处应付额（结算页 / 购物车）都只消费服务端 `summary.total`；积分**彻底退出**应付口径（API 面 + UI 面 + store 面）；第二个资损面（`spendPoints`）已删；两处各有一条**同构判别用例**，且夹具按生产接线 —— 不是靠巧合通过 |
| **第三处「客户端自算应付额」路径** | ✅ **不存在**（确定结论，见 R2.3）。全仓扫描后"应付额/实扣额"只有 2 处，均为服务端值；但**"客户端自算金额"这一更宽的类**还有 5 处，已逐条分类 |
| **修复是否可进最终验收** | ⚠️ **conditional** —— 卡在 **1 个新发现的 Blocker（BLK-I1，存量缺陷、不在 delta 内）**：`Checkout.vue` 在结算页内加购后**不重取摘要**，于是"页面显示 Total ≠ 实际扣款"。它与 BLK-4/BLK-E1 **症状相同、机制不同**（前者是"客户端算式"，本条是"服务端值过期"）。**Lead 已裁决：修，不收窄 G4**（见 R2.2 BLK-I1 末尾），故 verdict 保持 `conditional` 直至该修复落地并按 G-5 复核通过 |

**Blocker：1（BLK-I1）。Major：0。Minor：4（含 1 条由第一轮 MAJ-E4 降级）。** 无任何需要回退的修复。

> ⚠️ **运行期证据当前不可得**：Docker Desktop 已停止运行、容器与前后端全部下线，因此 R2.5 的 V-1…V-6 **一项都未取得**，全部如实保留为"需 qa 提供"，未按已验处理。本轮 verdict 建立在静态审查 + 代码/测试原文证据之上。

## R2.1 BLK-E1 闭环核对（逐条，带行号）

| # | 验收问句 | 证据 | 结论 |
|---|---|---|---|
| 1 | `useOrderSummary.total` 是否**真的**消费服务端值 | `web/src/composables/useOrderSummary.ts:84` `const total = computed(() => amount(summary.value.total))`；`:80-83` 注释明写"**刻意没有**任何 fallback 算式：连 `subtotal − discount` 这种'看起来一样'的兜底都不写" | ✅ |
| 2 | 是否"换了一种自算" | `grep amount(summary` 只两处命中，均为 `summary.value.total`；`prePointsTotal` **已不存在**（`grep` 仅剩 `useOrderSummary.spec.ts:225` 的"断言其不存在"用例与注释） | ✅ 不是换皮 |
| 3 | 积分是否退出应付口径 | 返回对象仅剩 `summary/isLoading/error/fetchSummary/promoCode/promoApplied/promoDiscount/tieredDiscount/appliedDiscountCode/total/applyPromo/removePromo`（`:103-129`）；`pointsToUse`/`pointsDiscount`/`maxPointsToUse`/`pointsUsable`/`prePointsTotal` 全删；`useLoyaltyStore`/`POINTS_PER_DOLLAR`/`watch` 的 import 一并删除（`:1-10`） | ✅ |
| 4 | 是否有"接口级"钉子防复发 | `useOrderSummary.spec.ts:217-231`：`for (const key of [...]) expect(api, "…BLK-E1 复发").not.toHaveProperty(key)`，并断言 `total` 仍在 | ✅ 结构级护栏（不只看数值） |
| 5 | 支付 payload 与页面显示是否同源同值 | 同一个 computed 的两处消费：展示 `Checkout.vue:1015`；传参 `Checkout.vue:361` → `usePaymentFlow.ts:138` `amount: total.value` | ✅ 同源同值 |
| 6 | 判别用例是否**真能咬住**"重算接回来" | `useOrderSummary.spec.ts:128-140`：造 `subtotal:100, discount:15, total:99` ⇒ 断言 `api.total.value === 99`（重算会得 85 → 必红）。**且**夹具接线按生产：`:64-75`，`:73` `readCode = () => (api.promoApplied.value ? api.promoCode.value.trim() : '')` —— 正是第一轮 D-3"夹具没接线靠巧合通过"的正解（修夹具，不是改断言） | ✅ 咬得住 |
| 7 | 购物车侧是否有**同构**判别用例 | `web/src/composables/useCartSummary.spec.ts:56-75`：`subtotal:120, discount:30, total:99` ⇒ `total===99`（注释："不是 120 − 30 = 90"）、`subtotal===120` | ✅ 同构 |
| 8 | `useCartSummary` 是否被"改坏" | 按 Lead 裁决已**改**为服务端值：`useCartSummary.ts:64` `total = amount(summary.value.total)`；`:52-62` 注释记录了原式 `serverSubtotal − discount` 与"已复发两次故按根因消灭"的理由。**这不是改坏，是把第一轮的 MIN 级隐患按 Blocker 级标准消灭** | ✅ 符合裁决 |
| 9 | 是否残留"第二套小计判据" | `useCartSummary` 不再 export `serverSubtotal`（`:96-110`）；`Cart.vue:42` 只解构 `subtotal: summarySubtotal`，模板 `:412` `formatPrice(summarySubtotal)` —— 第一轮 MIN-E1 的"两条 fallback 链"已收敛为组合式内一条 | ✅ |
| 10 | **第二个资损面**（抵扣不生效却真扣余额） | `Checkout.vue:314-321`：`spendPoints` 已删（`:314` 注释说明原因），`paid = total.value`（`:319`）→ `recordSpend(paid)`/`earnPoints(paid)` —— 返积分与累计消费用的都是权威 `total` | ✅ 已闭环 |
| 11 | 积分 UI | `Checkout.vue:1052-1078`：抵扣输入/抵扣行整块下线，改为**只读余额 + `pointsNotRedeemable`**（`:1062` 条件 `points > 0`，`:1063` `data-testid="points-not-redeemable"`）；i18n key 已存在 `en.ts:336`（`pointsApplied`/`pointsHint` 保留未删，`:335` 注明理由） | ✅ |
| 12 | 单测是否"为绿灯恢复旧语义" | ❌ 没有。反向证据：`useOrderSummary.spec.ts:207-215`（余额 999 万也不改 total）、`:103-104`（旧断言 115 已改为服务端 100）、`useCartSummary.spec.ts:62-75`；`usePromoCode.spec.ts:166-184/207-226` 把 D-2（输入被吞）也补成正向断言 | ✅ |
| 13 | 4 条 Minor 是否处理 | MIN-E1 ✅（判据唯一化：`useCartSummary.ts:96-110` + `Cart.vue:410-412`）；MIN-E2 ✅（`useCartSummary.ts:79-81` zip 传 `''` 并注明"请求形状与结算页一致"）；MIN-E3 ✅（见 R2.2 末）；MIN-E5 ✅（`useOrderSummary.spec.ts:53` `total: 100` + `:49-51` 注释） | ✅ 4/4 |

### R2.1.1 task-15（后端 + docs）核对

| 项 | 现状 | 结论 |
|---|---|---|
| `backend-api.md` 的 `/checkout/**` 角色 | `docs/backend-api.md:318` 已改为「`/checkout/**` → **仅 USER(买家)**,需登录,**匿名 401**;SHOP/ADMIN 命中规则但角色不匹配 ⇒ **403**（`AuthzRulesTest.rolesCannotCrossDomains` 专门钉住）」 | ✅ 第一轮 MAJ-E1 已修，且修正粒度高（连 403 的成因都写对） |
| `StorefrontAccountController` 是否真 load-then-merge | `StorefrontAccountController.java:110-118`：先 `getByUserId` 读 `existing`（`:112`），未提交字段取 `existing.getXxx()`，**仅当 `existing == null`（库中无行）才回落默认值**；`:103-106` 的"三偏好全缺 → 400"**原样保留** | ✅ 第一轮 MAJ-E3 已修，且比我给的两个方案都更好 |
| 该修复是否有**判别用例**（易漏的一环） | `AccountNotificationContractTest.java:193-209`：新增 `loadThenMergeKeepsExistingValues` —— 先写满 `0/1/0`，再只提交一个字段，断言其余**保持** `0/0`（旧实现会给 `1/1` 而红）。`:158-176` 的旧用例被**收窄到"首次提交（库中无行）"分支**并注明"有行时的部分提交不是这个语义" | ✅ 正确做法：新增判别用例而非弱化旧断言 |
| `STARTUP.md` 措辞 | `docs/STARTUP.md:262` 已改为「新增迁移（**`V6`…`V11`**，以及将来的 V12+）需手工执行」；`:80`/`:212` 为 `V1…V11` | ✅ 第一轮 MAJ 项已修 |
| `04-BACKEND-FIX.md` 未决 #1 | `:208` 标题已改为「**已决 #1**（原「未决 #1」）：维持 409，不改码也不改测试」，`:209-224` 附裁决依据与"实现 409 + 测试 409 + 文档 409 三方一致"的结清声明；`:16`/`:105`/`:139`/`:248` 相关表述同步 | ✅ 已结清 |

## R2.2 新发现问题

### 🔴 Blocker（1）

#### BLK-I1 —— 结算页内加购后**不重取摘要**，于是「页面显示 Total ≠ 实际扣款」（症状同 BLK-4/BLK-E1，机制不同：服务端值过期）

> **性质声明**：**存量缺陷，不是本轮修复引入的**，也不在本轮 delta 范围内。之所以仍判 Blocker，是因为 Lead 明确"不收窄 G4"，而 G4 的字面目标是"同一次下单四处金额一致"—— 本条是**目前唯一还能让该目标不成立的可达路径**。

**可达路径（逐步，全部带行号）**

| 步 | 位置 | 事实 |
|---|---|---|
| ① 结算页的 items 就是购物车 | `Checkout.vue:52-57` | `checkoutItems = cartStore.items`（或 `direct` 模式的 `directBuyItem`） |
| ② 页面能改 items：Complete the Look 加购 | `Checkout.vue:851` `@add="addCompleteTheLook"` → `useCompleteTheLook.ts:65-72` `addSelected()` → `cartStore.addItem(p, …)` | 加购落在**同一个** `cartStore.items` 上 |
| ③ 但摘要**不会**随之重取 | `fetchSummary` 的调用点只有：`Checkout.vue:176`（`onMounted`）、`:183`（`watch(formData.zip)`）、coupon 的 `onApplied`（经 `useOrderSummary.ts:60`）、`:996`（ErrorState 重试） | `checkoutItems` 变化**不在其中** |
| ④ 唯一监听 `checkoutItems` 的 watcher 只做重定向 | `Checkout.vue:378-382` | `if (items.length === 0 && !isProcessing && !isCompletingOrder) router.replace('/cart')` —— **不重取** |
| ⑤ 后果 | 显示 `Checkout.vue:1015` `formatPrice(total)`；payload `usePaymentFlow.ts:137-138` `items: …map(...)` + `amount: total.value` | **items 已变、total 仍旧**。后端按 items 重算（`ProductOrderServiceImpl` 逐行 `DB价 × 数量`）⇒ **实扣 > 显示额** |
| ⑥ 现有 e2e 测不到 | `web/tests/e2e-functional.spec.ts:615-653` | 该用例只断言 **localStorage 里购物车条目数** `after === before + shownCount`（`:645-652`），**从未断言 Total 变化** |

**影响**：用户在 Review 步点 "Add to Order (N)"（按钮上写着加购件数）→ 页面 Total **不变** → 直接下单 → 被按含新件的全额扣款。金额上不是"凭空多扣"（用户确实点了加购），但**页面显示的应付额与实际扣款不一致**，正是 G4 要消灭的形态；用户也无法从 Total 上确认加了多少钱。

**最小修复（二选一，均约 2–4 行）**
1. **推荐**：在 `Checkout.vue` 加一个重取 watcher，复用已有标记做守卫（与 `:378-382` 同形）：
   ```ts
   watch(checkoutItems, (items) => {
     if (items.length === 0 || isCompletingOrder.value) return
     fetchSummary()
   })
   ```
   注意与 `:378-382` 的重定向 watcher 合并或保持先后关系清晰（空列表时不重取）。
2. 或让 `addSelected()` 成功后由页面显式 `await fetchSummary()`（调用点只有一处，更直白），并**补一条 e2e**：加购后 `Total` 必须反映新 items。

**归属**：frontend-fix（实现）+ qa-acceptance（补 e2e/真实 HTTP：G4 必须覆盖"加购后下单"这一动作序列）
**Lead 裁决（TASK-002-I，2026-10-02）：修，且不收窄 G4。** 理由与本类前两次复发一致 —— BLK-I1 同属"页面显示额 ≠ 实际扣款"，本轮的做法是按根因消灭这一类，而不是第三次用"收窄口径"记成 known-gap。已派 frontend-fix 实施上文方案 1（加购伴随摘要重取）。

**BLK-I1 的复核方式（本报告判 conditional 的解除条件，即 G-5）**：修复落地后由 qa 断言 —— ① 结算页点 "Add to Order" 后 **`Total` 必须变化**，且等于服务端对新 items 的回包值；② 该动作序列下的真实 HTTP **G4** 四方一致（`summary.total == payments/create.amount == payment.amount == Σ total_money`）；③ 空列表/支付完成跳转时**不得**因新增的 watcher 触发多余重取或覆盖重定向。三条都过，本条可判闭环。

### 🟡 Minor（4）

| ID | 位置 | 证据 | 影响 | 建议 | 归属 |
|---|---|---|---|---|---|
| **MIN-I1** | `web/src/pages/admin/Merchants.vue:232-234` | 抽屉里 `Platform Fee (5%)` = `(selectedMerchant.revenue * 0.05).toLocaleString()` —— **客户端硬编码 5%** 乘服务端 revenue。而服务端**有**这个率：`admin_setting.commission_rate`（V7）/ `admin/Settings.vue` 的 `commissionRate` 表单 | 平台费率一旦非 5%，管理端会**静默显示错误的佣金金额**，且标签字面写死 "(5%)"。**属性**：这是"客户端持有一条服务端拥有的金额规则"——与 BLK-4（券规则）/BLK-E1（积分规则）**同形**，只是无资损（不是应付额）。这正是 Lead 问的"管理端金额"那一类的确切答案 | 从设置接口读 `commissionRate`（mock 分支给同值），或至少把标签改成 "(≈5%, estimate)"；理想是把派生金额也交给服务端 | frontend-fix |
| **MIN-I2** | `web/src/pages/Cart.vue:62` vs `web/src/composables/useOrderSummary.ts:57` | 同一个 `POST /checkout/promo` 预览：购物车传**客户端小计** `cartStore.subtotal`，结算页传**服务端** `summary.value.subtotal`。两页对同一端点给不同来源的 subtotal | 预览值不由服务端权威（`applyByCode(code, subtotal, userId)` 用它算折扣与门槛）。**无资损**：`/promo` 只读不核销，真实扣款走 `/payments/create` 的服务端 `gross`；但本地小计过期时 toast 会宣称一个拿不到的减免 | 结构性：把 `/checkout/promo` 入参从 `{code, subtotal}` 改为 `{code, items}`（与 summary/create 同源）；过渡：`Cart.vue` 改传收敛后的服务端小计 | frontend-fix / backend-fix（契约） |
| **MIN-I3** | `docs/TASK-002/05-FRONTEND-FIX.md:24` | 该行仍是「`total = summary.total − pointsDiscount`…**后端 `create` 也按 `amount` 收**，故四方仍有同一基准」——与代码/测试相反（第一轮 MAJ-E4）。同一文件 §13/§17（`:410-412`、`:454`、`:604-605`、`:560`）已正确记载修复与新口径 | 历史表格行与会话末尾结论**自相矛盾**；后来者若只读 §二 的契约表，会照着"后端按 amount 收"再豁免别的通道 | 把 `:24` 的"理由"列改为指向 §17（或标注"该行已于 G1 作废，见 §17"） | frontend-fix |
| **MIN-I4** | `useOrderSummary.ts:84` / `useCartSummary.ts:64` + `05-FRONTEND-FIX.md:466`、`:622` | `summary.total` 缺失/NaN 时 `amount()` 折成 0 ⇒ 页面显示 **$0.00**（该选择已在文档里如实记录为"接受现状"）。契约里该字段必填、后端无条件返回（`StorefrontCheckoutController:107-113`），故当前**不可达** | 一旦后端回归（或契约漂移）就会把"接口坏了"显示成"应付 0 元"，而 0 元是最危险的一种误显示 | 若 `result.ok === true` 而 `summary.total` 非有限数，视为**契约违约**：走 `error` 分支（ErrorState + 重试）而不是静默显示 0。属加固，非当前缺陷 | frontend-fix |

> **MIN-E3 的处置说明（不算新问题）**：`useWriteEndpointAvailability.ts` 已把"用 mock 模式代理端点可用性"作为**已知偏差**显式记录（注释列出两种失效场景与"以后应以端点能力为准/探测一次 501"的正确做法），并导出 `hitsRealBackend`；三个页面在 `handleSave`/`handleWithdraw` 内**保留了二次守卫**（即使判据分叉也不会静默"成功"）。属可接受的收口，无需再改。
> 第一轮的 **MAJ-E4 在本轮降级为 MIN-I3**（原因：同一文档 §13/§17 已给出正确结论，代码与两份 spec 也都正确；剩余风险只是"历史表格行"的可读性）。

## R2.3 根因级追问：还有没有第三处「客户端自算应付额」？

**结论（确定）：应付额/实扣额 —— 没有第三处。** 全仓只有 2 个"应付额"产出点，且都已只消费服务端字段：

| 应付额产出点 | 现状 | 判别用例 |
|---|---|---|
| `web/src/composables/useOrderSummary.ts:84`（结算页） | `amount(summary.value.total)` | `useOrderSummary.spec.ts:128-140`（99 vs 自算 85） |
| `web/src/composables/useCartSummary.ts:64`（购物车） | `amount(summary.value.total)` | `useCartSummary.spec.ts:62-75`（99 vs 自算 90） |

全仓**唯一**的扣款调用是 `POST /payments/create`（`api/modules/payment.ts:161`），其金额由后端按 items 重算（客户端 `amount` 未被 DTO 绑定）。因此"应付额由客户端自算"这一通道已无存活实例。

**但"客户端自算金额"这个更宽的类还有 5 处，逐条分类如下**（这是本轮扫描的完整答案）：

| # | 位置 | 是什么算 | 是否影响扣款 | 判定 |
|---|---|---|---|---|
| 1 | `admin/Merchants.vue:234` `revenue * 0.05` | 平台佣金（客户端常量 × 服务端值） | ❌ 否（只读展示） | **同形残留 → MIN-I1**（唯一值得改的一条） |
| 2 | `stores/cart.ts:58-59` `Σ price × quantity` | 小计（本地镜像） | ❌ 否（应付额已不取它；仅匿名展示 + `/promo` 预览入参 ⇒ MIN-I2） | 可接受（组合式内已有单一判据） |
| 3 | `api/modules/checkout.ts:85,98` + `coupons.ts:181-191` `computeCouponDiscount` | mock 分支的 `subtotal/total/discount` | ❌ 否（`if (USE_MOCK)` 内，生产不执行） | 可接受（`checkout.spec.ts:257` 钉住 mock 不变量） |
| 4 | `api/modules/orders.ts:124-127,149-230`、`pages/dashboard/Orders.vue:578-597` | 本地订单记录/种子的 `subtotal/shippingFee/discount` 展示字段 | ❌ 否（历史订单的**存储字段**，不是本次扣款） | 可接受（建议给本地订单记录加"非服务端权威"注释） |
| 5 | `stores/loyalty.ts:70-86` `earnPoints/recordSpend/spendPoints` | 积分 / 累计消费 / 等级账本（纯本地，无服务端对应物） | ❌ 否（已不参与 `total`；`spendPoints` 的调用点已删） | 可接受但需知情：这套数字仍是"客户端自说自话"（`Checkout.vue:1062-1073` 已标成"不可抵扣"，误导性已消除）。若要展示等级/累计消费，建议下一轮明确标注或接服务端 |
| 6 | `useCartSummary.ts:43` `localSubtotal`、各页面 `price × quantity` 行小计 | 行的展示小计 | ❌ 否 | 可接受（行小计本就该由条目价算） |

## R2.4 结构性护栏建议（可执行，建议排入下一轮）

BLK-4（券）与 BLK-E1（积分）是同一类的两次复发；**"再加一条用例"只能防已知形态**。按成本从低到高，建议至少落 G-1 + G-3 + G-4：

| # | 护栏 | 具体做法 | 成本/风险 |
|---|---|---|---|
| **G-1** | **类型级：应付额成为"不可自造"的类型** | 给应付额定义 branded type（如 `type ServerPayable = number & { __server: true }`），只有解析 `/checkout/summary` 回包的那一处能产出它；`usePaymentFlow` 的 `total`/`amount` 参数只接受该类型。任何 `subtotal - discount` 的 `number` 都**编译不过** | 低-中（集中在 2 个组合式 + 1 个类型）；最彻底 |
| **G-2** | **测试级：口径形状哨兵**（廉价兜底） | 新增 `web/src/__guards__/no-client-payable.spec.ts`：读 `web/src/**/*.{ts,vue}` 源码，命中 `/\bsubtotal\s*-\s*discount/`、`/-\s*pointsDiscount/`、`/\btotal\s*=\s*[^=]*-\s*(discount|points)/` 即失败，失败信息点名 BLK-4/BLK-E1。**必须排除**：`*.spec.ts`、`if (USE_MOCK)` 分支（`checkout.ts:98`）、注释行 —— **这是本方案的主要成本**：纯正则会误报，故要么维护 allowlist，要么改用 ESLint 自定义规则（可精确到 AST） | 低（1 个文件）± allowlist 维护 |
| **G-3** | **判别用例级：每个"新应付额入口"必须带同构反例** | 把已有两条钉子的**形状**写成规范：任何新页面若展示应付额，必须附一条"服务端 `total` 与前端可算出的值**刻意不等**"的用例（形状见 `useOrderSummary.spec.ts:128-140`）。写进 `web/CLAUDE.md` 的检查项 | 极低（文档 + review checklist） |
| **G-4** | **契约级：把"谁拥有金额规则"写成硬约定** | 在 `web/CLAUDE.md` / `docs/backend-api.md` 加一条：**① 应付额、实扣额只允许来自服务端字段；② 服务端拥有的金额规则（券、积分、佣金率、运费、税）不得在前端以常量或算式复制**。`admin/Merchants.vue:234` 的 5% 就是第 ② 条的第一个整改对象 | 极低 |
| **G-5** | **时效性护栏（针对 BLK-I1）** | 约定：**凡是会改变下单 items 的页面动作，必须伴随一次摘要重取**（或由服务端在 `/payments/create` 返回实收金额，前端与之核对）。配一条 e2e：加购后 `Total` 必须变化且等于服务端新值 | 低（含 BLK-I1 的修复） |
| **G-6** | **真实后端对账（长期）** | `/payments/create` 已返回 `amount`；前端在下单成功后用返回的 `amount` 与页面 `total` 断言相等，不等则上报 —— 把"显示额 == 实扣"从约定变成运行期自检 | 中（需后端配合/埋点） |

## R2.5 未验证项（需 qa-acceptance 在 TASK-002-H 提供）

> ⚠️ **当前状态：全部不可得。** Docker Desktop 已停止运行、容器与前后端下线，下表 V-1…V-6 **一项都没跑**；本报告不把它们记为已验。待容器恢复后由 qa 按序补齐；其中 **V-3 是解除 BLK-I1（verdict=conditional）的判据**。

| # | 项 | 为什么必须实跑 | 关联 |
|---|---|---|---|
| V-1 | `npm test`（= `vue-tsc` src + `vue-tsc -p tsconfig.test.json` + `eslint` + `vitest`） | 上一轮 D 报告 `06-TEST-REPORT.md:99/423` 记录过 `Cart.vue(28,7) TS6133: 'subtotal' is declared but its value is never read` 与 `vitest 2 failed / 209 passed`。**静态核对已确认三处根因都被改掉**（`Cart.vue` 不再声明本地 `subtotal`；`usePromoCode` watcher 不再吞输入；`useOrderSummary.spec` 夹具按生产接线），但必须由实跑确认 0 新增失败 | G2 |
| V-2 | `mvn -B clean test` | 本轮新增/改动了测试（`AccountNotificationContractTest` 的 load-then-merge 判别用例、`StorefrontPromoTest` 等）。基线：`06-TEST-REPORT.md:13` = 192 run / 0F / 0E（**该报告早于本轮 delta，需重跑**） | G1 |
| V-3 | 真实 HTTP 的 **G4**，且**必须覆盖"结算页加购后再下单"这一动作序列** | 这是 BLK-I1 的唯一运行期判据。只测"打开页面→下单"会漏掉它（现有 `CheckoutMoneyConsistencyTest` 是后端级，测不到前端时序） | G4 / BLK-I1 |
| V-4 | 真实 HTTP 的 G3（券 200 / 匿名 401） | 确认 delta 未回退 | G3 |
| V-5 | Playwright e2e 全量（尤其 `web/tests/e2e-functional.spec.ts:615-653` 加购用例、以及 qa 在 22:04 调整过的 3 条 Cart 断言） | 13 条 `product-reviews.spec.ts` 失败已被 qa 判定为"环境夹具 vs 真实库"，非本轮回归 —— 需在权威轮次确认该判定仍成立 | 回归 |
| V-6 | `pointsNotRedeemable` 提示在真实后端下的渲染（`Checkout.vue:1061-1078`） | i18n key 已存在（`en.ts:336`），静态无误；属可视确认 | 复核 |

## R2.6 本轮结论摘要（给 Lead 的一句话）

**BLK-E1 的"客户端自算应付额"这一缺陷类已按根因闭环**（两处应付额只取服务端值、积分彻底退出、第二资损面已删、两条同构判别用例就位且夹具按生产接线、后端/docs 侧三项全部落地）；**第三处应付额路径确认不存在**。唯一卡点是一个**存量、非本 delta 引入**的可达违例 —— **BLK-I1：结算页内加购不重取摘要**（2 行可修；或由 Lead 明确收窄 G4 后降级为 known-gap，verdict 随即转 pass）。
