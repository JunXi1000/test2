# TASK-002-C · 测试同步说明与新增回归网

> **产出人**:测试 Agent(`qa-acceptance`) · **任务**:TASK-002-C(task-9) · **契约**:Lead 冻结的 C0–C5(见 [00-AGENT-REGISTRY.md](00-AGENT-REGISTRY.md) §二)
> **写范围**:仅 `src/test/**`、`web/tests/**`(本文件在 `docs/TASK-002/06*`)。**未修改** `src/main/**`、`web/src/**`、`sql/**`、`docker/**` 任何字节。
> **容器**:P1 阶段按 Lead 指定**未进容器**,故本文件所有改动**均未经编译/运行验证** —— 权威闸门数字见 TASK-002-D(容器锁移交后由我统一跑)。

---

## 0. 三句话

1. **上一轮 12 条红(BLK-2 `StorefrontPromoTest` 10F+1E、BLK-3 `RequestShapeTest` 1F)已逐条定位到根因并改完**;改动的方向不是「让测试适应代码」,而是**把断言对齐到冻结契约 C0–C5**。
2. **新增 10 条回归用例**(`CheckoutMoneyConsistencyTest` 5 + `NotImplementedEndpointsTest` 5),它们钉的正是上一轮四个 Blocker/Major 的**根因面**:券入口被白名单杀死、金额四方不一致、4 个端点 200 假成功。
3. ⚠️ **这些新用例是「契约测试」而不是「现状测试」**:它们**预期在 backend-fix/frontend-fix 落地前会失败**。若 D 阶段它们红了,先查契约实现是否完成,再怀疑测试 —— 见 §5 的依赖清单。

---

## 1. 改动总览

| 文件 | 改动 | 对应契约 | 旧状态 | 预期新状态 |
|---|---|---|---|---|
| `src/test/.../controller/StorefrontPromoTest.java` | **重写**(11 例) | C0 / C2 | 10F + 1E | 15 例全绿 |
| `src/test/.../controller/RequestShapeTest.java` | 3 处 token + 1 处状态码 | C0 / BLK-3 | 1F | 11 例全绿 |
| `src/test/.../controller/ErrorModelTest.java` | 2 处 token + 1 处 msg 断言 | C0 / C2 | —(原绿) | 19 例全绿 |
| `src/test/.../config/AuthzRegistrationGateTest.java` | 白名单删除 2 行 | C0 | —(原绿) | 2 例全绿(**依赖 AuthzRules 加 `/checkout/**`**) |
| `src/test/.../config/AuthzRulesTest.java` | 放行清单 + 跨域断言 | C0 | —(原绿) | 6 例全绿(**依赖同上**) |
| `src/test/.../controller/AddressControllerTest.java` | 1 例 200 → 501 | C5 | —(原绿) | 6 例全绿(**依赖 C5 实现**) |
| `src/test/.../controller/CheckoutMoneyConsistencyTest.java` | **新增**(5 例) | C0 / C1 / C3 / C4 | 不存在 | 5 例全绿 |
| `src/test/.../controller/NotImplementedEndpointsTest.java` | **新增**(5 例) | C5 | 不存在 | 5 例全绿 |
| `src/test/.../controller/AccountNotificationContractTest.java` | **新增**(5 例) | **C6** | 不存在 | 4 绿 + 2 依赖 C6 |
| `web/tests/e2e-functional.spec.ts` | 2 例重写 | BLK-5 | 2 例断言已失效 | 2 例待 D 阶段验证 |
| `web/src/**/*.spec.ts`(4 份) | **不由我改**(见 §5.5) | C1/C3/BLK-4 | 3 份被 frontend-fix 改完、1 份待补 | 我只复核内容 |

> **写范围边界(Lead 裁决 (B))**:task-9 的 `write_scopes` = `["src/test","web/tests","docs/TASK-002/06a-TEST-SYNC.md"]`,**不含 `web/src`**。`web/src/**`(含其中的 `.spec.ts`)整体归 frontend-fix 独占 —— 理由是文件系统版本守卫只在**目录级单写者**下才有意义。我执行中一度编辑了 `useOrderSummary.spec.ts` 的 `setup()`,被 `FS_STALE_VERSION` 挡下(该文件同时被 frontend-fix 写),现已停止对 `web/src/**` 的一切写入。

