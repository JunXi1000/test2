# TASK-002-B · 前端修复报告：优惠码透传（BLK-4）+ 购物车金额统一口径（BLK-5）

> **产出人**：前端 Agent（`frontend-fix`） · **任务**：TASK-002-B（共享板 `task-8`） · **契约**：Lead 冻结的 C0–C6（见 [00-AGENT-REGISTRY.md](00-AGENT-REGISTRY.md) §二）
> **写范围**：仅 `web/src/**` 与本文（`docs/TASK-002/05-*`）。**未修改** `src/main/**`、`src/test/**`、`web/tests/**`、`sql/**`、`docker/**`、任何 `docs/*` 契约文档。
> **容器**：P1 阶段按 Lead 指定**未进容器**，也未跑 `npm` / `vue-tsc` / `playwright` —— 本文所有结论均为**静态自审**，权威闸门数字由 qa 在 P2 给出。

---

## 0. 三句话

1. **BLK-4 已闭环**：`code` 现在从结算页**同一个来源**同时发给 `/checkout/summary` 与 `POST /payments/create`；同时**删掉了「同一笔券优惠被减两次」**——`summary.discount` 已是服务端按 code 核销出的权威减免，前端不再叠加 `/checkout/promo` 的回包（旧代码正是靠这一叠加把显示额压到低于实扣）。
2. **BLK-5 已闭环**：`Cart.vue` 的 `SHIPPING_FEE=12` / `TAX_RATE=0.08` / 满减 computed / 合计式 / 运费·税·满减三行模板**全部删除**，金额改走 `/checkout/summary`（与结算页同一口径）。匿名态**不发**该请求（C0 后匿名 401 会被拦截器当成会话失效跳登录），改为只显示本地小计 + 「登录后可见总额」提示。
3. **两处必须让 qa 知道的连带影响**：① 4 个既有 **单测**文件按新契约必然要改（清单见 §5.1，含逐条原因）；② 匿名态购物车不再有 `$ Total` 数字 —— qa 已经把 e2e 的「Tiered Discounts」块重写成「Cart Money Consistency」两条（见 [06a-TEST-SYNC.md](06a-TEST-SYNC.md) §5.3），其断言与我这边**逐字对齐**（§5.2 逐条核对过）。

---

## 1. 契约逐条落实位置

| 契约 | 要求 | 落实位置 | 说明 |
|---|---|---|---|
| **C1** | `/checkout/summary` 请求体支持 `code`；无 code 时 `discount=0` | `web/src/api/modules/checkout.ts:72-99`（签名 + 真实请求体 `{items, zip, code}`） | 空白码归一成 `''`（后端 `isBlank()` 同样按未传处理）；mock 分支与真实分支**同一套券规则**（`findRedeemableCoupon` + `computeCouponDiscount`） |
| **C1** | 响应含 `discountCode` | `web/src/api/modules/checkout.ts:25-26`（类型）、`web/src/composables/useOrderSummary.ts:76-77` | 后端实际会回这个字段（`StorefrontCheckoutController:112`），本批把它写进类型并用于「已应用的码」展示 |
| **C3** | `POST /payments/create` 支持 `code` | `web/src/api/modules/payment.ts:13-20`（payload 类型）、`web/src/composables/usePaymentFlow.ts:67-69,140-142`（payload 赋值） | `code` 取 `Ref<string>`，取「此刻」的值：用户可能在支付前移除/换码 |
| **C4** | `summary.total == payments/create.amount == payment.amount` | `web/src/composables/useOrderSummary.ts:94-96`（`prePointsTotal = subtotal − discount`）、`web/src/composables/usePaymentFlow.ts:138`（`amount: total.value`） | `total = summary.total − pointsDiscount`，积分是**前端**这一层且后端 `create` 也按 `amount` 收，故四方仍有同一基准；券的减免只有一个来源 |
| **C0** | 两个端点移出白名单 ⇒ 匿名 401 | `web/src/pages/Cart.vue:28-43,76-91`（匿名不取数）、`web/src/composables/useCartSummary.ts:18-107` | 详情见 §3.2；**这是本批唯一的契约性约束，已按「回报而不是自创口径」处理** |
| **C6/其他** | — | 未触碰 | 本批不涉及商家/账号端点 |

### 1.1 「减两次」是 BLK-4 的另一半（必须一起修）

只把 `code` 发出去而保留旧的叠加算法，结果是**反方向**的错：`summary.discount` 已经扣了券，前端再减一遍 `promoDiscount`，页面会**多减**一次。

| 位置 | 旧 | 新 |
|---|---|---|
| `useOrderSummary.ts:94-96` | `subtotal − discount − promoDiscount` | `subtotal − discount` |
| `useOrderSummary.ts:142-161`（返回值） | 返回 `promoDiscount` 供页面/模板消费 | **不再返回**（`Checkout.vue` 也不再解构）。这不是「静默变成 undefined」而是**编译期就报**：留着旧消费点会直接 `TS2339` |
| `Checkout.vue` 摘要区 | `tieredDiscount` 与 `promoDiscount` **两行都渲染** | 只渲染一行（`summary.discount`），并注明原因 |
| `Checkout.vue` 落库 `discount` | `summary.discount + promoDiscount` | `summary.discount` |
| `Cart.vue` | `subtotal + shipping + tax − discount − tieredDiscount` | 一律取 `summary` 的 `subtotal/discount/total` |

> 口径边界：`/checkout/promo` 的回包现在**只**用于「You saved $X」那条 toast（`usePromoCode.applyPromo` 内部），不进任何算术、不进任何展示行。

---

## 2. `code` 的完整传递路径

```
① 用户在结算页输入/点选券 → useOrderSummary 内 usePromoCode.promoCode (v-model)
        │
        ├─(点击 Apply / 点券包里的码)→ usePromoCode.applyPromo()
        │        └─ POST /checkout/promo { code, subtotal }   ← 只读校验：拿到折扣额 + 让用户看到反馈
        │             成功 → promoApplied = true; appliedCode = code; onApplied()
        │
        ├─ onApplied()  → useOrderSummary.fetchSummary()
        │        └─ calculateOrderSummary(items, zip, code)
        │              └─ POST /checkout/summary { items, zip, code }   ← 服务端算 discount / total
        │                   返回 { subtotal, discount, discountCode, total }
        │
        ├─ 页面展示：total = summary.subtotal − summary.discount − pointsDiscount
        │            （appliedDiscountCode / tieredDiscount 都取自这一次回包）
        │
        └─ 支付：
             Checkout.vue  paymentDiscountCode = promoApplied ? promoCode.trim() : ''
                   │
                   ├─ useOrderSummary.getCode()      → 同一个 code → /checkout/summary
                   └─ usePaymentFlow.discountCode    → 同一个 code → POST /payments/create
                                                                     （后端据此核销并把减免计入实付）
```

**关键点（BLK-4 的根因面）**

1. **只有一个来源**：`Checkout.vue:169-171` 的 `paymentDiscountCode` 是页面上唯一的「要发的码」，
   `getCode` 与 `discountCode` 都读它。BLK-4 的形状就是「两处各有一套 code 而其中一处为空」。
2. **只有已生效的码才发**：`promoApplied ? trim(promoCode) : ''`。裸输入（用户改了输入框但没点 Apply）
   若被发到 `payments/create`，后端会**真的按它核销**，而页面还显示旧减免 —— 这就是新的「显示额 ≠ 实扣」。
   `usePromoCode` 用 `watch(promoCode)` 做不变式：输入一旦偏离已生效的码，立即作废生效状态（`reset()`），
   并回调 `onApplied()` 让摘要按「无码」重取。
3. **重取时机**：`usePromoCode.onApplied` 在**应用成功 / 用户移除 / 输入偏离导致失效**三种情况下触发
   （`usePromoCode.ts:63-68`、`:100-102`、`:117-122`）。只 watch `promoApplied` 会漏掉「移除」那一半。
4. **契约漂移兜底**：`amount()`（`useOrderSummary.ts:12-16`）把缺失/NaN 的 `subtotal`/`discount` 折成 0，
   避免 `shipping?/tax?` 那类可选字段把应付金额污染成 `NaN`。`shipping`/`tax` 在本批**完全不参与计算**
   （它们是契约里已移除的可选字段）。

---

## 3. 购物车新口径（BLK-5）

### 3.1 删掉的旧代码

| 文件:行（改前） | 旧内容 | 处置 |
|---|---|---|
| `Cart.vue:20-22` | `FREE_SHIPPING_THRESHOLD=200` / `SHIPPING_FEE=12` / `TAX_RATE=0.08` | 删除 |
| `Cart.vue:31-32` | `shipping` / `tax` computed | 删除 |
| `Cart.vue:35-41` | `tiered` / `tieredDiscount` / `nextTier` / `tierProgress`（本地满减引擎） | 删除（`getTieredDiscount` / `getNextTier` 的 import 一并删除；这两个函数本身仍导出，`stores/loyalty.ts` 与 `checkout.spec.ts` 还在用） |
| `Cart.vue:58-63` | `total = subtotal + shipping + tax − discount − tieredDiscount` | 改为取 `summary.total` |
| `Cart.vue:268-301`（改前） | 满减进度卡（「Add $X more to save $Y」/「Max tier unlocked」/进度条） | 删除 |
| `Cart.vue:413-424`（改前） | 运费行 / 税行 / 满减行 | 删除 |
| `Cart.vue` 促销码行 | `discount`（= `/checkout/promo` 回包） | 改为 `tieredDiscount`（= `summary.discount`） |

### 3.2 新口径（`web/src/composables/useCartSummary.ts`，新增）

