# TASK-002-A 后端修复报告（C0–C6）

> 执行者：backend-fix ｜ 契约来源：`task-7` **revision 3**（Lead 冻结 + v2 修正）
> 写范围：`src/main/java/**`、`src/main/resources/**`、`docs/backend-api.md`、`docs/STARTUP.md`、`docs/TASK-002/04-*`
> 未触碰：`src/test/**`（qa 独占）、`web/**`（frontend 独占）、`sql/**`、`docker/**`
> **未执行任何 V6–V11 迁移**；容器只用了一次编译（无 `clean`、无 `test`）。

---

## 0. 结论速览

| 契约 | 内容 | 状态 |
|------|------|------|
| C0 | 鉴权两步：移出白名单 **+** `AuthzRules` 登记 `/checkout/** → USER` | ✅ 已落实，匿名 401 / 登录 200 |
| C1 | `summary`：无 code 200、未领/已用 400、正常 200 带真实减免 | ✅ 无需改码（逻辑本就是好的），入口已修活 |
| C2 | `promo`：必须登录、必须已领券、无硬编码兜底 | ✅ 已落实；门槛分支 **409 已由 Lead 裁决维持**（§6 未决 #1 → **已决**；G2 结清） |
| C3 | `payments/create`：忽略前端 price/amount，服务端按 DB 价重算 | ✅ 现状已正确，**未改动**（只补注释核对） |
| C4 | `summary.total == payments/create.amount == payment.amount == Σ total_money` | ✅ 现状成立（分配算法已有），**未改动** |
| C5 | 4 处未实现写端点 → 501 + 明确 msg | ✅ 已落实，qa 的 `NotImplementedEndpointsTest` 全绿口径 |
| C6 | `/account/notifications`：三偏好全缺 → 400 | ✅ 已落实（新契约；**不是** 501） |
| 文档反话 | backend-api.md / STARTUP.md / AdminApiController 注释 | ✅ 已修 |
| BLK-3 | 「结算商品参数不合法」定为 **400** | ✅ 保持 400，javadoc 同步 |

编译：`docker exec nexus-dev bash -lc 'cd /workspace && mvn -B -o -q compile'` → **exit 0**（详见 §5）。

> **G2（TASK-002-G2）**：Review Gate 的三条收口（MAJ-E1 文档三角色→仅 USER、MAJ-E3 通知偏好
> load-then-merge、STARTUP V4/V5 措辞）与「未决 #1 → 已决：维持 409」**均已完成**，见文末
> **「G2」** 一节。该轮按硬约束**未进容器**（编译复验由 qa 在闸门统一执行）。

---

## 1. C0 鉴权（两步缺一不可）

### 1.1 第 1 步：移出白名单
`src/main/java/com/project/platform/config/SpringMvcConfig.java:29-37`
- 删除 `excludePathPatterns` 里的 `"/checkout/summary"`、`"/checkout/promo"` 两行；
- 原位置留下注释说明「结算流程整体需登录」以及**白名单是全有或全无、没有可选鉴权这一档**，
  并指出角色登记在 `AuthzRules`。

### 1.2 第 2 步：在默认拒绝表里登记
`src/main/java/com/project/platform/config/AuthzRules.java:82`
```java
new Rule("/checkout/**", Set.of(USER)),
```
- 位置：买家域，`/returns/**`、`/stock-alerts/**` 之后，与 `/payments/**` 相邻（Lead 建议的落点）；
- 角色 **只给 USER**（与 qa 已同步的断言一致：`AuthzRulesTest:138-142` 断言 SHOP/ADMIN 对
  `/checkout/summary`、`/checkout/promo` 均被拒）；
- 类注释 `AuthzRules.java:21-24` 补上「移出一条路径后必须在下面登记，否则落进默认拒绝」——
  这正是本次两步制的原因，避免下一个人只做第 1 步。

### 1.3 目标语义核对
| 请求 | 结果 | 产生处 |
|------|------|--------|
| 匿名 `POST /checkout/summary` 或 `/checkout/promo` | **401** `{code:401,msg:"未登录或登录已过期"}` | `LoginInterceptor:57-62`（token 缺失）→ `GlobalExceptionHandler:28-34` |
| 有效 USER token | 进入控制器，`CurrentUserThreadLocal` 有值 → 券可校验 | `LoginInterceptor:69-75` + `AuthzRules.isAllowed` |
| SHOP / ADMIN token | **403** | `LoginInterceptor:71-73`（规则只放行 USER） |

### 1.4 例外条款的查证结论（**未采纳例外，按「移出白名单」做**）
契约允许「若确认 `/checkout/summary` 有未登录调用方则改可选鉴权」。已逐点查证，**当前不存在**：