> 基线口径:A 阶段 `mvn -B clean test` = **171 run / 11F / 1E**。本轮的「归零」指这 12 条;新增的用例(`CheckoutMoneyConsistencyTest` 5 + `NotImplementedEndpointsTest` 5 + `AccountNotificationContractTest` 5)会让 run 总数上升到约 **186**,但 **failures 与 errors 必须为 0**。

---

## 2. BLK-2:`StorefrontPromoTest` 为什么全红,怎么改

### 2.1 根因(不是「测试写错了」,是契约变了)

旧版的构造方式是 `post("/checkout/promo", "", body)` —— **空 token**,即按「匿名可用」的旧契约发请求。而:

- **TASK-001 BLK-1 实测**:该端点在 `SpringMvcConfig` 白名单里 ⇒ `LoginInterceptor` 根本不跑 ⇒ `CurrentUserThreadLocal` 为空 ⇒ `currentUserId()` 恒 `null` ⇒ `CouponServiceImpl.applyByCode` L114-115 直接 400「请先登录后再使用优惠码」。**匿名与登录都一样 400**。
- **C0 之后**:端点移出白名单 ⇒ 匿名 **401**;登录且已领券 → **200**。
- 旧版的 `makePermanent(code)` 只把 `coupon` 行改成「未过期 + enabled」,**没有** `user_coupon` 领取记录。C2 要求「必须已领取」,所以只 `makePermanent` 而不领券,拿到的是 400「您未领取该优惠券」而不是折扣额 —— 这两件事缺一不可。

### 2.2 逐例处置

| 旧用例 | 旧断言 | 处置 | 新断言 |
|---|---|---|---|
| `percentCouponBelowCap` | 匿名 → 15.00 | 改:带 token + 领券 | 200 / 15.00 |
| `percentCouponCappedByMaxDiscount` | 匿名 → 50.00 | 改:带 token + 领券 | 200 / 50.00 |
| `percentCouponRoundsHalfUpToCents` | 匿名 → 2.67 | 改:带 token + 领券 | 200 / 2.67 |
| `fixedCoupon` | 匿名 → 20.00 + couponId | 改:带 token + 领券 | 200 / 20.00 / `couponId=="SAVE20"` |
| `fixedCouponAtExactMinOrder` | 匿名 → 20.00 | 改:带 token + 领券 | 200 / 20.00 |
| `belowMinOrderRejected` | 匿名 → 409 | 改:带 token + 领券 | **409** 不变 + 新增 msg=`未达到优惠券使用门槛` |
| `unknownCouponTypeYieldsZero` | 匿名 FREESHIP → 0.00 | 改:带 token + 领券 | 200 / 0.00(券型 `shipping` 就是 0) |
| `expiredCouponIsIgnored` | 匿名 → **0.00**(靠已删除的兜底表) | **改判** | **400** + msg=`优惠码无效` |
| `disabledCouponIsIgnored` | 匿名 → 0.00 | **改判** | **400** + msg=`优惠码无效` |
| `legacyFallbackCodeStillWorks` | `SAVE10` → **15.00**(硬编码兜底) | **改判** | **400** + msg=`优惠码无效` |
| `unknownCodeYieldsZero` | `NO_SUCH_CODE` → **0.00 + 200** | **改判** | **400** + msg=`优惠码无效` |

**为什么 `expired` / `disabled` / 两条兜底码从「0.00 或 200」改成「400」**:旧断言是在描述**已删除的兜底表**行为。删除后「这个码不能用」的唯一诚实表达是**明确拒绝**;若继续断言「200 且 discount=0」,等于认可「静默按 0 元折扣放行」—— 结算页会显示「优惠已应用」却一分不减,这比报错更糟。

### 2.3 新增用例(5 条)

| 用例 | 钉什么 |
|---|---|
| `loggedInWithClaimedCouponGetsRealDiscount` | **BLK-1 回归锚点**:登录 + 已领券 → 200 且 15.00,并回传 `couponId/code/type` |
| `anonymousPromoIsRejected` | **C0 回归锚点**:匿名 → 401(此前是 400「请先登录」) |
| `unclaimedCouponIsRejected` | 已登录但未领 → 400「您未领取该优惠券」 |
| `usedCouponIsRejected` | 已领已用 → 400「该优惠券已使用」 |
| `missingCodeIsBadRequest` | 缺 code → 400「优惠码不能为空」(先过鉴权,再入参校验) |