- **登录态**：`onMounted` → `fetchCartSummary()` → `calculateOrderSummary(items, undefined, code)`
  → `POST /checkout/summary`，页面用回包的 `subtotal` / `discount` / `total`。
  **与结算页同一函数、同一端点**，所以「购物车 / 结算页 / 实扣」三处一致是结构性的，不是靠人工对齐。
  总额只用服务端的两个数相减（`serverSubtotal − discount`），**不经过任何本地镜像** ——
  本地镜像可能因「行内单价过期」而与服务端不同，拿它算总额就又把差额放回来了。
- **匿名态（C0 约束）**：`enabled = authStore.isAuthenticated`，为 false 时**不发请求**。
  页面只显示本地小计（`Σ 单价×数量`，与真实分支回包的 `subtotal` 是同一个量），
  总额位置显示 `—` + `cart.loginForTotal`（“Sign in to see your order total…”）。
  **不发明第二套口径**：这里没有任何运费/税/满减/折扣的本地计算。
- **登录后补取**：`watch(summaryEnabled)` → 登录（含跨标签页）后补一次；登出 `resetSummary()` 清掉上个会话的金额。
- **优惠码**：`usePromoCode.onApplied` → `fetchCartSummary(生效的 code)`；减免额只认回包。
- **三态**：首屏 skeleton（`isSummaryLoading` 且 `enabled`）、失败 `ErrorState` + Retry（带 code 重试）、成功。
- **购物车页也要登录才能用券**：`applyPromoWithAuth()`（`Cart.vue`）先判登录，未登录给 toast + 跳登录，
  而不是让请求打到后端换一个 401（`/checkout/promo` 同样在白名单之外，券又必须证明归属）。

### 3.3 为什么金额还是会「看起来」在匿名态缺失 —— 这是有意为之

旧代码 anonymous 也能显示一个完整金额，但那是**编的**（12 元运费 + 8% 税 + 本地满减）。
C0 之后拿不到服务端金额时，「显示一个可能不对的应付总额」比「明确说登录后可看」更糟 ——
e2e 的匿名用例断言的正是这件事（“这比显示一个假数字诚实”）。

---

## 4. 静态自审（`noUnusedLocals` / 类型自洽逐项核对）

| 检查项 | 结论 |
|---|---|
| 未用 import / computed | 逐文件核对：`Cart.vue` 删掉 `getTieredDiscount`/`getNextTier` 后 `Tag` 仍在模板中使用；`Tag`→促销码行、`Skeleton`→摘要骨架；`getTieredDiscount`/`getNextTier`/`DISCOUNT_TIERS` 在 `checkout.ts` 中**仍被 export 且被 `stores/loyalty.ts` 与单测使用**，不算未用 |
| `useOrderSummary` 解构是否与返回一致 | 返回 `summary, isLoading, error, fetchSummary, promoCode, promoApplied, tieredDiscount, appliedDiscountCode, pointsToUse, pointsUsable, maxPointsToUse, pointsDiscount, prePointsTotal, total, applyPromo, removePromo`；`Checkout.vue` 只解构其中存在的键，**不再解构 `promoDiscount`** |
| `Checkout.vue` 是否残留 `promoDiscount` | 已零引用（含模板） |
| `usePaymentFlow.discountCode` 是否必填 | 必填 `Ref<string>` —— 新调用点（Checkout）已传；`usePaymentFlow.spec.ts` 的 `makeOptions()` 未传 ⇒ **会在类型检查报错，属预期**，见 §5.1 |
| `useOrderSummary.getCode` 是否必填 | 必填 `() => string` —— `useOrderSummary.spec.ts:50` 的调用点未传 ⇒ **预期报错**，见 §5.1 |
| `shipping?/tax?` 可选语义 | 只在 `Checkout.vue:245-246` 落库时按 `Number(x) || 0` 兜底；**不参与**任何应付金额计算（`prePointsTotal` 里没有它们） |
| `discountCode?: string \| null` | `OrderSummary` 里标可选（旧响应可能没有），消费处 `summary.value.discountCode \|\| ''` 归一成串 |
| 页面是否直写 axios | 没有；`Cart.vue` / `Checkout.vue` 的请求都经 `api/modules/*` → `api/http.ts` |
| 新增 i18n key | 只加了 `cart.loginForTotal`（`en.ts:221`），与 e2e 断言文案逐字一致 |
| 新增文件 | `web/src/composables/useCartSummary.ts`（购物车专用小组合式，不引 axios、不进 store） |

> ⚠️ 特别说明一处**看似 TDZ 的写法**：`Checkout.vue` 里 `useOrderSummary({ getCode: () => paymentDiscountCode.value })`
> 引用了下一行才定义的 `paymentDiscountCode`。`getCode` 只在 `fetchSummary()` **执行时**读取它，而
> `fetchSummary` 最早在 `onMounted` 里调用，届时已初始化（`vue-tsc` 的 `no-use-before-declare` 不在
> 本项目 tsconfig 里）。这样写是为了让 code 真正只有一个定义点，而不是为了少写一行。

---

## 5. 连带影响：**qа 必须同步的清单**

### 5.1 按新契约必然要改的既有**单测**（`web/src/**/*.spec.ts`，我只列出，未改）

| 文件:行 | 旧断言 | 为什么必红 |
|---|---|---|
| `composables/useOrderSummary.spec.ts:50` | `useOrderSummary({ items, getZip })` | 新签名要求 `getCode`（必填）⇒ **类型检查报错**（TS2345/TS2741） |
| 同上 `:214,218` | `toHaveBeenLastCalledWith(ITEMS, '12345')` | 现在是**三参**调用 `(items, zip, code)` ⇒ 断言不匹配 |
| 同上 `:112,255,292` | `api.promoDiscount.value` | 该字段**已从返回值移除** ⇒ 类型 + 运行期都红 |
| 同上 `:105-114`（“优惠码与满减**可叠加**”） | `total = 100 − 15 − 10 = 75` | **这条断言描述的是被本批删除的错误行为**：`summary.discount(15)` 已含券，再减 `promoDiscount(10)` 就是减两次。新口径 `total = 85`（`summary` 回包 `discount:15`）。**不要为了让它绿而恢复叠加** |
| 同上 `:282-295`（“移除：折扣跟着回退”） | 移除后 `total = 100` | 仍成立，但 `promoDiscount` 那行要删 |
| `api/modules/checkout.spec.ts:113-169` | 6 条断言 mock 的 `shipping:12 / tax:8% / discount:<满减档>` | mock 分支**不再造运费/税/满减**，改回 `{subtotal, discount, discountCode, total}`（无效码 `discount:0, discountCode:null`） |
| 同上 `:115,126,136-137,143-144,152,162` | `calculateOrderSummary([item])` 两参 | 现在是**三参**（`code` 必填）⇒ 类型检查报错 |
| `composables/usePaymentFlow.spec.ts:46-65` | `makeOptions()` 不含 `discountCode` | 新选项必填 ⇒ **类型检查报错**；支付 payload 断言建议补 `expect(payload.code).toBe('')` 与一条「带码」用例 |

> 口径建议（供 qa / Lead 决定，不属于我的写范围）：`promoDiscount` 现在是 `/checkout/promo` 的只读回包，
> 只服务那条 toast。若认为它无用，可连同 `usePromoCode` 的返回值一起删；若保留，**不要**在任何算术里用它。

### 5.2 e2e 失效清单（**已与 qa 的 [06a-TEST-SYNC.md](06a-TEST-SYNC.md) §5.3 逐字核对**）

我删除的 UI 元素会让**旧断言**失效，而 qa 已经把它们重写成新断言 —— 下面是逐条对照，**当前 e2e 期望与我的实现一致**：

| 旧断言（失效） | 现在页面的真实状态 | qa 的新断言 | 我的实现是否满足 |
|---|---|---|---|
| `text=/Tiered discount/i` 可见 | 登录态且券生效时**仍会**出现（标签沿用 `cart.tieredDiscount`，值是 `summary.discount`）；无券时不可见 | `toHaveCount(0)`（用例不加券） | ✅ 满足 |
| `text=/more to save\|Max tier unlocked/i` 可见 | **永久消失**（满减进度卡已删） | 未再断言（换成「三行都不在」） | ✅ 满足 |
| `text=/\^Tax \(/i`（税行） | **永久消失** | `toHaveCount(0)` | ✅ 满足 |
| `text=/^Shipping$/i`（运费行） | **永久消失** | `toHaveCount(0)` | ✅ 满足 |
| xpath `//span[text()="Total"]/following-sibling::span` 是数字 | 登录态是数字；**匿名态是 `—`** | 登录态用例先 `seedLoggedIn`，匿名用例改用 `text=/Sign in to see your order total/i` | ✅ 满足（文案见 `en.ts:221`） |
| `Promo code` 行与 `Tiered discount` 行同时可见（叠加） | 只剩**一行**减免 | 已删该用例 | — |
| `features.spec.ts:274-278`「Cart page renders」（`/Cart\|Shopping\|bag\|empty\|subtotal/i`） | 未受影响 | — | ✅ 仍满足 |
| `e2e-functional.spec.ts:498-501`「`text=/Subtotal/i` 可见」 | 小计行仍在（标签 + 值） | — | ✅ 仍满足 |

**其余 6 个 spec 我静态扫过**：`admin-lists` / `main-flow` / `messages` / `product-gallery` / `product-reviews` / `features`
**没有**引用购物车运费/税/满减/`Total` 字样（`main-flow` 的 `gotoCheckoutAndFillShipping` 是结算页表单 helper，与本次 DOM 改动无关）。

### 5.3 仍需 qa 关注的两点