- `web/src/api/modules/checkout.ts:64` 的 `calculateOrderSummary()` 是**唯一**调用方；
- 全项目引用链只有 `web/src/composables/useOrderSummary.ts:108`（`fetchSummary`）；
- 该 composable 只被结算流程消费（`Checkout.vue`），**购物车页 `Cart.vue` 目前尚未接入**
  （frontend 的 BLK-5 修复尚未落地）；
- `/checkout/promo` 的前端调用在优惠码输入框内（`usePromoCode.applyPromo`），同样在结算页。

⚠️ **给 frontend / Lead 的前瞻风险（不是本契约的偏离，是时序提示）**：
`web/src/router/index.ts:169-178` 的 `/cart`、`/checkout` **都没有** `meta.requiresAuth`。
一旦 frontend 按 BLK-5 把 `Cart.vue` 改成调 `/checkout/summary`，**匿名访客打购物车页会拿到 401**
（401 拦截器还会清 token 并跳登录）。可选处理：frontend 给 `/cart` 加 `requiresAuth`，
或购物车页只在 `authStore.isAuthenticated` 时调该端点。**本轮不改 `web/**`**，仅上报。

---

## 2. C1 / C2 结算两端点

### 2.1 C1 `/checkout/summary`
代码逻辑本身就是对的（只认 coupon 表、四项校验、封顶），**病因是入口**：白名单 ⇒ 拦截器不跑 ⇒
`currentUserId()` 恒 null ⇒ `CouponServiceImpl.applyByCode` 恒抛
「请先登录后再使用优惠码」。C0 修好后 C1 自动成立：

| 场景 | 期望 | 实现处 |
|------|------|--------|
| 无 `code` | 200，`discount=0`，`total=subtotal` | `StorefrontCheckoutController.java:110-119`（`discount` 只在 code 非空时算） |
| 有 `code`、未领券 | 400「您未领取该优惠券」 | `CouponServiceImpl.java:124-127` |
| 有 `code`、已使用 | 400「该优惠券已使用」 | `CouponServiceImpl.java:128-130` |
| 有 `code`、正常 | 200 带真实减免，`total=subtotal-discount` | `CouponServiceImpl.java:137-151` + 控制器封顶 `:118-122` |
| 响应字段 | `subtotal`/`discount`/`discountCode`/`total`；**无** `shipping`/`tax` | 控制器 `:124-129` |

同步的注释（非行为改动）：
- `StorefrontCheckoutController.java:55-59` 增补「本端点需登录」的鉴权说明；
- `StorefrontCheckoutController.java:163-172` 的 `currentUserId()` javadoc 从
  「这两个端点在白名单里，拿不到用户是常态」改为「已登记为需登录，保留 null 分支作兜底」。

### 2.2 C2 `/checkout/promo`
- 必须登录：C0 已保证（匿名 401）。
- 必须已领券：`CouponServiceImpl.applyByCode` 的归属校验（`user_coupon` 存在 + `unused`）。
- 未领 / 已用 / 过期·下架·不存在 → **400**，msg 可区分：
  「您未领取该优惠券」/「该优惠券已使用」/「优惠码无效」（过期与下架同为「优惠码无效」，
  因为 `CouponMapper.selectByCode` 的 WHERE 已过滤 `status='enabled'` 与 `expires_at > NOW()`）。
- **未恢复** SAVE10/VIP15 硬编码兜底（该分支本批已删除，本轮确认未回退）。
- 注释同步：`StorefrontCheckoutController.java:133-158`、`CouponService.java:42-53`、
  `CouponServiceImpl.java:111-116` 均已去掉「白名单/匿名可访问」的旧表述。
- ⚠️ **门槛分支仍是 409**，C2 字面的「→ 400」**不适用于门槛**（Lead 已裁决维持 409，见 §6「已决」与 G2）。

---

## 3. C3 / C4 金额一致性（**只核对，未改码**）

契约明确「现状正确，不得改坏」，故本轮**零改动**，只做了核对：

- C3：`ProductOrderServiceImpl.createStorefrontOrder` 逐 item 调 `doInsert(order)`，
  金额由 `doInsert` 按 DB `product.price` 重算；请求体的 `price`/`amount` 在
  `StorefrontCheckoutDTO.Item` 里**根本没有对应字段** ⇒ 结构上不可能被读到。
  带 `code` 时 `applyByCode` → `redeem`（条件 UPDATE 抢占）→ 减免计入 `amount`（`:189-204`）。
- C4：`amount = gross - discount`（`:204`），`applyDiscountToRows` 用最大余额法把折扣摊回各行，
  保证 `Σ(product_order.total_money) == amount`（`:222-239` 的算法说明与实现）；
  `payment.amount` 直接取该 `amount`（`:207-214`）。

qa 的 `CheckoutMoneyConsistencyTest`（含 `:154-156` 匿名 401 锚点）即是 C0/C3/C4 的回归网。

---

## 4. C5 诚实降级（4 处 → 501）+ C6 参数校验