### 2.4 测试辅助的取舍(为什么不走 HTTP 领券)

`claim(code)` **直接写 `user_coupon` 行**,而不是调 `POST /coupons/{id}/claim`:

- 本类要测的是 **promo 的折扣与券有效性**;领取端点有自己的覆盖(`AuthorizationBaselineTest` / 券域用例)。
- 走 HTTP 领取会把两件事耦合:领取一坏,本类 10+ 条用例全红,**掩盖真正的失败点**(这正是上一轮 10F+1E 难以定位的原因之一)。
- `BaseControllerTest` 是 `@Transactional`,这些写操作随测试回滚,不污染其他用例。

---

## 3. BLK-3:`RequestShapeTest` 同步

| 位置 | 旧 | 新 | 依据 |
|---|---|---|---|
| `summaryIgnoresUnknownFieldsAndUsesDbPrice` | `post(..., "", ...)` | `post(..., userToken(), ...)` | C0:移出白名单 ⇒ 空 token 会 401 |
| `summaryAcceptsIdFallback` | 同上 | 同上 | 同上 |
| `summaryInvalidItemStillConflict` → 改名 `summaryInvalidItemIsBadRequest` | **409** | **400** | 「商品参数不合法」是**入参不合法**,与业务冲突(如未达门槛)409 区分 |

> ⚠️ **待 Lead/backend-fix 最终确认**:该状态码的最终口径在 `docs/TASK-002/04-BACKEND-FIX.md` 落地前属**暂定**。我按 task-9 描述的「口径统一」与控制器现有文案(`结算商品参数不合法`)取 **400**。若最终定为 409,改一行即可。

---

## 4. C5:四处「200 假成功」的诚实降级

### 4.1 既有用例同步

- `AddressControllerTest.setDefault` → 改名 `setDefaultIsNotImplemented`,断言 `200` → **`501`**,并追加「地址列表仍可读且逐字不变」。

### 4.2 为什么没动 `AdminApiControllerTest` / `MerchantApiControllerTest`

两者**只**测 `GET /admin/settings` 与 `GET /merchant/settings`(读,未被 C5 改动,应继续 200)。C5 改的是 `PUT`。**我没有把读端点的 200 误改成 501** —— 这正是 Lead 提醒的「别改错」。

### 4.3 为什么没把 `POST /account/notifications` 改成 501

契约 C5 明确它**不在** 501 名单里:它已有真实实现(`user_notification_pref` 落库,字段 `emailOrder/emailPromo/smsOrder`)。改成 501 会破坏一个能用的功能。

**⚠️ 更正我此前的归因(Lead 已裁决)**:上一轮 TASK-001 把「提交 `{email,push,sms}` → 200 但 DB 零变化」记为「前后端字段名不一致」,**那个归因是错的** —— 买家侧三方字段本来就一致(`account.ts` / `Settings.vue` / `StorefrontAccountController:66-68` / DB `email_order,email_promo,sms_order`)。`{email,push,sms}` 是**商家端** `PUT /merchant/settings` 的形状,而那个端点已属 C5 的 501。

于是真缺陷是**缺参数校验**,Lead 定为新契约 **C6**:三个偏好全缺(空 body / 全错字段)→ 应 **400**,而旧实现对 null 一律按默认值(`true/false/true`)兜底 ⇒ 200 且静默写一行默认值。已由新增的 `AccountNotificationContractTest` 覆盖(见 §5.4)。

---

## 5. 新增回归网(本轮核心价值)

### 5.1 `CheckoutMoneyConsistencyTest`(5 例)

把 TASK-001 手工取证过的「四方金额一致」落成可重复执行的自动化:

| 用例 | 契约 | 断言 |
|---|---|---|
| `fourAmountsAgreeWithoutCoupon` | C4 | `summary.total(198.00) == create.amount == payment.amount == Σ product_order.total_money` |
| `fourAmountsAgreeWithCouponAndCouponIsRedeemed` | C3/C4 | 用券:`summary(198/19.80/178.20)` → `create.amount=178.20` → DB 两处同为 178.20 → **券恰好核销 1 次** → 同券再用 400「该优惠券已使用」 |
| `summaryWithUnclaimedCouponIsRejected` | C1 | 带 code 未领 → 400「您未领取该优惠券」 |
| `summaryWithoutCodeHasZeroDiscount` | C1 | 无 code → 200 且 `discount=0`(**不是** 400) |
| `anonymousSummaryIsRejected` | C0 | 匿名 `/checkout/summary` → **401** |
| `serverRecalculatesPriceEvenIfClientSendsItsOwn` | C3 | 请求体塞 `price:0.01/total:0.02/amount:0.02` → 一律忽略;订单行 `total_money` 仍是 `99.00` |

**关键设计:用券那一例是四例里唯一有判别力的。** 无券时四处相等是平凡的;用券时才会暴露「summary 减了、create 没减」或「减了两次」这类错误 —— 而后者正是 BLK-4 的形状。

### 5.2 `NotImplementedEndpointsTest`(5 例)

| 用例 | 断言 |
|---|---|
| `adminSettingsUpdateIsNotImplemented` | `PUT /admin/settings` → 501,且 **GET 响应逐字不变** |
| `merchantSettingsUpdateIsNotImplemented` | `PUT /merchant/settings` → 501,且 GET 逐字不变 |
| `merchantWalletWithdrawIsNotImplemented` | `POST /merchant/wallet/withdraw` → 501,且**钱包余额与流水列表逐字不变** |
| `addressSetDefaultIsNotImplemented` | `PUT /addresses/1/default` → 501,且地址列表逐字不变 |
| `notImplementedEndpointsStillEnforceAuthorization` | 4 个端点**匿名仍 401**、跨角色仍 403 —— 501 不得盖过鉴权 |

**只断言 501 是不够的**:一个实现完全可能「先写库再返回 501」,那比假成功更糟。所以每条都同时钉住**副作用为零**(读接口内容/余额/列表在调用前后逐字一致)。

### 5.3 e2e:`e2e-functional.spec.ts` 的「Tiered Discounts」块重写

原两条用例断言的 DOM **已被 frontend-fix 从 `Cart.vue` 移除**(运费行/税行/满减行 + 档位进度提示)。它们不能删 —— 那是 BLK-5(购物车 689.52 ≠ 实扣 694.00)在 e2e 层的唯一锚点。改为:

| 新用例 | 断言 |
|---|---|
| `登录态:购物车不再出现运费/税/满减行,且 Total 等于小计` | `Tiered discount` / `Tax (` / `Shipping` 三处 **count=0**;显示的 Total ≈ localStorage 小计 |
| `匿名态:不给一个可能不对的应付总额,改为提示登录后可见` | 同上三处 count=0 + 出现「Sign in to see your order total」 |

> **为什么匿名那条要断言「提示登录」**:C0 之后匿名拿不到服务端金额,页面选择**不显示**一个自算的应付总额。这是诚实降级,不是功能缺失 —— 用断言把「不许再自算」钉住。

### 5.4 `AccountNotificationContractTest`(5 例,C6)

**这个端点不是 501**(它有真实实现),所以单独成类,不并进 `NotImplementedEndpointsTest`。

| 用例 | 契约 | 断言 |
|---|---|---|
| `correctFieldsArePersisted` | C5 反证 / 契约基线 | 正确三字段 → 200;DB `email_order/email_promo/sms_order` 真的变成 `0/1/0`;GET 与写入一致 |
| `secondSubmitOverwrites` | upsert | 反向值再提交 → 覆盖生效;同一 user 只有 1 行 |
| `allFieldsMissingIsBadRequest` | **C6** | 空 body → **400**;且**不得留下任何写入痕迹** |
| `wrongFieldNamesAreRejected` | **C6** | 只给商家端形状 `{email,push,sms}` → **400**;不得写入 |
| `partiallyProvidedFieldsStillWork` | C6 边界 | 只给一个字段 → 200,未给的按默认值兜底(**避免修复时把「只改一个开关」的用法一起拒掉**) |

**设计取舍**:固定用 **user2**(id=2)而不是 user1,且每个用例开头 `DELETE` 该用户的偏好行。H2 种子里 `user_notification_pref` 没有任何行,但可能被其他测试写入 —— 把「跨用例残留」排除在失败原因之外,测试自身的隔离问题不该伪装成契约失败。