1. **匿名态购物车不再有数字 Total** —— 若某个我没扫到的用例断言了它，应改成断言登录提示（而不是让我把本地自算加回来）。
2. **Cart 页现在需要「登录」才显示总额**，e2e 必须 `seedLoggedIn`（写 `nexus_user` + `nexus_token` + `RUNTIME_USE_MOCK`）——
   qa 的 `seedLoggedIn` 正是这个形状，且我的 `enabled` 读的是 `authStore.isAuthenticated`（`token && user` 同时存在才为真）。

---

## 6. 验证状态（必须如实声明）

| 项 | 状态 |
|---|---|
| **容器** | ❌ **未进容器**（P1 归 backend-fix，按 Lead 指定） |
| `npm` / `vue-tsc` / `playwright` | ❌ **未运行**（P1 禁止；P2 由 qa 统一跑） |
| `vue-tsc` 零错误 | ❌ **未验证** —— 见 §5.1：**已知会有 4 个既有 spec 报错**，它们是「按新契约待同步」的红，不是生产代码的红 |
| 构建 / 运行 | ❌ 未验证 |
| 静态自审 | ✅ 逐文件核对 import 是否仍被使用、解构键与返回键一致、`shipping?/tax?` 按 0 处理、i18n key 与 e2e 文案逐字一致（§4） |
| 未改受保护文件 | ✅ 仅 `web/src/**` 与本文；未碰 `src/main/**`、`src/test/**`、`web/tests/**`、`sql/**`、`docker/**`、契约文档 |
| HTTP 层四方一致（C4） | ❌ 未验证 —— 属 TASK-002-D 的容器回归（`CheckoutMoneyConsistencyTest`） |

**可以预期的红（且是正确的红）**：§5.1 列出的 4 个单测文件在 qa 同步前会红。若 P2 出现**其它**文件报错，
或 `web/src` 生产代码报错，那是我的实现问题，请直接回派给我。

---

## 7. 改动文件清单（供 D 阶段逐文件核对）

```
[改] web/src/api/modules/checkout.ts        OrderSummary 契约（discountCode / discount 语义）+ calculateOrderSummary 三参 + 真实请求带 code + mock 去掉运费/税/满减
[改] web/src/api/modules/payment.ts         PaymentCreatePayload.code?: string（后端据此核销）
[改] web/src/composables/usePromoCode.ts    + onApplied 回调；+ appliedCode 不变式（输入偏离即作废生效态）
[改] web/src/composables/useOrderSummary.ts + getCode 选项；不再返回 promoDiscount；prePointsTotal 不再减券；+ appliedDiscountCode
[改] web/src/composables/usePaymentFlow.ts  + discountCode 选项；payload 带 code
[新] web/src/composables/useCartSummary.ts  购物车金额唯一来源（/checkout/summary）+ 匿名不取数 + 三态
[改] web/src/pages/Checkout.vue             paymentDiscountCode 单一来源；减免只渲染一行；落库 discount 只取 summary
[改] web/src/pages/Cart.vue                 删运费/税/满减自算与三行模板与进度卡；金额改走 useCartSummary；券需登录
[改] web/src/i18n/locales/en.ts             + cart.loginForTotal
```

**未改**：`web/tests/**`（qa 独占）、`src/main/**`、`src/test/**`、任何契约文档。

---

## 8. 待 Lead / qa 裁决（不自行决定）

1. **`promoDiscount` 是否保留**：它现在只是 `/checkout/promo` 回包 + 一条 toast 的载体。保留（零算术用途）或一并删除，请裁决。
2. **4 个单测的同步**（§5.1）：这些 spec 在 `web/src/**`（我的写范围），但按分工应由 qa（TASK-002-C）统一改断言。如果需要我改，请明确下令，我会按 §5.1 的「新口径」逐条改并把改动限制在这 4 个文件。
3. **匿名态购物车的产品口径**：现在是「小计 + 登录后才能看总额」。若产品要求匿名也显示总额，则需要放宽 C0（把 `/checkout/summary` 留在白名单）—— 那是**契约变更**，我不自行处理。

> **上述 3 条已在后续轮次裁决完毕，结论见 §9 / §10**：① 保留 `promoDiscount` 但**零算术/零展示用途之外**（§9.1 修正了本条对「保留」的实现方式）；② 4 个 spec 归 `web/src/**`，**由我完成**（§9）；③ 匿名购物车方案接受，**不放宽 C0**（§10.1）。
> 另：§7 里写的「不再返回 `promoDiscount`」在 B2 已按裁决改为**保留返回**（理由见 §9.1），以 §9.1 为准。

---

## 9. B2：4 个 spec 的改动清单与理由

> **触发**：`web` 的真实闸门是 `npm test` = typecheck（两个 project）+ lint + test:unit，而 `src/**/*.spec.ts`
> **同时**被 `tsconfig.json` 类型检查 ⇒ 这 4 个文件会**同时**打断 typecheck 与 test:unit。
> **底线（Lead 明确）**：不得为了让旧断言变绿而把已删除的错误语义（券+满减叠加、自算运费/税）恢复。

| # | 文件 | 改动 | 为什么必须改（不是"让测试适应代码"） |
|---|---|---|---|
| 1 | `api/modules/checkout.spec.ts` | 重写 `calculateOrderSummary` 的 mock 用例块：全部改三参调用；断言 `{subtotal, discount, discountCode, total}`；**显式断言不含 `shipping`/`tax`**；新增「带 code」「大小写不敏感」「空白码」「未知码」「小计为 0 不出现负数」 | 旧 6 条断言的正是**被删除的 mock 行为**（12 元运费门槛 + 8% 税 + 本地满减档）。旧 mock 与真实 `ProductOrderServiceImpl` 完全相反：真实分支只有「DB 价 × 数量 − 券减免」。留着它等于把 BLK-5 的口径写在测试里当预期 |
| 1b | 同上（**新增**，不在 Lead 清单里） | 「同一个码：`summary.discount` 与 `promo.discount` 相等（两处口径同源）」——遍历 SAVE10/SAVE20，断言两条路径减免相等且 `total == subtotal − discount` | BLK-4 的形状就是「summary 收不到 code（discount 恒 0）、promo 单独算一份」。这条把两条路径**钉成同一个数**，只改其中一条就会红 |
| 2 | `composables/useOrderSummary.spec.ts` | ① `setup()` 补必填 `getCode`；② 原「优惠码与满减**可叠加**」改判为 BLK-4 钉子：**只减 `summary.discount`**（`total=85`，不是 75）；③ 新增「应用成功会把码发给 summary（onApplied → 重取）」；④ 「移除」用例改为 `mockResolvedValueOnce({discount:10,total:90})` + `await nextTick()`，对齐「减免来自服务端回包」；⑤ 补回「小计用 getter 取」用例，并把其中的 `promoApplied.value = false` 手改改成走公开路径 `removePromo()` | ②是最关键的一条：旧断言 `100 − 15 − 10 = 75` **正是 BLK-4 的减法算错**（同一笔券优惠被减两次）。③钉住 `onApplied` → 重取 → **这次带上了码**。⑤原来靠手改内部状态绕过重复应用守卫，与页面真实路径脱节 |
| 3 | `composables/usePaymentFlow.spec.ts` | ① `makeOptions()` 补必填 `discountCode: ref('')`；② 原 payload 用例补 `expect(payload.code).toBe('')`；③ **新增**「用券：把生效的码发给 `/payments/create`」 | 漏发 `code` 就是「页面显示了优惠、扣款不优惠」。必填项让它成为**编译期**就能抓住的错，而不是靠人记得 |
| 4 | `composables/usePromoCode.spec.ts` | 原 7 条**未动**（复核后仍全绿）；**新增一个 describe**：`onApplied` 的三种触发情形（应用成功 / 用户移除 / 已生效后改写输入框导致作废）+ 两条反例（无效码不触发、未生效时改写不触发）；补 `nextTick` 导入 | `onApplied` 是 B1 为「页面显示旧减免、后端按新码核销」加的不变式。上层若只 `watch(promoApplied)` 会漏掉「移除」，只在 `applyPromo` 里回调会漏掉「输入偏离」—— 两种漏法都会让页面留着与实扣不符的减免 |

**§9.1 `promoDiscount` 的处置（Lead 裁决：保留）**

B1 里我把它从 `useOrderSummary` 的返回值中删掉了；B2 按裁决**恢复返回**，但把它钉成「只承载 toast 文案」：

- `useOrderSummary.ts:147-154` 的返回值注释写明「**不参与算术、不进模板**」；
- `Checkout.vue` **仍然不解构它**（页面里零引用，模板里的减免行用 `tieredDiscount` = `summary.discount`）；
- `useOrderSummary.spec.ts` 里断言 `api.promoDiscount.value === 10` 与 `total === 85` **同时成立** —— 这正是「回包有值但不影响算术」的钉子。

**为什么值得花一条断言钉这个**：BLK-4 的根因是「同一笔券优惠有两个来源」。只要 `promoDiscount` 还在返回值里，
就存在被误用的可能；这两条并存的断言把「它存在、但它不影响钱」变成可执行的约束。

**§9.2 覆盖不到的边界（如实说明）**

`calculateOrderSummary` 的 mock 分支对**未知券码**返回 `discount: 0`，而真实分支是 **400**（后端 `applyByCode` 校验失败）。
两者在这条路径上仍不一致 —— mock 是纯函数，拿不到「领取/已用」状态，无法完整模拟。
缓解：调用方在 `usePromoCode.applyPromo` 里**先**调 `applyPromoCode`，拿不到折扣就不会标记已应用、也就不会走到带码取摘要，
所以该分支在正常流程中不可达（已写进 spec 的用例标题与注释）。**这条差异留给 D 阶段：若真实后端在「券合法但未领取」等态下让结算页显示
错误态而不是退回原价，那需要产品口径裁决（是"静默降级"还是"明确报错"），我不自行决定。**

---

## 10. B3：匿名守卫 + 4 处 501 的诚实 UI