### 4.1 状态码变更清单（**qa 需要知道的全部改动**）

| # | 端点 | 改动前 | 改动后 | 文件:行 |
|---|------|--------|--------|---------|
| 1 | `PUT /admin/settings` | 200 假成功（body 被丢弃） | **501** | `AdminApiController.java:461-462` |
| 2 | `PUT /merchant/settings` | 200 假成功 | **501** | `MerchantApiController.java:316-317` |
| 3 | `POST /merchant/wallet/withdraw` | 200 假成功（提现请求被静默吞掉） | **501** | `MerchantApiController.java:284-285` |
| 4 | `PUT /addresses/{id}/default` | 200 假成功（纯 no-op） | **501** | `StorefrontAddressController.java:74-75` |
| 5 | `POST /account/notifications`（全缺字段） | 200 + 静默写默认值 | **400** | `StorefrontAccountController.java:95-98` |

**未变更（契约要求保持）**：
- `POST /checkout/summary`「结算商品参数不合法」= **400**（`StorefrontCheckoutController.java:99`）；
  「结算商品不能为空」= 400（`:91`）；「商品不存在或已下架」= **404**（`:103`）。
- `POST /checkout/promo` 门槛不达标 = **409**（未动；Lead 已裁决维持，见 §6「已决」）。
- 其余状态码一律未动。

### 4.2 统一形态（沿用既有信封，未引入新框架）
```java
throw new CustomException(HttpStatus.NOT_IMPLEMENTED, "<明确原因>");
```
经 `GlobalExceptionHandler.handleCustomException` 出 `{code:501, msg:"<原因>", data:"<原因>"}`，
HTTP 状态同为 501 —— 与项目既有 4xx 完全同一套机制（`ResponseVO.fail` 的双写约定）。

msg 一览（含「此前返回 200 是假成功」的说明，避免被当成临时故障）：
- 平台设置保存尚未实现：无 `admin_setting` 表可落库，本轮不写入（此前返回 200 是假成功）
- 店铺设置保存尚未实现：无 `merchant_setting` 表可落库，本轮不写入（此前返回 200 是假成功）
- 提现尚未实现：无钱包流水与提现表可落库，本轮不写入（此前返回 200 是假成功）
- 设为默认地址尚未实现：无 `is_default` 列可落库（需应用 V10 迁移），本轮不写入（此前返回 200 是假成功）

### 4.3 两处刻意的实现选择（请 Lead/qa 知悉）
1. **`PUT /addresses/{id}/default` 先做归属校验再抛 501**（`StorefrontAddressController.java:70-75`）。
   理由：他人地址与被删地址都不该与「这是你的地址但功能没做」得到同一个回答。
   已核对测试种子 `shipping_address(id=1, user_id=1)`（`src/test/resources/schema-h2.sql:241`），
   故 `NotImplementedEndpointsTest.addressSetDefaultIsNotImplemented`（userToken 打 `/addresses/1/default`）
   仍拿到 501，不受影响。
2. **四个端点都保持无 `@RequestBody`**（沿用现状）⇒ 带 body 的请求不会因「body 被忽略」而 400，
   一定走到 501。若将来加 `@RequestBody`，`NotImplementedEndpointsTest` 的空 body 调用会先变 400。

### 4.4 C6 最终校验语义（**写入 `docs/backend-api.md`**）
`StorefrontAccountController.updateNotificationPrefs`（原 `:95-112`；**MAJ-E3 后为 `:101-121`**）：
- 判定条件：`emailOrder == null && emailPromo == null && smsOrder == null` → **400**
  msg =「通知偏好不能全为空:请至少提交 emailOrder / emailPromo / smsOrder 中的一个」；
- **只要有一个有效字段** → 照常 upsert；未出现的字段**保留库中现值**（patch，不是整行替换）
  —— 见下方 **G2 / MAJ-E3**（本行原写「未给的字段按默认值兜底」，该口径已在本轮被推翻）；
  仅当该用户尚无记录时，未传字段才落到默认值
  （`emailOrder=true` / `emailPromo=false` / `smsOrder=true`）；
- 字段名 `emailOrder`/`emailPromo`/`smsOrder` **无改动**（买家侧三方本就一致：
  `account.ts:12-14`、`dashboard/Settings.vue:36-39`、DB `email_order/email_promo/sms_order`）；
- `{email,push,sms}` 是**商家端**形状，属 C5 的 501 端点，**未混为一谈**；
- 连带更新 `NotificationPrefsDTO.java:5-18` 的类注释（原「三个字段都可为 null，由控制器按默认值兜底」
  已不再完整）。

**为什么不是 501**：该端点有真实实现（`user_notification_pref` 落库），只缺入参校验；
改成 501 会破坏一个能用的功能。qa 的 `AccountNotificationContractTest` 类注释也明确写了这一点。