**两条 400 用例是契约测试**:C6 落地前它们会红,那是正确的红。

### 5.5 前端 spec 同步 —— **归我但被并行完成**(诚实声明)

`05-FRONTEND-FIX.md` §5.1 列的 4 个 `web/src/**/*.spec.ts` 断言同步,**在规格上归 qa**(task-9),但目录上属 `web/src/**`(frontend-fix 的写范围)。执行期间 frontend-fix **已并行改完其中三份**,我实测到写冲突:对 `useOrderSummary.spec.ts` 的一次 edit 抛 `FS_STALE_VERSION`(file changed since read)—— 即同一文件两个执行流同写。

**当前状态(我逐份复核过内容,不予重复改动):**

| 文件 | 状态 | 复核结论 |
|---|---|---|
| `web/src/api/modules/checkout.spec.ts` | **已由 frontend-fix 改完** | mock 分支口径正确:无 code → `{subtotal, discount:0, discountCode:null, total}` 且**显式断言不含 `shipping`/`tax`**;带 code → `discountCode:'SAVE10'`、`total=subtotal−discount`;另有空白码 / 未知码 / 零小计封顶三条 |
| `web/src/composables/usePaymentFlow.spec.ts` | **已由 frontend-fix 改完** | 已加必填 `discountCode: ref('')`;已补 `expect(payload.code).toBe('')` 与一条「带码」用例 |
| `web/src/composables/useOrderSummary.spec.ts` | **已由 frontend-fix 改完**(我的 `setup()` 加 `getCode` 的编辑已并入) | `setup()` 返回 `{api, zip, code}`;原「可叠加」已改为「只减 `summary.discount`」(total=85,非 75);另补 onApplied 重取与 BLK-4 钉子 |
| `web/src/composables/usePromoCode.spec.ts` | **无人改动(mtime 09/26)** | 主体用例仍成立(`onApplied` 是**可选**钩子);**缺口**:未覆盖「onApplied 在应用成功 / 移除 / 输入偏离三种情况下触发」这条新行为 |

**我因此暂停对 `web/src/**` 的一切写入**(避免再撞一次丢改动),并已上报 Lead 裁决归属:
- **(A) 明确划归我** → 我补 `usePromoCode.spec.ts` 的 onApplied 缺口,并复核其余三份、只补缺口;
- **(B) 保留现状** → 我在报告里记为「由 frontend-fix 同步、我复核」,并在未覆盖项注明未亲手验证。

> ⚠️ **诚实边界**:上表三份文件的**改动不是我做的**,我只做了内容复核。若 D 阶段其中某条断言红了,应同时找 frontend-fix(作者)与我(复核者)对齐,而不是默认断言已可信。

---

## 6. 契约依赖清单(D 阶段若红,先查这里)

| # | 依赖 | 影响我的哪些用例 | 若不落地的表现 |
|---|---|---|---|
| D1 | `SpringMvcConfig` 删除 `/checkout/summary`、`/checkout/promo` 两行白名单 | 券/summary 全组 | 匿名仍 400 而非 401;登录态仍 400 |
| D2 | `AuthzRules` 增加 `new Rule("/checkout/**", Set.of(USER))` | 同上 + `AuthzRulesTest` + **`AuthzRegistrationGateTest`** | 登录态 **403**(白名单移除后落入默认拒绝) |
| D3 | 4 个写端点改 501 | `NotImplementedEndpointsTest`、`AddressControllerTest` | 仍 200 ⇒ 5 条新用例红 |
| D4 | `RequestShapeTest.summaryInvalidItem*` 的最终状态码 | 1 条 | ✅ **已裁决 400**(`04-BACKEND-FIX.md` 口径一致)⇒ 已就位,无需再动 |
| D4b | C2 的「未达门槛」是 409 还是 400 | `StorefrontPromoTest.belowMinOrderRejected` | ✅ **已裁决 409 维持** ⇒ 已就位,无需再动 |
| D5 | **C6**:`POST /account/notifications` 三个偏好全缺 → 400 | `AccountNotificationContractTest` 的 2 条**会红**(正确的红) | 仍按默认值兜底 ⇒ 空 body 也 200 且写一行 |
| D6 | frontend-fix 的 e2e 失效清单(`05-FRONTEND-FIX.md`) | 其余 6 个 spec 的扫尾 | ✅ 已落盘并逐条核对,与我的改动**逐字对齐**;但 **task-13(B3)** 会给 `/checkout` 加 `requiresAuth`,可能再生一轮失效 ⇒ 等新清单 |
| D7 | `web/src/**/*.spec.ts`(4 份) | **不在我的写范围** | 按 Lead 裁决 (B) 归 frontend-fix;我只复核(§5.5) |