### 10.1 匿名守卫（选「给 `/checkout` 加 `requiresAuth`」）

**改动**：`web/src/router/index.ts:174-193` —— `Checkout` 路由（`:190`）加 `meta: { requiresAuth: true, role: 'user' }`；
`/cart`（`:169-173`）**保持公开**。

**为什么这是修错误流程而不是"顺手收紧"**：`/checkout/summary` 与 `/checkout/promo` 已按 C0 移出白名单 ⇒ 匿名调用 **401**，
而 `api/http.ts:41-61` 的 401 拦截器把 401 当作**会话过期**处理：清 token → `notifyUserScopeChange()` → 跳登录。
于是匿名访客只要打开结算页，就会被当成"登录过期"踢出去（且本地数据被降级到 guest 作用域）。
路由守卫本来能在**发请求之前**干净地跳 `?redirect=/checkout`（`router/index.ts:315-320` 已有这条路径）。
**守卫做这件事比拦截器的副作用小、也准确得多** —— 这正是 Lead 指出的不变式：

> 匿名访问 `/cart` 与 `/checkout` 都不得对非白名单端点发起请求，且不得出现"访客被当成会话过期用户"的流程。

- `/checkout`：由守卫拦在组件挂载**之前** ⇒ `fetchSummary()` 根本不会执行。
- `/cart`：保持公开，`useCartSummary.enabled` 为 false 时不取数（B1 已做），页面只显示本地小计 + 登录提示。
- 角色限 `user`：结算/支付是买家动作，商家/管理员账号没有买家购物车（与 `dashboard` 的 `role: 'user'` 一致），
  避免他们误入后连环吃到 401/403。

**未选的另一方案（在取数前统一判登录）为何不够**：它只能挡住"请求"，挡不住"匿名用户看到一整张结算表单却在最后一步被踢"；
而且结算页有多个取数点（`useOrderSummary` / `useCompleteTheLook` / `useSavedCards` / `useCheckoutForm`），
逐个加守卫是"每个新取数点都要记得加"的形态，漏一个就复发。路由是**单点**。

### 10.2 4 处 501 的诚实 UI

**契约事实**（已核对后端源码）：
`AdminApiController:459-461`（`PUT /admin/settings`）、`MerchantApiController:282-285`（`POST /merchant/wallet/withdraw`）、
`MerchantApiController:314-317`（`PUT /merchant/settings`）均抛 `HttpStatus.NOT_IMPLEMENTED`；
`GET /admin/settings` / `GET /merchant/settings` **仍可读**。`PUT /addresses/{id}/default` 同样 501，但
`pages/dashboard/Addresses.vue` **不在本轮指派范围**（Lead 只指派了 3 个页面，见 §10.4 待确认项）。

**新增 `web/src/composables/useWriteEndpointAvailability.ts`**：给出 `isWriteImplemented` 与 `notImplementedHint`。
判定口径是「**这个端点在本环境是否有实现**」，而不是「按钮永不可用」：

| 环境 | 写端点行为 | UI |
|---|---|---|
| 真实后端 | 必 501 | **禁用 + 说明**（诚实：存不进去就别说存上了） |
| mock（`RUNTIME_USE_MOCK`） | `adminSettings.ts:24-27` 等本地改内存并返回成功 | 保持可保存 —— 那是**演示/联调**的模拟实现，不是对用户撒谎；钉死会让 mock 与 e2e 下的功能整块失效 |

**逐页改动**：

| 页面 | 改动位置（改后行号） | 具体做法 |
|---|---|---|
| `pages/admin/Settings.vue` | `:26-28`（按钮 `:disabled` + `:title`）、`:38-49`（`data-testid="admin-settings-write-unavailable"` 提示条）、`:120`（图标导入）、`:129`（组合式）、`:154-180`（`handleSave`） | 禁用 Save + 暗色可读的提示条（admin 是**永久暗色域**：恒挂 `.dark`、零 `dark:` 变体，故用无前缀配色 `text-amber-200/90`）；`handleSave` 里再挡一次，避免将来有人摘掉 `disabled` |
| `pages/merchant/Settings.vue` | `:18-20`（按钮）、`:31-41`（提示条）、`:435`（图标）、`:453`（组合式）、`:596-620`（`handleSave`） | 同上（该页有亮/暗两套，提示条带 `dark:` 变体 `text-amber-700 dark:text-amber-300/90`） |
| `pages/merchant/Wallet.vue` | `:16-21`（入口按钮）、`:32-42`（提示条）、`:402-409`（提交按钮）、`:432`（图标）、`:454`（组合式）、`:828-870`（`handleWithdraw`） | 入口与提交都禁用 + 说明；`handleWithdraw` 里的 `catch (e)` 改为 `toErrorMessage(e, …)` —— 原来吞掉原因，用户只看到 'Withdrawal failed'，而后端 501 的具体说明（"提现尚未实现…"）就在 `e.message` 里 |

**页面区分「读得到但写不了」**：三页的**表单/余额/流水照常渲染**（GET 未降级），只有写动作被禁用并在原位说明原因 ——
用户看到的是"数据在、功能没开"，不是"页面坏了"。

**遵守 `web/CLAUDE.md`**：提示只用 `useToast`（未引入 `ElMessage`；`Wallet.vue` 里 `ElMessageBox` 是既有用途，未动）；
错误文案走 `toErrorMessage(e, 兜底)`；未新增运行时依赖；未改其它业务语义。

### 10.3 预期需要 qa 同步的 e2e 清单（**未改 `web/tests/**`**）

| 用例 | 现状 | 加 `requiresAuth` 后的结果 | 建议改法（由 qa 决定） |
|---|---|---|---|
| `web/tests/features.spec.ts:283-289`「Checkout page redirects to cart when empty」 | `gotoApp(page, '/checkout')` **匿名**，断言 url 落到 `/cart` | **会红**：匿名被守卫送到 `/login?redirect=/checkout` | 要么先 `seedSession(登录态)` 再断言"空车 → `/cart`"（保留原意图），要么改成断言"匿名 → 登录页 + `redirect=/checkout`"（把那两条不变式钉住） |
| `web/tests/e2e-functional.spec.ts:1022,1065`（`toHaveURL(/checkout/)`） | `prepareCheckout()` **先登录** | ✅ 不受影响 | — |
| `web/tests/e2e-functional.spec.ts:54-74,100-109`（`prepareCheckout`/`goCheckout`） | 都经 `loginAsUser` | ✅ 不受影响 | — |
| `web/tests/main-flow.spec.ts:59-78,187`（`gotoCheckoutAndFillShipping` + `pathname === '/checkout'`） | `seedSession(page)` 默认**已登录** | ✅ 不受影响 | — |
| 其余 5 个 spec（`admin-lists` / `messages` / `product-gallery` / `product-reviews`） | 无 `/checkout` 直连 | ✅ 不受影响 | — |
| 新 UI 的选择器 | 无既有断言 | 无 | 若要加断言，用 `data-testid="admin-settings-write-unavailable"` / `"merchant-settings-write-unavailable"` / `"wallet-withdraw-unavailable"`（L1 已埋好） |

> 单测侧无需 qa 同步：B3 未改任何 `*.spec.ts`；`useWriteEndpointAvailability` 是本轮新增、尚无 spec。
> 若 qa 想补，钉「`RUNTIME_USE_MOCK=false` ⇒ `isWriteImplemented=false`、提示非空」两条即可。

### 10.4 B3 的未验证声明与待确认项

| 项 | 状态 |
|---|---|
| 容器 / `npm` / `vue-tsc` / `vitest` / `playwright` | ❌ **全部未运行**（P1 纪律）：B3 的结论均为静态自审 |
| `reactive(RUNTIME_USE_MOCK)` 在真实构建下的取值 | ✅ 静态确认：`config/env.ts` 中 `RUNTIME_USE_MOCK` 是 ref，`vite define` 把 `VITE_USE_MOCK=false` 编译成字面量 ⇒ 真实后端下 `isWriteImplemented=false` |
| 禁用态的可访问性 | ⚠️ 用 `:title` 提供原因（原生 tooltip）。**未**改用 `el-tooltip`/ARIA 描述 —— 那会扩大改动面；如需，请派工 |
| mock 模式下 501 路径不可达 | ⚠️ 有意为之（见 10.2 表）。若 Lead 认为 mock 也应"诚实地失败"，改法是把三个 api 模块的 mock 分支去掉，**但那会改变 mock 契约**，需你裁决 |
| `pages/dashboard/Addresses.vue` 的 `setDefault`（同样 501） | ⚠️ **未改** —— Lead 本轮只指派了 3 个页面。需要一并诚实时请派工（同一组合式可直接复用） |

---

## 11. 交付清单（B1 + B2 + B3）