---

## 5. 编译输出

容器独占执行一次（无 `clean`、无 `test`，运行中的 dev 后端未被触碰）：

```
$ docker exec nexus-dev bash -lc 'cd /workspace && mvn -B -o -q compile'
EXIT=0
```

`-q` 使成功时无输出，故补做了产物时间戳取证（本轮两次编译，第二次在契约 v2 修正后）：

```
-rw-r--r-- 1 root root 5811 2026-10-01T21:49:14 /workspace/target/classes/.../StorefrontCheckoutController.class
-rw-r--r-- 1 root root 5458 2026-10-01T21:49:15 /workspace/target/classes/.../StorefrontAccountController.class
-rw-r--r-- 1 root root 3086 2026-10-01T21:49:16 /workspace/target/classes/.../config/AuthzRules.class
（容器内 /workspace/src/.../AuthzRules.java mtime = 2026-10-01T21:46）
```
即：编译产物晚于源文件，确认本轮改动**真的进了编译**（不是命中了旧 class）。

**容器锁已交回 Lead** —— 本轮结束后不再占用容器，`mvn test` 与 V6–V11 迁移均由 env-verifier/qa 执行。

---

## 6. 未决问题（需 Lead 裁决）

### 已决 #1（原「未决 #1」）：`/checkout/promo` 未达门槛的状态码 —— **维持 409，不改码也不改测试**
> **裁决（Lead，TASK-002-G2）**：该分支是本批**之前**既有的 **409**
> （`CouponServiceImpl.java:131-134` 走 `new CustomException(String)`，单参构造器默认
> `HttpStatus.CONFLICT`，见 `CustomException.java:19-22`），且 qa 的
> `StorefrontPromoTest.belowMinOrderRejected`（`:192-201`）**刻意钉住「沿用既有错误码」**，
> **无缺陷驱动** ⇒ 按最小范围修改原则，**既不改码也不改测试**。
> 契约 C2 的 400 只适用于「未领券 / 已使用 / 优惠码无效」三种情形，不适用于门槛。