> D1 与 D2 **必须同时**落地。只做 D1:登录用户从「400」变成「403」(默认拒绝),券入口仍不可用;只做 D2:白名单优先,拦截器不跑,仍是 400。
> `AuthzRegistrationGateTest.whitelistAndAuthzRulesDoNotOverlap` 会保证不会出现「两处都登记」的中间态。

**已向 Lead 回报并由 Lead 裁决的契约问题**:
1. `/checkout/**` 规则缺失 —— **已采纳**为 C0 第二步(删白名单 + 加 `/checkout/** → USER`),并已写入 task-7 rev3。
2. BLK-3 最终状态码 —— **裁决 400**,我保持现状(控制器现有行为,400 是请求参数错误的标准语义)。
3. `POST /account/notifications` —— **裁决:字段名本来就是对的(`emailOrder/emailPromo/smsOrder`),不需要对齐**;真缺陷是缺参数校验,定为 **C6**(三个全缺 → 400)。我此前「字段名不一致」的归因**已作废**,并已把该端点的 5 条用例落成独立测试类(§5.4)。
4. `docs/TASK-002/04-BACKEND-FIX.md` 与 `05-FRONTEND-FIX.md` **仍未落盘** —— 若 D 阶段前落盘,我会按其「预期需同步的测试清单 / 预期失效的 e2e 断言清单」做最终扫尾。

---

## 7. 验证状态(必须如实声明)

| 项 | 状态 |
|---|---|
| 编译(是否 syntax/type 正确) | ❌ **未验证** —— P1 禁进容器;`target/classes` 是 backend-fix 未落地的旧代码,跑 mockMvc 只会得到旧行为,无诊断价值 |
| `mvn -B clean test` | ❌ **未运行** |
| `web/tests` 的 Playwright | ❌ **未运行**(mock 模式;D 阶段随闸门一起跑) |
| 静态自审 | ✅ 逐文件核对过 import、helper 签名、字段名(`emailOrder/emailPromo/smsOrder`、`discountCode`、`couponId` 回传券码、`transaction_no/paid_time`、`payment.order_no` 等) |
| 未改受保护文件 | ✅ 仅 `src/test/**` 与 `web/tests/**`(可用 `git status --short` 复核) |

**可以预期的红(且是正确的红)**:在 D1–D3 落地前,§5 新增的 10 条会失败。这是**契约测试**的应有形态 —— 它们描述的是冻结后的目标态,不是当前态。若 D 阶段它们仍红而实现已落地,则说明契约未真正落实,应立即回报 Lead 而不是改断言。

---

## 8. 新增/改动用例清单(供 D 阶段逐条核对)

### `StorefrontPromoTest`(15 例)
```
[改]  percentCouponBelowCap                          匿名15.00 → 200/15.00
[改]  percentCouponCappedByMaxDiscount               匿名50.00 → 200/50.00
[改]  percentCouponRoundsHalfUpToCents               匿名2.67  → 200/2.67
[改]  fixedCoupon                                    匿名20.00 → 200/20.00+couponId
[改]  fixedCouponAtExactMinOrder                     匿名20.00 → 200/20.00
[改]  belowMinOrderRejected                          409       → 409 + msg
[改]  unknownCouponTypeYieldsZero                    匿名0.00  → 200/0.00
[改判] expiredCouponIsRejected       (原 …IsIgnored)  0.00      → 400 优惠码无效
[改判] disabledCouponIsRejected      (原 …IsIgnored)  0.00      → 400 优惠码无效
[改判] legacyFallbackCodeIsRejected  (原 …StillWorks) 15.00     → 400 优惠码无效
[改判] unknownCodeIsRejected         (原 …YieldsZero) 200/0.00  → 400 优惠码无效
[新]  loggedInWithClaimedCouponGetsRealDiscount      ← BLK-1 锚点
[新]  anonymousPromoIsRejected                       ← C0 锚点
[新]  unclaimedCouponIsRejected
[新]  usedCouponIsRejected
[新]  missingCodeIsBadRequest
```