```
[B1 生产代码]
[改] web/src/api/modules/checkout.ts        OrderSummary 契约 + 三参 + 真实请求带 code + mock 去掉运费/税/满减
[改] web/src/api/modules/payment.ts         PaymentCreatePayload.code?: string
[改] web/src/composables/usePromoCode.ts    + onApplied 回调；+ appliedCode 不变式
[改] web/src/composables/useOrderSummary.ts + getCode 选项；prePointsTotal 不再减券；+ appliedDiscountCode
[改] web/src/composables/usePaymentFlow.ts  + discountCode 选项；payload 带 code
[新] web/src/composables/useCartSummary.ts  购物车金额唯一来源 + 匿名不取数 + 三态
[改] web/src/pages/Checkout.vue             paymentDiscountCode 单一来源；减免只渲染一行；落库 discount 只取 summary
[改] web/src/pages/Cart.vue                 删运费/税/满减自算与三行模板与进度卡；金额改走 useCartSummary；券需登录
[改] web/src/i18n/locales/en.ts             + cart.loginForTotal

[B2 单测同步]
[改] web/src/api/modules/checkout.spec.ts          mock 用例块重写 + BLK-4 跨路径一致性钉子
[改] web/src/composables/useOrderSummary.spec.ts    getCode / 取消叠加 / onApplied 重取 / 小计 getter 走公开路径
[改] web/src/composables/usePaymentFlow.spec.ts     discountCode 必填 + payload.code 断言 + 带码用例
[改] web/src/composables/usePromoCode.spec.ts       + onApplied 三种触发情形（原 7 条未动）

[B3 守卫 + 诚实 UI]
[改] web/src/router/index.ts                        /checkout 加 requiresAuth + role: 'user'
[新] web/src/composables/useWriteEndpointAvailability.ts  写端点可用性判定（真实后端 vs mock）
[改] web/src/pages/admin/Settings.vue               禁用保存 + 提示条 + toErrorMessage
[改] web/src/pages/merchant/Settings.vue            同上（含 dark: 变体）
[改] web/src/pages/merchant/Wallet.vue              禁用提现入口/提交 + 提示条 + toErrorMessage
```

**未改**：`web/tests/**`（qa 独占）、`src/main/**`、`src/test/**`、`sql/**`、`docker/**`、任何契约文档。

---

## 12. 最终验证状态（B1+B2+B3 合并口径）

| 项 | 状态 |
|---|---|
| 容器 / `npm run typecheck` / `test:unit` / `lint` / `build-prod` | ❌ **全部未运行**（P1 纪律，由 qa 在 P2 统一跑） |
| 静态自审 | ✅ 逐文件核对：import 是否仍被使用、解构键与返回键一致、`shipping?/tax?` 按 0 处理、`onApplied` 可选而 `getCode`/`discountCode` 必填、新增图标/组合式均已导入且被引用、三页的 `toast` variant 合法、B1 的 e2e 文案与 `en.ts` 逐字一致（§9/§10.3） |
| 已删除的错误语义是否被恢复 | ✅ **没有**：券+满减叠加、自算运费/税、mock 运费门槛三条全部保持删除并在 spec 里显式断言反向（§9 表 1、2） |
| 未改受保护文件 | ✅ 仅 `web/src/**` 与本文 |

**预期会红的项（且是正确的红）**：仅 `web/tests/features.spec.ts:283-289`（匿名 `/checkout` 现被守卫送去登录页，见 §10.3）。
另需注意 §9.2 的 mock-vs-真实 400 差异（正常流程不可达）。若 P2 出现**其它**失败，尤其 `web/src` 生产代码报错，请直接回派给我。

---

## 13. G1（task-14）：BLK-E1 闭环 + 4 条 Minor

> 结论先行：**BLK-E1 已闭环** —— 结算页「应付总额」不再由前端算任何一步，只消费服务端
> `summary.total`；积分已**完全退出**应付口径（同时退出 UI 入口）。本轮未进容器、未跑任何
> `npm`/`vue-tsc`/`vitest`，闸门由 qa 在 TASK-002-H 复跑。

### 13.1 BLK-E1：应付总额改为消费服务端权威值

| 位置（改后） | 改动 | 为什么 |
|---|---|---|
| `composables/useOrderSummary.ts:87` | `const total = computed(() => amount(summary.value.total))` | 旧实现是 `prePointsTotal − pointsDiscount`，即**前端自算一步**且减掉了积分；后端 `src/main` 里没有任何积分/抵扣概念（`StorefrontCheckoutDTO` 只有 `code`），于是「页面显示额 < 实际扣款」（G4 不成立） |
| `composables/useOrderSummary.ts:75-86` | 注释明确「**刻意没有 fallback 算式**」 | 连 `subtotal − discount` 这种"看起来一样"的兜底都不写：那正是两条口径重新分叉的入口（BLK-4/BLK-E1 都从"两处各算一份"长出来） |
| `composables/useOrderSummary.ts:41-48`（类注释） | 口径从"三层折扣"收敛为"只有服务端一层" | 文档与实现一致，避免下一个人照着旧注释把积分接回来 |
| `composables/useOrderSummary.ts` 返回值 | **删除** `prePointsTotal` / `pointsToUse` / `pointsDiscount` / `maxPointsToUse` / `pointsUsable`；删除 `useAuthStore` / `useLoyaltyStore` / `POINTS_PER_DOLLAR` / `watch` 的 import | `prePointsTotal` 只是"再减一层积分"的接口；留着它就等于把 BLK-E1 的导线留在原地。集成商侧已无消费者（`Checkout.vue` 是唯一调用点） |
| `pages/Checkout.vue:138-156`（解构） | 不再解构任何积分状态，并注明原因 | 页面级也断掉入口 |
| `pages/Checkout.vue:313-322`（`finalizeOrder`） | **删除** `if (pointsToUse.value > 0) loyaltyStore.spendPoints(...)`；保留 `recordSpend`/`earnPoints`（用的是权威 `total`） | 这是 BLK-E1 的**第二个资损面**：积分抵扣既然不生效，再扣用户余额就是纯亏损（少余额、不少钱）。返积分/累计消费只增不减，保留 |

**为什么 `total` 不写 fallback**：契约里 `total` 是必填字段，后端控制器无条件返回
（`StorefrontCheckoutController:107-113`）。`amount()` 只把「字段缺失/NaN」折成 0，
与改造前的行为一致（旧实现同样会得到 0），不是新引入的风险。见 §13.5 残余项。

### 13.2 积分入口的处理：**整块下线抵扣输入**（不是"保留输入但不参与计算"）

在 `pages/Checkout.vue:1052-1078` 把可用的抵扣输入框（含 "Use Max"、已抵扣行、`pointsApplied` 行）
整块替换为**只读说明**：显示余额（`pointsAvailable`）+ 新增文案 `checkout.pointsNotRedeemable`
（"Redeeming points is not available yet, so they cannot be applied to this order. Your balance is
kept, and you will still earn points from this purchase."），并在 `en.ts:336-337` 落地该 key。

**理由（三选一里为什么选"整块下线"）**：
1. 后端不认积分 ⇒ 任何可交互的抵扣控件都只能产出假象；
2. "保留输入但不参与计算"会自相矛盾：total 不变而输入框显示已抵扣，用户看到的是**又一次**
   "显示与实扣不一致"；
3. 保留这套 state（`pointsToUse` 等）等于把 BLK-E1 的导线留在原地 —— 加回 total 只需一行。
   而"零消费者 + 零状态"让**加回积分抵扣必须显式新增代码**，而不是顺手改一行。

保留的：积分**只读余额**展示、下单后的**返积分**（`earnPoints`）与累计消费、洛亚尔提页/积分商城的
「用积分为券」路径（那是另一套机制，未受影响）。**不做**的事：不给后端加积分字段（新功能，§八）。

### 13.3 4 条 Minor

| Minor | 位置（改后） | 改动 |
|---|---|---|
| **MIN-E1** 小计 fallback 判据不一致 | `pages/Cart.vue:407-412`（模板）、`useCartSummary.ts:87-101`（返回） | 模板不再写 `serverSubtotal \|\| summarySubtotal`，改用组合式内部唯一判据（`serverLoaded ? 服务端 : 本地镜像`）；**同时把 `serverSubtotal` 从返回值里摘掉** —— 只要它还对外开放，下一个人就会再写出第二条判据 |
| **MIN-E2** 两处请求形状不一致 | `api/modules/checkout.ts:77`（`zip: string`）、`useCartSummary.ts:70-72`（传 `''`） | 签名从 `string \| undefined` 收紧为 `string`；购物车显式传空串、结算页传 `formData.zip` ⇒ 两个调用点都是 `{items, zip, code}`。`checkout.spec.ts` 里 8 处 `undefined` 同步改 `''`，并新增一条"两种 zip 都能算"的断言 |
| **MIN-E3** 用 mock 开关代理"端点是否有实现" | `composables/useWriteEndpointAvailability.ts:33-36` | 改名为 `hitsRealBackend`（依据 = 写请求是否会真的出网），并在 `:16-27` **显式记录已知偏差的两种分叉组合**（「真实后端 + `RUNTIME_USE_MOCK=true`」＝UI 放行但写请求被本地 mock 顶掉，不是 501 也不是真保存；以及将来有模块改用 build-time `USE_MOCK` 的情形），并给出届时的正确做法（以端点能力为准）。三个页面的点击处理里保留了二次守卫，所以即便分叉也不会静默"成功" |
| **MIN-E5** spec 里 `total: 115` 与契约不自洽 | `composables/useOrderSummary.spec.ts:52-56` | `BASE_SUMMARY.total` 改为 `100`（= `subtotal − discount`），并在注释里说明：刻意让 `shipping/tax` 非零且 `total ≠ subtotal+shipping+tax`，好让"前端有没有重算"一眼可判 |

> ⚠️ MIN-E3 的一处事实更正（附证据）：task-14 描述里"真实后端 + `RUNTIME_USE_MOCK=true` 时点了才吃 501"
> 对这三处写端点**不成立** —— `adminSettings.ts:24`、`merchantSettings.ts:52`、`merchantWallet.ts:83`
> 都是**先判 `RUNTIME_USE_MOCK` 再发请求**，为 true 时请求根本不出网（本地模拟返回成功）。
> 那个组合的真实后果是「UI 放行 + 本地假成功」，不是 501。我按这个事实改了注释与命名，
> 评审若仍要求"直接问端点能力"，请派工（需要探测/缓存机制，属新增行为）。

### 13.4 新 spec 钉子（G1）