原始分析与两个备选（存档，勿再当作未决项）：
- 契约 C2 原文：「未领/已用/过期/**未达门槛 → 400** 且 msg 可区分」；
- 现状：该分支走 `new CustomException("未达到优惠券使用门槛")`，单参构造器即
  `HttpStatus.CONFLICT`（`CustomException.java:19-22`），代码注释写明
  「沿用既有的 409，不改动既有错误码契约」；
- 测试：qa 的 `StorefrontPromoTest.belowMinOrderRejected`（`:192-201`）**明确钉 409**，
  测试名即「未达门槛 → 409（门槛校验在 service 里，沿用既有错误码）」；
- 我当初**未改码、未改测试**并上报 Lead，裁决结果即「维持 409」。
- 状态：**已结清（G2）**。实现 409 + 测试 409 + 文档 409，三方一致。

### 未决 #2（提示，非阻塞）：`PUT /admin/settings` 的响应体不再是设置对象
`web/src/api/modules/adminSettings.ts:23-29` 的 `updateAdminSettings(): Promise<AdminSettings>`
期待服务端回设置对象；改 501 后前端拿到的是错误信封（经 `http.ts` 拦截器抛出）。
`merchantSettings.ts:49-57` 同理。这属**预期的诚实降级**，但需要 frontend 决定交互口径
（关掉「保存」按钮 / 显示「暂不支持」），已同批告知。

### 未决 #3（提示）：`GET /admin/settings`、`GET /merchant/settings` 仍是硬编码
C5 只要求写端点诚实降级，故两个 GET 保持现状（200 + 硬编码/部分真实值）。
即「读得到、写不了」，前端应据此设计。

---

## 7. 预期需要 qa 同步的测试清单

> 现状：**qa 已基本同步完成**（见「已同步」列）。下表是完整清单，用于最终扫尾核对；
> 若闸门仍有红项，请先看这一节。

### 7.1 必须同步（本批状态码/鉴权语义变更导致）

| 测试类 | 用例 / 断言 | 变更原因 | 期望 | 状态 |
|--------|-------------|----------|------|------|
| `StorefrontPromoTest` | 全部 10 条 + helper `promo()` | 原以**空 token** 按「白名单匿名」编写，helper 注释即写「不需要 token」 | 全部改传 `userToken()`；且**先 claim 目标券**；新增匿名 401 锚点 | ✅ 已同步（`:34-36`、`:132-137`、`:278`） |
| `StorefrontPromoTest.belowMinOrderRejected` | 未达门槛 | 契约 C2 字面写 400、现状/测试 409；**Lead 已裁决维持 409**（G2） | **409**（已定案，不再有 B 方案） | ✅ 已同步为 409（`:192-201`） |
| `RequestShapeTest.summaryInvalidItemStillConflict` | `/checkout/summary` 非法商品项 | BLK-3 定为 400；且端点改为需登录 | 方法名/DisplayName/断言均改为 **400** + `userToken()` | ✅ 已同步（`:74-82`） |
| `ErrorModelTest` | `summaryEmptyItemsIsBadRequest`（`:104/:107`，本就要 400） | 端点改为需登录 ⇒ 空 token 会先 401 | 改传 `userToken()`，仍断言 400 | ✅ 已同步 |
| `ErrorModelTest` | `promoMissingSubtotalIsBadRequest`（`:150`） | 同上 | 改传 `userToken()`，仍断言 400 | ✅ 已同步 |
| `AuthzRegistrationGateTest.PUBLIC_WHITELIST` | `:76-80` 原含两条 checkout | 两条路径已移出白名单**且**已进 `AuthzRules` ⇒ 若不移除，`whitelistAndAuthzRulesDoNotOverlap` 会报「白名单与规则表重复登记」 | 删除两行，并留注释说明 | ✅ 已同步 |
| `AuthzRulesTest.frontendSurfaceIsAllowed` | 买家清单 | 新登记 `/checkout/** → USER` | 加入 `/checkout/summary`、`/checkout/promo` | ✅ 已同步（`:85-88`） |
| `AuthzRulesTest.rolesCannotCrossDomains` | 跨域断言 | 同上 | 断言 SHOP/ADMIN 对两条路径均被拒 | ✅ 已同步（`:137-142`） |
| `NotImplementedEndpointsTest`（新） | 4 条 501 + 无副作用 + 鉴权优先 | C5 | 全绿 | ✅ qa 已建，实现已对齐 |
| `AccountNotificationContractTest`（新） | 3 条 C6 + 2 条正例 | C6 | 全绿 | ✅ qa 已建，实现已对齐 |
| `CheckoutMoneyConsistencyTest`（新） | C4 三值一致 + 匿名 401 锚点 | C0/C4 | 全绿 | ✅ qa 已建 |

### 7.2 需要 qa 复核「未受影响」的（我判断无需改）
- `AuthorizationBaselineTest`：只涉及 `/notifications`、`/chat/**`、`/orders` 等，无 checkout 路径；
- `AuthzRulesTest.unlistedPathsAreDeniedForEveryRole`、`doubleStarMatchesBarePath`：与新规则无交集；
- 任何断言 `PUT /admin/settings` / `PUT /merchant/settings` / `withdraw` / `addresses/{id}/default`
  返回 **200** 的旧用例（若有）：属**正确的红**，必须改判 501，不要回退实现。

---

## 8. 文档反话修复清单

| 文件:行（改前） | 原表述 | 改为 |
|-----------------|--------|------|
| `docs/backend-api.md:104` | 「重算小计/**运费/税/满减**」、参数不合法 400 | 重算 `subtotal/discount/total`；无运费/税；**需登录**；空 items·参数错 400、商品不存在 404 |
| `docs/backend-api.md:105` | 「未命中再兜底硬编码 SAVE10/VIP15」、状态 🟡 | 「**无** SAVE10/VIP15 兜底」、**需登录**、未达门槛 409、状态 🟢 |
| `docs/backend-api.md:326` | 「重算小计/运费/税/满减」 | 统一到新口径 + 需登录 + 状态码 |
| `docs/backend-api.md:159` | `Sales` = 累计已支付**订单行数** | 累计已支付**订单单数**（按 `order_no` 去重） |
| `docs/backend-api.md:201` | `Orders` = 本店累计已支付**订单行数** | 本店累计已支付**订单单数**（按 `order_no` 去重） |
| `docs/backend-api.md:147/148/327/334` | 「`review_status` / `product.status` 列**未落地**（库中尚无）」 | 列由仓库里的 **V8 / V10 迁移**引入，**本轮未应用该迁移**（运维单独裁决） |
| `docs/backend-api.md:98` | `PUT /addresses/:id/default` = 「no-op」 | **501 未实现** + 原因（无 `is_default` 列 = V10 未应用） |
| `docs/backend-api.md:150/151/192/194` | `/admin/settings`、`/merchant/settings`、`withdraw` 的「no-op」 | **501 未实现** + 「此前返回 200 是假成功」 |
| `docs/backend-api.md:232` | 「均需登录（`/checkout/promo` 除外，已入白名单）」 | 「**全部需登录**」；原写法已作废 |
| `docs/backend-api.md:88`（账号表） | 未提字段名与校验 | 字段名 + **C6：三偏好全缺 → 400** 的完整语义 |
| `docs/backend-api.md:308-317`（授权表） | 只列 `/common`、`/file`、`/shoppingCart` | 增列 `/checkout`：白名单→`AuthzRules` 的两步与原因 |
| `docs/backend-api.md:337` 附近 | —— | 新增「**诚实降级约定**」一行：无落库表的写端点一律 501 |
| `docs/backend-api.md:345-347` 附近 | —— | 新增门槛 409 的显式标注（原「未决 #1」已按 Lead 裁决改为「已决：维持 409」，见 G2） |
| `docs/STARTUP.md:78` | 「`sql/migrations/V1…V5.sql`（共 23 张表）」 | 入口是**写死三段 + `for f in sql/migrations/*.sql`（当前 V1…V11）**；新增文件不需改 entrypoint |
| `docs/STARTUP.md:78` | ——（新增） | **批次标记短路陷阱**：`${DATA_DIR}/.schema-imported` 存在就再也不扫 `sql/`，新增 V12 后重启**不会**执行；给出手工解法与「`schema.sql` 种子不幂等」的告警 |
| `docs/STARTUP.md:197-200` | 「`sql/migrations/V1…V5`」 | 同上，并补裸机路线需自行补导新迁移、与 backend-api 的「未应用该迁移」互指 |
| `AdminApiController.java:387`（改前） | `m.put("status", "visible")` 上方无说明；方法注释「因库中尚无 review_status 列」 | `matchesReviewStatus` javadoc 改为「**本轮未应用 V8 迁移**」，并点明迁移文件已在仓库 |
| `AdminApiController.java:366-368` | 「`review_status` 列（TASK-000-D2 的 schema 变更，本轮无权限）」 | 「由 `sql/migrations/V8__review_moderation.sql` 引入，**本轮未应用该迁移**」 |

另外同步的**代码注释**（非文档但同属「注释与事实不符」）：
`SpringMvcConfig.java`、`AuthzRules.java`、`StorefrontCheckoutController.java`、
`CouponService.java`、`CouponServiceImpl.java`、`NotificationPrefsDTO.java`、
`StorefrontAddressController.java`、`AdminApiController.java`、`MerchantApiController.java`。

---

## 9. 附：本轮写入的文件清单（仅列我实际改动的）

**代码（7 个）**
- `src/main/java/com/project/platform/config/SpringMvcConfig.java`（C0 第 1 步）
- `src/main/java/com/project/platform/config/AuthzRules.java`（C0 第 2 步）
- `src/main/java/com/project/platform/controller/StorefrontCheckoutController.java`（C1/C2 注释 + BLK-3）+ `dto/CheckoutSummaryDTO.java`（javadoc）
- `src/main/java/com/project/platform/controller/StorefrontAccountController.java`（C6）+ `dto/NotificationPrefsDTO.java`（注释）
- `src/main/java/com/project/platform/controller/AdminApiController.java`（C5 + 注释）
- `src/main/java/com/project/platform/controller/MerchantApiController.java`（C5 ×2）
- `src/main/java/com/project/platform/controller/StorefrontAddressController.java`（C5 + 归属校验）
- `src/main/java/com/project/platform/service/CouponService.java` / `service/impl/CouponServiceImpl.java`（注释与「白名单」旧表述）

**文档（2 个）**：`docs/backend-api.md`、`docs/STARTUP.md`
**本报告**：`docs/TASK-002/04-BACKEND-FIX.md`

**未改动但已核对**：`StorefrontPaymentController.java`（C3）、
`ProductOrderServiceImpl.java`（C3/C4，本批既有实现）、`CouponServiceImpl` 的门槛判定（**已决：维持 409**，见 G2）。

---

# G2（TASK-002-G2）—— Review Gate 三条收口 + 未决结清

> 承接 Review Gate 对 TASK-002-A 的结论：C0/C1/C2/C3/C5/C6/C7 全部 ✅，
> 收口项为 **MAJ-E1**（文档三角色）、**MAJ-E3**（静默重置用户偏好）、**STARTUP:258 措辞**、
> 以及结清本报告 §6 的「未决 #1」。
> 纪律：**本轮未进容器**（qa 独占闸门与复验）；未改 `src/test/**`；未改 `web/**`、`sql/**`、`docker/**`；
> 未执行任何 V6–V11 迁移。

## G2.1 MAJ-E1 —— `docs/backend-api.md` 的 `/checkout/**` 授权：三角色 → 仅 USER

**缺陷**：文档写「`AuthzRules` 的 `/checkout/**` → 三角色」，而实现是
`AuthzRules.java:82` 的 `new Rule("/checkout/**", Set.of(USER))`，
且 qa 的 `AuthzRulesTest.rolesCannotCrossDomains`（`:137-142`）**专门断言 SHOP/ADMIN 被拒** ——
文档与代码/测试三方相反，正是本轮要消除的「文档写反话」。

**改动**：`docs/backend-api.md:318`（授权表 `/checkout` 行）
- 原文：「→ 三角色(**需登录**,匿名 401)」
- 改为：「→ **仅 USER(买家)**,需登录,**匿名 401**;SHOP/ADMIN 命中规则但角色不匹配 ⇒ **403**
  (`AuthzRulesTest.rolesCannotCrossDomains` 专门钉住这一点)」

**核对方式**：`AuthzRules.java:82` 与 `AuthzRulesTest.java:137-142` 逐条比对，并顺手检查了
`docs/backend-api.md` 中其余 `三角色` 的用法（`/file/**`、`/common` 的 currentUser/updateCurrentUser/
updatePassword 确为三角色，**未误改**）。

## G2.2 MAJ-E3 —— 通知偏好「只改一个开关」不再静默重置另外两项（**选首选：load-then-merge**）

**缺陷（数据正确性）**：`StorefrontAccountController.java:100-106` 此前**新建** `UserNotificationPref`
并把未提交字段一律填默认值（true/false/true），而
`UserNotificationPrefMapper.updateById` 的 UPDATE **无条件写全部三列**
（`mapper/UserNotificationPrefMapper.java:19-21`：`SET email_order=…, email_promo=…, sms_order=…`）
⇒ 用户只改一个开关，**另外两项被静默重置为默认值**。

**所选方案：首选 — load-then-merge**（与 Lead 倾向一致）
- **理由**：静默重置用户设置是**数据正确性**缺陷；把「未给 = 重置默认」写进契约只是把缺陷合法化。
  次选（文档化）会让「用户改了一个开关，另一个开关自己变了」成为永久契约，后续每任维护者都要
  重新论证一次，且真实用户会丢设置。
- **实现**（`StorefrontAccountController.java:101-121`，其中 C6 判定在 `:103-106`、merge 在 `:110-118`）：
  1. **C6 判定不变**：`emailOrder/emailPromo/smsOrder` 全为 `null` → 400，**保持原 msg**；
  2. `UserNotificationPref existing = userNotificationPrefService.getByUserId(current.getId());`
  3. 每个字段：`data.getX() != null ? data.getX() : (existing != null ? existing.getX() : <默认值>)`
     —— **未出现的字段保留库中现值**；只有该用户**尚无记录**时才用默认值
     （与 `GET /account/notifications` 无记录时返回的默认值一致）；
  4. `upsert` 不变（`UserNotificationPrefServiceImpl` 已按 userId 查存在性）。
- **语义**：部分提交 = **patch**，不是整行替换。全量提交（前端整块提交）与
  「只改一个开关」两种用法都成立，且后者不再有副作用。
- **C6 兼容性**：全缺才 400 的判定在 merge 之前，**不受影响** ✅
- **并发说明**：`upsert` 本身是「先查后写」，并发首次提交可能撞 `uk_user_id`
  （`sql/migration-2026-08-08-phase1.sql:22`）报错回滚。这是**既有**行为，本轮未引入也未加剧
  （load 是额外一次读，不改变写路径），**不在本轮范围内**。
- **null 列的防御**：若历史行的某列恰为 `NULL`，`existing.getX()` 返回 `null`，
  `updateById` 会把该列写成 `NULL`（而不是默认值）——与「保留现值」一致；schema 三列均有
  DEFAULT 且线上无该情形。

**连带文档/注释**：
- `docs/backend-api.md:88`：把「未给的字段按默认值兜底」改为
  「**部分提交是 patch 不是整行替换**：未出现的字段**保留库中现值**，只有该用户尚无记录时
  才落到默认值」；
- `NotificationPrefsDTO.java:13-21`：新增「部分提交是 patch」一段，并明确本 DTO 的 `null`
  语义是「该字段不参与本次 patch」；
- 控制器 javadoc 新增 MAJ-E3 段（说明旧行为与现在口径）。

**⚠️ 预期需要 qa 同步的测试（我不改 `src/test/**`，请 Lead 转 qa）**

> 已按 **qa 当前的测试文件版本**核对（`AccountNotificationContractTest` 已改为
> `clearPrefs()` + 固定 `USER_ID = 2`）。结论：**现有用例不会变红**，
> 但**没有任何用例覆盖「库中已有行」这条分支** —— 而 MAJ-E3 的缺陷恰在这一分支上。
> 因此需要的是**补用例（覆盖新语义）**，不是改断言。

| 测试 | 位置 | 现状 | 建议 |
|------|------|------|------|
| `partiallyProvidedFieldsStillWork` | `:158-175` | `clearPrefs()` → 库中**无行** → 部分提交 `{emailPromo:true}` → 断言 `email_order==1`、`sms_order==1`。**在新语义下仍成立**（无记录 ⇒ 未传字段取默认值，正是这三个值） | **保留并改标题/注释**：它不是「未给按默认值兜底」的证据（`clearPrefs()` 已把「有行」的分支删掉了），而是**「首次提交（无行）取默认值」** 的锚点。DisplayName 与 `:163-165` 注释建议同步 |
| **新增（MAJ-E3 判别力所在）** | —— | 缺失 | **seed 一行再部分提交**：先 `POST {emailOrder:false, emailPromo:true, smsOrder:false}`（全量），再 `POST {emailPromo:false}`（部分），断言 `email_order==0`、`email_promo==0`（显式生效）、`sms_order==0`（**保留，不是回落默认值 1**）。旧实现在此会得到 `email_order==1 / sms_order==1` ⇒ 该用例是**唯一**能咬住 MAJ-E3 的断言 |
| `correctFieldsArePersisted`、`secondSubmitOverwrites` | `:70-124` | 全量三字段 + `clearPrefs()` | **无需改**（全量提交语义未变） |
| `allFieldsMissingIsBadRequest`、`wrongFieldNamesAreRejected` | `:126-156` | 全缺 / 错字段名 → 400，且断言**零写入痕迹**（`rows == 0`） | **无需改**（C6 口径未变；「400 不得先写库」与 merge 顺序一致：判定在写之前） |

> 附带说明：`clearPrefs()` 用的是 `user_id = 2`，与 `correctFieldsArePersisted` 的
> GET 回读同源，互不干扰；新用例请沿用同一 `USER_ID`/`clearPrefs()` 风格，
> 以免引入跨用例的行残留（`@Transactional` 已回滚，但显式清理更稳）。

## G2.3 `docs/STARTUP.md` 的 V4/V5 措辞与残留核对

- **`:258` 故障排查表**：`新增迁移（V4/V5 等）需手工执行` → `新增迁移（V6…V11，以及将来的 V12+）需手工执行`
  （现况：入口 `for f in sql/migrations/*.sql` 已覆盖 V1…V11，V4/V5 是早已导入完成的历史批次，措辞过时）。
- **`:85`**：原文「真因是批次标记短路,不是「脚本清单只写到 V5」」——这句本身是**对的**，
  但「V5」这个数字容易让人误以为清单停在 V5，改为更明确的一版：
  「真因不是「脚本清单只写到 V5」——入口是 glob,清单本来就会跟着目录长大;
  真正的原因是批次标记短路(`.schema-imported` 一旦存在,整段导入逻辑直接不进入)」。
- **全文件残留核对**（`grep 'V1|V4|V5|23 张|migrations'` 共 8 处，逐处看）：
  - `:80`、`:208`「当前为 V1…V11」✅ 正确（描述 glob 的当前覆盖范围）；
  - `:84`、`:87` V12 举例 ✅；
  - `:214` 引用 V8/V10 未应用 ✅；
  - `:258` ✅ 本轮已改；
  - **「共 23 张表」/「`sql/migrations/V1…V5.sql`」已零残留** ✅

## G2.4 未决 #1 结清：**已决 —— 维持 409**

- `docs/TASK-002/04-BACKEND-FIX.md` §6 的「未决 #1」已改写为
  **「已决 #1（原「未决 #1」）：维持 409，不改码也不改测试」**，并附 Lead 裁决依据；
- 同文档其他位置原写「待裁决 / 选 A / 选 B / 若 Lead 选 B 则改 400」的表述已全部结清：
  §0 结论表 C2 行、§2.2 结尾、§4.1 未变更清单、§7.1 表格、§8 文档表对应行、§9 末行；
- **核对**：全文已无「未达门槛 → 400 待裁决」类的未定表述；现存「400」提及仅指
  「未领券 / 已使用 / 优惠码无效」与「summary 参数不合法」等适用分支；
- **未改**：`CouponServiceImpl` 门槛判定与 `StorefrontPromoTest.belowMinOrderRejected` 均**零改动**。

## G2.5 G2 改动文件清单
| 文件 | 改动 |
|------|------|
| `docs/backend-api.md:318` | MAJ-E1：`/checkout/**` 三角色 → **仅 USER**(含 403 语义与测试出处) |
| `docs/backend-api.md:88` | MAJ-E3：patch 语义（未出现字段保留现值） |
| `src/main/java/.../controller/StorefrontAccountController.java:74-121` | MAJ-E3：load-then-merge + javadoc |
| `src/main/java/.../dto/NotificationPrefsDTO.java:13-21` | MAJ-E3：`null` = 不参与本次 patch |
| `docs/STARTUP.md:85,258` | V5/V4 措辞与现况统一 |
| `docs/TASK-002/04-BACKEND-FIX.md` | 本节 + §0/§2.2/§4.1/§4.4/§6/§7.1/§8/§9 同步结清 |

**未在容器验证**（本轮硬约束：不得进容器）。改动为
①文档字符串、②一处纯 Java 表达式（读一次 `getByUserId` + 三元合并，所用方法与
`getNotificationPrefs`/`upsert` 同签名、同接口，无新 import、无新依赖），
编译风险极低；请 qa 在复验闸门统一 `mvn -B clean test` 确认。