### 其他
```
[改]  RequestShapeTest        3×token + summaryInvalidItem 409→400
[改]  ErrorModelTest          2×token + promo 缺 subtotal 补 msg=结算金额不能为空
[改]  AuthzRegistrationGateTest  白名单删 /checkout/summary、/checkout/promo
[改]  AuthzRulesTest          USER 放行清单 +2 + 跨域断言 +4
[改]  AddressControllerTest   PUT /addresses/1/default 200→501 + 列表不变
[新]  CheckoutMoneyConsistencyTest   5 例(C0/C1/C3/C4)
[新]  NotImplementedEndpointsTest    5 例(C5 + 副作用为零 + 鉴权不被盖过)
[新]  AccountNotificationContractTest 5 例(2 条正例 + C6 的 2 条 400 + 1 条 C6 边界)
[改]  web/tests/e2e-functional.spec.ts  Tiered Discounts 块 → Cart Money Consistency 2 例
```

---

## 9. 待办(等 Lead 放行)

1. **D 阶段统一跑闸门**(task-10 rev3 的口径):后端 `mvn -B clean test`;前端 `npm test`(= `vue-tsc --noEmit` + `-p tsconfig.test.json` + `vitest run` + `build-prod`)**外加 `npm run lint`(核对无新增告警,`eslint.baseline.json` 不许手工删项)**;然后重启后端 + 真实 HTTP 四项回归(G3/G4 的实测复现)。届时把本文件所有「未验证」替换为原始输出。
2. **BLK-3 最终状态码** —— 已裁决 **400**,`RequestShapeTest` 已按此写定,无需再动。
3. **C2 门槛语义** —— 已裁决 **409 维持**,`StorefrontPromoTest.belowMinOrderRejected` 已钉 409 + msg,无需再动。
4. **task-13(B3)** 会给 `/checkout` 加 `requiresAuth` 并做 4 处 501 的诚实 UI ⇒ **可能再让一轮 `web/tests/**` 的既有 e2e 失效**。等 frontend-fix 的「预期失效清单」,我再扫一遍 7 个 spec。
5. `web/src/**/*.spec.ts` 的缺口(`usePromoCode.spec.ts` 的 `onApplied` 三态覆盖)**已由 Lead 派给 frontend-fix**,我不做。

> 按 Lead 指示:**完成本任务后不立即开工 TASK-002-D**,等容器锁移交通知。

---

## 10. 未覆盖项与诚实边界

| 项 | 状态 | 说明 |
|---|---|---|
| `web/src/**/*.spec.ts`(4 份前端单测) | **由 frontend-fix 同步,我只做内容复核** | 按 Lead 裁决 (B):`web/src/**` 整体归 frontend-fix。我复核了其中 3 份已落盘的内容(结论见 §5.5),但**未亲手编写**,`usePromoCode.spec.ts` 的 onApplied 覆盖派给了 frontend-fix。D 阶段若这 4 份红了,应找 frontend-fix(作者)与我(复核者)对齐 |
| 本文件全部改动的**编译与运行验证** | ❌ 未验证 | P1 禁进容器;权威数字在 D 阶段 |
| `web/tests/**` 其余 6 个 spec 的最终扫尾 | ⏸ 待 task-13 落盘 | `05-FRONTEND-FIX.md` 已静态扫过并判定无引用;但 B3 会加 `/checkout` 的 `requiresAuth`,可能改变 e2e 前置条件 |
| 契约测试的「正确的红」 | ⚠️ 预期存在 | C0/D2、C5、C6 落地前,§5 的部分新用例会红。**不要靠改断言让它变绿** —— 那是契约未落实的信号 |
| 我未自行变更任何契约 | ✅ | 契约 C0–C6 由 Lead 冻结;我发现 `/checkout/**` 规则缺失时是**回报**而非自行实现,BLK-3/C2 的口径也以裁决为准 |