| 钉子 | 位置 | 钉什么 |
|---|---|---|
| **服务端权威优先于任何前端算式** | `useOrderSummary.spec.ts:118-137` | 造一个 `subtotal − discount = 85` 但服务端 `total = 99` 的回包，断言页面值是 **99**。任何"看着对"的重算接回来都会红 —— 这是 BLK-E1 最直接的判别用例 |
| **积分不影响应付额** | `useOrderSummary.spec.ts:200-210` | 登录 + 余额 9,999,999 ⇒ `total` 仍等于服务端 100 |
| **抵扣接口不再存在** | `useOrderSummary.spec.ts:212-228` | `expect(api).not.toHaveProperty(...)` 逐个断言 `pointsToUse/pointsDiscount/maxPointsToUse/pointsUsable/prePointsTotal` 不存在 |
| 无券基线自洽 | `useOrderSummary.spec.ts:52-56` | MIN-E5：`total = subtotal − discount` |
| zip 形状 | `checkout.spec.ts:179-186` | 空串与真实邮编都算出同一 subtotal |

**被替换掉的旧用例（旧行为= 缺陷，未恢复）**：`积分再叠一层：total = 50`、`积分不满一个兑换单位向下取整`、
整个 `积分夹逼` describe（6 条：上限受余额/应付额约束、手打超额被夹回、余额不足不可用、清空归零）——
它们钉的是"积分减进应付额"这套已删除的语义。**没有**为了绿灯保留或改写回任何一条。

### 13.5 G1 残余项 / 待裁决（如实）

1. **`summary.total` 缺失时的显示是 0**（`amount()` 折算）。改造前同样会得到 0，故不是回归；
   且契约里该字段必填、后端无条件返回。若 Lead 认为需要"缺失即报错"而不是显示 0，请派工
   （那需要引入错误态而不是兜底数字，属新增行为）。
2. **购物车页的 `total` 仍是 `serverSubtotal − discount`**（`useCartSummary.ts:55`）：Lead 明确
   "不要动它"，我照办。它当前与服务端 `total` **恒等**（没有第三层折扣，且服务端把 discount 封顶在
   subtotal）。但它就是"两处各算一份"的形态 —— 若日后服务端加运费/新折扣层，这里会重新分叉。
   **建议**（等你裁决）：一并改为消费 `summary.total`，与结算页同源。要改我随时改，一行的事。
3. **`loyalty.redeemableValue`（'Redeemable for'）文案**：出现在积分页，指的是"积分为券"的商城，
   不是结算页抵扣；目前读起来略有歧义（可能被理解成可在结算抵扣）。未改（属无关改动面）。
4. **e2e 影响：预期为 0**。`web/tests/**` 里没有任何用例操作结算页的积分输入框
   （`grep 'Loyalty points|Use Max|useMax'` 只命中 `loyalty` 页与 seed 辅助），
   `e2e-functional.spec.ts:899-947`「Earn points after an order completes」那条也因此不受影响
   （它 seed 的 points 是 0，本来就没有抵扣；`earnPoints` 仍按权威 total 计）。

---

## 14. G1b（task-18）：D 阶段闸门 3 个失败点

> D 阶段真实闸门结果（qa 提供）：`vue-tsc`(src) ❌1 ｜ `vitest` ❌2F/209P ｜ `lint` ❌1（13 warnings 全存量）
> ｜ `build-prod` ✅ rc=0。**构建绿而类型红**（esbuild 不做类型检查），下面三条按根因修完。

| # | 位置（改后） | 改动 | 为什么这样改 |
|---|---|---|---|
| **D-1** Major | `pages/Cart.vue:28` → 已删除（原 `const subtotal = computed(() => cartStore.subtotal)`），第 34-39 行留注释说明 | 该声明在 B1 改购物车口径后**已无消费者**（模板改用组合式的统一小计），同时触发 `vue-tsc` TS6133 与 `lint` `no-unused-vars` ⇒ `npm test` 不可能绿 | 删声明而不是"造个用法"：它本来就是残留（§13.3 MIN-E1 的同一处收敛） |
| **D-2** Major（真实行为缺陷） | `composables/usePromoCode.ts:59-76` | watcher 不再调 `reset()`，改为**只清生效状态**（`promoDiscount=0`、`promoApplied=false`、`appliedCode=''`）并回调 `onApplied`，**不动 `promoCode`（输入框的值）** | 旧写法把用户刚敲的字符吞掉（vitest 实测 `expected '' to be 'SAVE20'`），与"让用户重按 Apply"的注释意图**相反**。只有 `removePromo()`/清空购物车这类显式移除才清输入 —— 那条路径仍走 `reset()`，语义不变 |
| **D-3** Minor（夹具） | `composables/useOrderSummary.spec.ts:47-61` | `setup()` 的 `getCode` **按生产接线**接到组合式自己的状态：`readCode = () => api.promoApplied.value ? api.promoCode.value.trim() : ''` | 比"用例内先置 `code.value='SAVE10'`"更强：夹具与 `Checkout.vue` 的 `paymentDiscountCode` 同构，于是"只有已生效的码才发下去"这条不变式在单测里也真的被走一遍 |

**D-2 为什么不破坏 `onApplied` 不变式**（这是修法必须自证的一点）：
`onApplied` 的三种触发情形一个都没少 ——
① 应用成功：`applyPromo` 内 `onApplied?.()`（`usePromoCode.ts:110`）；
② 用户移除：`removePromo` 内 `onApplied?.()`（`:128`）；
③ 输入偏离已生效码：watcher 内 `onApplied?.()`（`:75`），且此刻 `promoApplied` 已置 false ⇒
上层（`useOrderSummary`/`useCartSummary`）的 `getCode` 会读到空串，摘要按"无码"重取。
差别只在"输入框的值是否被清"：③现在保留用户输入。`usePromoCode.spec.ts` 里
「已生效后改写输入框」那条**同时**断言 `promoApplied === false` + `onApplied` 调用 1 次 +
`promoCode.value === 'SAVE20'`，把这两件事一起钉住。

**门槛自审**：D-1 的 TS6133/`no-unused-vars` 与 D-2 的行为断言都在上述改动里消除；
D-3 不再是"靠巧合通过"。§13 的 G1 改动与 D-3 落在同一份 spec 上，我按 Lead 要求
**先改 `useOrderSummary.ts` 口径、再统一改 spec**，因此两处断言不冲突。

---

## 15. 累计交付清单（B1 + B2 + B3 + G1 + G1b + G1c）

```
[G1 生产代码]
[改] web/src/composables/useOrderSummary.ts   total = amount(summary.total)；删 prePointsTotal 与全部积分抵扣状态
[改] web/src/pages/Checkout.vue               删积分抵扣输入/抵扣行（改只读说明）；finalizeOrder 不再 spendPoints；
                                              删 POINTS_PER_DOLLAR import
[改] web/src/i18n/locales/en.ts               + checkout.pointsNotRedeemable
[改] web/src/composables/useCartSummary.ts    MIN-E1 单一判据（不再外放 serverSubtotal）；MIN-E2 zip 传 ''
[改] web/src/composables/useWriteEndpointAvailability.ts  MIN-E3 hitsRealBackend + 已知偏差显式注释
[改] web/src/api/modules/checkout.ts          MIN-E2 zip 收紧为 string
[改] web/src/pages/Cart.vue                   MIN-E1 模板改用统一小计；D-1 删除未用 subtotal

[G1/G1b spec]
[改] web/src/composables/useOrderSummary.spec.ts  BLK-E1 三钉（服务端优先/积分不影响/接口不存在）+ MIN-E5 基线
                                                 + D-3 夹具按生产接线；删除并替换"积分减进应付额"旧用例
[改] web/src/api/modules/checkout.spec.ts         8 处 undefined→'' + zip 形状用例

[G1b 生产代码]
[改] web/src/composables/usePromoCode.ts      D-2 watcher 不再清输入框

[G1c 生产代码]
[改] web/src/composables/useCartSummary.ts    total = amount(summary.total)（消灭最后一处客户端自算应付额）
[新] web/src/utils/amount.ts                  两侧共用的兜底函数（原先两份私有副本合并为一份）
[改] web/src/composables/useOrderSummary.ts   改为 import 共用 amount()（删掉私有副本）

[G1c spec]
[新] web/src/composables/useCartSummary.spec.ts  判别用例（服务端 total 优先）+ 请求形状 + 小计判据 + enabled + reset

[G1d 生产代码]
[改] web/src/composables/useOrderSummary.ts   + pricingSignature watcher（items 变即重取）+ shouldRefetch 闸门 + fetchSeq 乱序防护
[改] web/src/composables/useCartSummary.ts    同一形状的签名 watcher（购物车页同缺口）+ fetchSeq + fetchSummary 默认取 getCode()
[改] web/src/pages/Checkout.vue               shouldRefetch: () => !isCompletingOrder.value
[改] web/src/pages/Cart.vue                   + getCode 接线；三处重复的券码三元表达式收敛为一处

[G1d spec]
[改] web/src/composables/useOrderSummary.spec.ts  + 7 条（加购锚点/原地改数量/多行合并/回拉不重复/清空跳过/收尾闸门/乱序防护）+ flush() 排空辅助
[改] web/src/composables/useCartSummary.spec.ts   + 5 条同形用例（含 getCode 接线）
```

**未改**：`web/tests/**`（qa 独占）、`src/main/**`、`src/test/**`、`sql/**`、`docker/**`、任何契约文档。

---

## 16. G1/G1b 的验证状态（如实声明）

| 项 | 状态 |
|---|---|
| 容器 / `npm run typecheck`（两 project）/ `test:unit` / `lint` / `build-prod` | ❌ **全部未运行**（P1 纪律；闸门由 qa 在 TASK-002-H 复跑）。**不拿 `build-prod` 绿当类型通过** —— esbuild 不做类型检查，D 阶段已经证明过这一点 |
| 静态自审 | ✅ 逐文件核对：`useOrderSummary` 删掉积分状态后无残留引用（`grep pointsToUse\|pointsDiscount\|maxPointsToUse\|pointsUsable\|prePointsTotal` 仅剩注释与"断言不存在"的用例）；`Checkout.vue` 无遗留 `points*` 绑定、`Sparkles`/`loyaltyStore`/`authStore` 仍被使用；`useCartSummary` 删掉 `appliedCode`/`serverSubtotal` 后无未用局部；`Cart.vue` 无 `subtotal` 局部声明残留；`checkout.spec.ts` 全部调用为三参且 zip 为 string |
| 是否恢复了错误语义 | ✅ **没有**：积分减进应付额、券+满减叠加、自算运费/税、watcher 清空输入 **四条全部保持删除**；其中"积分不影响应付额"与"输入不被吞掉"都有正向断言钉住 |
| 未改受保护文件 | ✅ 仅 `web/src/**` 与本文 |

**预期会红的项**：G1/G1b **不新增**预期红。既有唯一预期红仍是 §10.3 的
`web/tests/features.spec.ts:283-289`（匿名 `/checkout` 被守卫送去登录页）。
若 TASK-002-H 出现其它失败（尤其 `web/src` 生产代码的类型错），请直接回派给我。

---

## 17. G1c（task-19）：购物车应付额也改为消费服务端 total

> 结论先行：**「客户端自算应付额」这一类缺陷（BLK-4 券 / BLK-E1 积分）在本轮之后已无存活实例。**
> 本轮仍**未进容器、未跑任何 `npm`/`vue-tsc`/`vitest`/`lint`**（H 之前的最后一次 `web/src` 写入）。

### 17.1 改动（只改应付额这一个字段）

| 位置（改后） | 改前 | 改后 |
|---|---|---|
| `composables/useCartSummary.ts:64` | `total = +(serverSubtotal.value - discount.value).toFixed(2)` | `total = amount(summary.value.total)` |
| `composables/useCartSummary.ts:51-63` | — | 注释写明：旧式子是**同类缺陷的最后一个实例**，且**刻意不写 fallback**（连 `subtotal − discount` 都不写 —— fallback 是口径重新分叉的入口） |
| `composables/useCartSummary.ts:46-48`（**保留**） | — | `subtotal` 的展示判据（`serverLoaded ? 服务端 : 本地镜像`）保持不动 —— 它只用于**展示小计**，且是 MIN-E1 收敛后的唯一判据 |

**为什么改一个"当前恒等"的式子**：`serverSubtotal − discount` 与服务端 `total` 在今天恒等
（后端没有第三层折扣，且把 discount 封顶在 subtotal），所以**没有用户可见缺陷**。
但它就是"应付额由客户端算一份"的形态，而这一类已经复发两次（券 → 积分）。
Review Gate 的 task-17 要求排查"第三处自算路径"，这就是那一处：按根因消灭，不等它第三次咬人。

### 17.2 让"同源同形"变成字面事实：抽出 `utils/amount.ts`

原先两个组合式各有一份私有的 `amount()`（4 行、逐字相同）。两份副本就是下一次漂移的起点，
所以抽成 `web/src/utils/amount.ts`，让两处 import **同一个函数**：

- `utils/amount.ts:12` —— 唯一的 `amount()`，只做"缺失/null/NaN → 0"的**类型兜底**，零业务算术；
- `useOrderSummary.ts:84` → `amount(summary.value.total)`（结算页应付额）
- `useCartSummary.ts:64` → `amount(summary.value.total)`（购物车应付额）

> 没有引入新的第二判据：`amount()` 只回答"这个数能不能参与显示"，不回答"应付额怎么算"。

### 17.3 判别用例（与结算页那条同构）

新增 `composables/useCartSummary.spec.ts`（该组合式此前没有 spec）：

| 用例 | 位置 | 断言 |
|---|---|---|
| **判别用例**：服务端 `total` 与 `subtotal − discount` **不等**时取服务端 | `useCartSummary.spec.ts:62-75` | 回包 `{subtotal:120, discount:30, total:99}` ⇒ `total === 99`（**不是** `120−30=90`）、`discount === 30`、`subtotal === 120`。旧式子接回来即刻红 |
| `total` 缺失/NaN ⇒ 有限数 0 | `:77-88` | `Number.isFinite` 为真、值为 0，绝不 NaN |
| 请求形状与结算页一致 | `:90-95` | `toHaveBeenLastCalledWith(ITEMS, '', 'SAVE10')`（zip 空串 + 码透传，MIN-E2） |
| 小计展示判据（MIN-E1） | `:97-105` | 取数前本地镜像 50 → 取数后服务端 120 |
| `enabled` 跟随登录态（C0 前提） | `:107-113` | 未登录 false → 登录后 true |
| `resetSummary` 回到未回包状态 | `:115-126` | `total` 0、`subtotal` 回本地镜像、`isLoading` false |

### 17.4 「应付额来源已唯一化」核对清单（逐处 grep 证据）

| 应付额消费点 | 位置 | 来源 |
|---|---|---|
| 结算页应付额 | `useOrderSummary.ts:84` | **服务端** `amount(summary.total)` |
| 购物车页应付额 | `useCartSummary.ts:64` | **服务端** `amount(summary.total)` |
| 支付 payload 的 amount | `usePaymentFlow.ts:138` | `total.value`（上面那个服务端值） |
| 支付网关弹窗显示额 | `Checkout.vue:1127` `:amount="total"` | 同上 |
| Pay 按钮文案金额 | `Checkout.vue:947` `formatPrice(total)` | 同上 |
| 落库订单 `total` | `Checkout.vue:254` `total: total.value` | 同上 |
| 累计消费/返积分的 `paid` | `Checkout.vue:319` `const paid = total.value` | 同上（**不含任何积分子项**） |
| ThankYou 查询参数 `total` | `Checkout.vue:344` `total.value.toFixed(2)` | 同上 |
| 购物车右栏 Total | `Cart.vue` → `summaryTotal` → `useCartSummary.total` | **服务端** |

`grep 'subtotal - \|- discount\|+ shipping\|+ tax' web/src` 的**唯一命中**是
`api/modules/checkout.ts:98`（mock 分支里的 `const total = +(subtotal - discount).toFixed(2)`）——
那是 **mock 在扮演服务端**（真实服务端的同类计算在 `StorefrontCheckoutController:107`），
不是页面在自算应付额；`checkout.spec.ts:257` 断言的也是这个 mock 的不变量。
除此之外，`web/src` 内没有任何一处把"应付额"算出来。

### 17.5 本轮明确**不做**的（Lead 已裁决，记账备查）

1. **`summary.total` 缺失 ⇒ 显示 0**：接受现状。契约里该字段必填、后端无条件返回
   （`StorefrontCheckoutController:107-113`），且改造前同样得 0 ⇒ **非回归**；
   "缺失即报错"属新增行为（要引入错误态而非兜底数字），本轮不做。
2. **`loyalty.redeemableValue`（'Redeemable for'）措辞歧义**：记为 Minor 文案项，本轮不做。
   （它在积分页指"用积分换券"，但读起来可能被理解成"可在结算抵扣"。）

### 17.6 验证状态（如实声明）

| 项 | 状态 |
|---|---|
| 容器 / `npm run typecheck`（两 project）/ `test:unit` / `lint` / `build-prod` | ❌ **全部未运行**（H 阶段由 qa 复跑）。不拿 `build-prod` 绿当类型通过 |
| 静态自审 | ✅ `useCartSummary` 的 `total` 只读 `summary.total`；两份私有 `amount()` 已合并为 `utils/amount.ts` 一份（无未用局部、无未用 import）；新 spec 的 import 全部被使用（`useAuthStore`/`User` 供 `login()`、`OrderSummary` 供类型断言、`ref` 供 items）；`Cart.vue` 消费的 `summaryTotal` 语义随之变为服务端值，模板无需改动（只做 `formatPrice`） |
| 是否恢复了错误语义 | ✅ **没有**：本轮只**减少**了一处客户端算式，未新增任何自算路径 |
| 未改受保护文件 | ✅ 仅 `web/src/**` 与本文 |

**预期红：不新增**。既有唯一预期红仍是 §10.3 的 `web/tests/features.spec.ts:283-289`。
本轮的 e2e 影响为 **0** —— `web/tests/e2e-functional.spec.ts:825-843`（Cart Money Consistency，登录态）
断言的是 `displayedTotal ≈ localStorage 小计`，在**无券**场景下服务端 `total` 与 `subtotal` 相等，
因此仍成立。

---

## 18. G1d（task-20）：items 变化必须重取摘要（BLK-I1）

> 结论先行：**BLK-I1 已闭环** —— 结算页内加购（以及购物车页的改数量/删行/清空）之后，摘要会
> 自动重取，`Total` 变成服务端按新 items 算出的值。这是 BLK-4（券）→ BLK-E1（积分）
> → BLK-I1（items 未同步）同一条线上的第三处，与前两处同样是**"页面显示额 ≠ 实际扣款"**。
> 本轮仍**未进容器、未跑任何 `npm`/`vue-tsc`/`vitest`/`lint`**。

### 18.1 触发方式：在**摘要的归属方**里对 items 的「计价签名」做 watch（不是在每个动作后手写一次）

| 位置（改后） | 改动 |
|---|---|
| `composables/useOrderSummary.ts:151-158` | `pricingSignature`（`id:quantity:price` 逐行拼串）+ `watch(pricingSignature, ...)` → `fetchSummary()` |
| `composables/useOrderSummary.ts:28-35` | 新增可选闸门 `shouldRefetch?: () => boolean`（默认恒真） |
| `pages/Checkout.vue:164` | `useOrderSummary({ ..., shouldRefetch: () => !isCompletingOrder.value })` |
| `composables/useCartSummary.ts:117-123` | 同一形状的签名 watcher（购物车页的同一处缺口，见 §18.4） |

**为什么用 watch 而不是"每个动作后调一次 `fetchSummary()`"**：触发点应该是**数据**（items），
不是**动作**（今天只有"结算页加购"一处，明天可能出现改数量/删除行）。绑在数据上等于按根因
关掉这一类；绑在动作上则要求以后每加一个改 items 的入口都记得补一行 —— 那正是 BLK-I1 的成因。

**为什么盯签名而不是 `{ deep: true }`**（这条直接对应 Lead 的"避免重复请求/抖动"）：
真实后端 + 登录态时，每次改购物车都会 `syncAfterMutation` → 服务端回拉 → 用权威列表
**整体替换** `items`（`stores/cart.ts` 的 `syncFromServer`）。深比较会为**同一次用户动作**
看到两次变化（本地乐观改 + 回拉替换），于是发两次请求，而两次的金额构成完全一样。
只盯影响金额的三个字段（行 id / 数量 / 单价）：
- 回拉那次签名不变 ⇒ **一次动作只发一次请求**（有专门用例钉住）；
- 新增行 / 删行 / 改数量 / 服务端改价，签名都会变 ⇒ 不漏重取；
- 颜色/尺码这类**不影响价格**的改动不再白跑一次请求（顺带的小收益）。

**两道闸门**（都写成用例）：
1. **空车跳过**：没有商品就没有摘要可算（真实后端对空 items 返回 400），而清空购物车正是
   `finalizeOrder` → `clearCart()` 会做的事 —— 那时发请求只会在跳 ThankYou 的路上弹一个假的"计算失败"。
2. **`shouldRefetch()`**：直接购买模式落单后 `checkoutItems` 会**回落到购物车**（`directBuyItem` 被清空），
   清掉它并不是"用户改了订单"；`isCompletingOrder` 期间一律不重取。

**顺带加的一层防护（明确记录，便于评审判断是否算扩大范围）**：`fetchSummary` 里加了
单调递增的 `fetchSeq`（`useOrderSummary.ts:107`、`useCartSummary.ts:85`），
**只接受最新一次请求的结果**。理由：重取变成自动的之后，两次重取的响应可能**乱序到达**，
旧 items 算出的金额覆盖新值 —— 那又是同一类"显示额 ≠ 实扣"。若不设防，这个 watcher
反而会引入一类新的不一致。有一条用例专门钉它（先发出的旧响应后到 ⇒ 被丢弃）。

### 18.2 回归锚点（G-5 形状，落在单测层）

落在 `web/src/**/*.spec.ts`（我的写范围），**不需要动 `web/tests/**`**：

| 锚点 | 位置 | 断言 |
|---|---|---|
| **加购后 Total 变化且等于服务端新值** | `useOrderSummary.spec.ts:295-308` | 服务端按行数计价（1 行 120 → 2 行 240）：push 一行后自动重取，`total === 240`（不是旧值 120），且请求次数 1→2 |
| 购物车版同构锚点 | `useCartSummary.spec.ts:165-177` | 同一形状（1 行 120 → 2 行 240） |
| 原地改数量也重取 | 两份 spec | `items[0].quantity = 3`（数组引用不变）⇒ 发起重取 |
| 一次动作多行只发一次 | 两份 spec | 同 tick 内 push 两次 ⇒ 只多一次请求（pre-flush watcher 合并） |
| 服务端回拉替换（内容相同）不重复请求 | 两份 spec | 本地改一次后，用等值副本整体替换 ⇒ **不产生第三次请求** |
| 清空 items 不重取 | 两份 spec | `items.value = []` ⇒ 请求次数不变 |
| 收尾闸门 | `useOrderSummary.spec.ts` | `shouldRefetch` 为假时改 items 不重取 |
| 乱序响应防护 | `useOrderSummary.spec.ts` | 旧请求后到 ⇒ `total` 仍是新值 |

> 为什么不在 e2e 层加：单测能**确定性地**构造"服务端按 items 计价 + 重取落地/乱序"这些时序，
> 而 e2e 只能观察最终文本；且 `web/tests/**` 是 qa 的写范围。若 qa 认为需要一个 e2e 层面的
> 端到端锚点（在结算页点 "Add to Order" 后断言 Total 变化），我可以提供选择器与步骤，**但不自行改**。

### 18.3 「items 变化入口」核对清单（证明没有漏掉第二处动作）

`grep -n 'cartStore\.(addItem|removeItem|updateQuantity|updateItemOptions|clearCart|clearDirectBuyItem|setDirectBuyItem)' web/src` 的全部命中，按"是否可能发生在结算页存活期间"分类：

| # | 入口 | 位置 | 是否可能影响结算页 | 覆盖方式 |
|---|---|---|---|---|
| 1 | **结算页内加购**（Complete the Look → Add to Order） | `useCompleteTheLook.ts:72`（经 `Checkout.vue:851 @add="addCompleteTheLook"`） | ✅ **就是 BLK-I1 本身** | 签名 watcher（`addItem` 的 push 与"命中已有行原地改 quantity"两种形态都被签名捕获） |
| 2 | 结算页收尾清空 | `Checkout.vue:340,342`（`clearDirectBuyItem` / `clearCart`） | ✅ 但发生在**落单收尾** | 空车闸门 + `shouldRefetch()` 闸门（**不**重取） |
| 3 | 直接购买项设置 | `ProductDetail.vue:204`（`setDirectBuyItem`）→ 随后 `router.push('/checkout?mode=direct')` | 发生在**进入结算页之前** | 结算页挂载时的 `fetchSummary()` 覆盖（`Checkout.vue:176-179`） |
| 4 | 购物车页：数量 +/- | `Cart.vue:118,126`（`updateQuantity`，原地改） | 否（不同页面），但**同一处缺陷的购物车版本** | 购物车签名 watcher（§18.4） |
| 5 | 购物车页：删除行 | `Cart.vue:137`（`removeItem`，换数组） | 否 | 同上 |
| 6 | 购物车页：清空 | `Cart.vue:148`（`clearCart`） | 否 | 同上（空车闸门） |
| 7 | 购物车页：编辑规格 | `Cart.vue:234`（`updateItemOptions`，原地改/可能合并行） | 否 | 同上（签名行数/数量变 ⇒ 重取；仅颜色尺码变 ⇒ 不重取，且不影响金额） |
| 8 | 其它页加购（首页卡片 / 商品页 / 店铺页 / 对比页 / 心愿单 / 订单页再来一单 / 商品推荐位） | `ProductCard.vue:29`、`ProductDetail.vue:172`、`StorePage.vue:167`、`Compare.vue:59`、`dashboard/Wishlist.vue:26`、`dashboard/Orders.vue:277`、`ProductRecommendations.vue:83,90` | 否（都在结算页之外） | 若用户另开标签页/返回后 items 已变，watcher 同样会重取 |

**结论**：结算页存活期间会改 items 的入口只有 #1（正例）与 #2（收尾，明确排除）；
**第二处需要重取的动作不存在**。#4–#7 不是漏项，而是同一处缺口在购物车页的镜像 —— 见下节。

### 18.4 顺带修掉的第二处实例：购物车页的同一缺口

购物车页此前**只在挂载/登录/券生效时**取摘要，而它自己就有四个改 items 的入口（#4–#7）。
一旦取到过回包（`serverLoaded === true`），右栏小计/总额会一直停在第一次取数的值 ——
与结算页 BLK-I1 完全同形（`subtotal` 展示判据用的也是"服务端值优先"，所以旧的 `localSubtotal`
不会再顶上来）。按 G1c 的同一取舍（"已经复发两次的类，按根因消灭"），我在
`useCartSummary.ts:101-123` 加了同一形状的签名 watcher，并补了 5 条用例。
购物车没有"落单收尾"概念，所以不需要 `shouldRefetch` 闸门。

另：`useCartSummary` 的 `fetchSummary` 现在默认用 `getCode()` 取已生效的券码
（`useCartSummary.ts:88`），`Cart.vue:48-56` 把 `getCode` 接上并把三处重复的三元表达式删掉 ——
否则"改数量"会用一个**不带券**的摘要覆盖带券的摘要，总额凭空反弹。

### 18.5 验证状态（如实声明）

| 项 | 状态 |
|---|---|
| 容器 / `npm run typecheck`（两 project）/ `test:unit` / `lint` / `build-prod` | ❌ **全部未运行**（Docker 环境本轮不可用，且按纪律不跑）。G4 的达成声称留给 qa 的运行期证据 |
| 静态自审 | ✅ 两处 watcher 都只读 `items`/`pricingSignature`，不引入新的金额来源（`total` 仍只取 `summary.total`）；`useOrderSummary` 新增 `shouldRefetch` 为可选、`Checkout.vue` 的传参用的是更早声明的 `isCompletingOrder`（非 TDZ）；`Cart.vue` 的 `getCode` 与 `Checkout.vue` 同构（闭包在取数时才读）；新老 spec 的 import 全部被使用（两份 spec 都新增了 `nextTick` 供 `flush()`） |
| 是否恢复了错误语义 | ✅ **没有**：本轮只增加"重取"这一个动作，未新增任何客户端算式；`total` 仍只来自服务端 |
| 未改受保护文件 | ✅ 仅 `web/src/**` 与本文；`web/tests/**` 一个字未动 |

**预期红：不新增。** 既有唯一预期红仍是 §10.3 的 `web/tests/features.spec.ts:283-289`。
e2e 影响评估为 **0**：本轮不改任何 DOM/文案，只增加"items 变 ⇒ 重取"这一行为；
`e2e-functional.spec.ts` 的结算/积分两条流程在支付前不改 items，因此请求次数与断言都不变。

