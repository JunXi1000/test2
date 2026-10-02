# TASK-002 · 全量闸门与真实后端回归报告（TASK-002-H 终版）

> **产出人**:测试 Agent(`qa-acceptance`) · **任务**:task-16(TASK-002-H,rev6) · **容器锁**:本阶段独占,报告完成后交回 Lead
> **契约**:Lead 冻结的 C0–C7([00-AGENT-REGISTRY.md](00-AGENT-REGISTRY.md))
> **写范围**:仅 `docs/TASK-002/06-TEST-REPORT.md`、`src/test/**`、`web/tests/**`。**未改** `src/main/**`、`web/src/**`、`sql/**`、`docker/**`;未执行任何 V6~V11 迁移(库仍 **23 张表**)。
>
> ⚠️ **本文件已整体覆盖 D 阶段的旧数字**。D 阶段报告里的三处失败
> (`Cart.vue:28` TS6133、`vitest 2F/209P`、`lint 1 error`)已由 task-18/19 修掉,
> **不再出现在本轮结论中**。

---

## 0. 结论

| 验收目标 | 结论 | 真实数字 |
|---|---|---|
| **G1 后端闸门** | ✅ **PASS** | `mvn -B clean test` → **194 run / 0 failures / 0 errors / 0 skipped / BUILD SUCCESS** |
| **G2 前端五项** | ✅ **PASS(五项全 rc=0)** | `vue-tsc`(src) 0 · `vue-tsc -p tsconfig.test.json` 0 · `vitest` **227 passed / 14 files** · `build-prod` rc=0 · `lint` **0 errors / 13 warnings(全为存量)** |
| **G3 券链路** | ✅ **PASS** | 登录+已领券 → **200**(`discount=19.80`);匿名 → **401**;决定性对照 `/addresses` **200** + `/checkout/promo` **200**(同 token) |
| **G4 金额四方一致(含积分场景)** | ✅ **PASS** | 无券 `198.00`、用券 `178.20`,四处全等;**第三层扣减(积分)恒为 0** |
| **U-4:G4 是否含积分场景** | ✅ **是** | 见 §5.3 的三条证据链 |
| **BLK-E1 闭环** | ✅ **PASS** | 页面 `total = amount(summary.total)`,无 fallback、无积分层;`Checkout.vue` 的 `spendPoints` 已删 |
| **BLK-I1 闭环(本轮新增)** | ✅ **PASS** | e2e 实测:结算页复核步内加购后 **Total 随之变化且等于新 items 的服务端总额**(§6) |
| **Playwright e2e** | ✅ **PASS** | **132 passed / 0 failed**(2.1m) |
| **回归无新增失败** | ✅ **PASS** | 授权矩阵、主链路、幂等、并发不超卖、后台真实聚合 20/20(§7) |

**附带的测试侧修正(我的写范围)**:MAJ-E2 ✅、MAJ-E3 ✅(新增判别用例)、MIN-E6 ✅(新增护栏断言)——见 §8。

---

## 1. 环境快照

| 项 | 值 |
|---|---|
| 容器 | `nexus-dev`(Docker Desktop 重启后的新实例),后端 :1000 / 前端 :5173 / MySQL 3306 |
| 就绪 | `GET /` → **401**(收到真实 HTTP 响应的判据);前端 `:5173` → **200**(含 `/api` 代理 200) |
| 库 | `template_v3`,**23 张表**(V6~V11 **未应用**) |
| 运行态 | 含当前工作树代码(C0/C5/C6/C7/BLK-E1/BLK-I1 的行为均实测到) |
| 顺序 | 先 `pkill` dev 后端 → `mvn -B clean test` → 重启后端 → 等就绪 → 真实 HTTP 验收 → e2e |

**两次环境陷阱(供后续接手者)**
1. **长驻 dev server 必须 `setsid -f` 启动**:`nohup ... &` 在 `docker exec` 会话结束时会收 SIGHUP 被杀(容器重启后前端曾整个掉线)。
2. **Vite 可能漏掉文件变更**:D 阶段实测到 dev server 吐出**旧版 `router/index.ts`**(缺 `/checkout` 的 `requiresAuth`)⇒ 表现为"匿名 `/checkout` 落 `/cart` 而非 `/login`"。**改完 `web/src` 后应先重启 Vite 再跑 e2e**,否则会得到假红/假绿。

---

## 2. G1 后端全量闸门

```bash
pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"
docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'
```

```
MVN_EXIT=0
[INFO] Tests run: 194, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**关键类**(逐类取自 surefire 报告):

| 测试类 | run | 覆盖 |
|---|---|---|
| `StorefrontPromoTest` | **16** | BLK-2/C0/C2:匿名 401、未领/已用/过期/下架/兜底码 400、门槛 409、减免正确 |
| `CheckoutMoneyConsistencyTest` | 6 | C3/C4:四方金额一致(含用券)、匿名 401、篡改无效 |
| `NotImplementedEndpointsTest` | 5 | C5:4 端点 501 + 副作用为零 + 鉴权不被盖过 |
| `AccountNotificationContractTest` | **6** | C6 + **MAJ-E3 的 load-then-merge 判别用例**(§8.2) |
| `AuthzRegistrationGateTest` | **3** | 登记闸门 + 不重叠闸门 + **MIN-E6 白名单不依赖登录态**(§8.3) |
| `RequestShapeTest` | 9 | **MAJ-E2 的 javadoc 已改 400** + 未知字段/强转/状态码 |
| `AuthorizationBaselineTest` | 14 | 授权矩阵 |
| `ErrorModelTest` | 19 | 错误模型与状态码 |

> 194 = 上一轮 192 + 本轮新增 2(`loadThenMergeKeepsExistingValues`、`whitelistPathsMustNotDependOnLoginState`)。

**BLK-2/BLK-3 对应用例名与结果**(task-16 要求列出):
- BLK-2:`StorefrontPromoTest` 全 16 例 **0F/0E**(含 `anonymousPromoIsRejected` 401、`unclaimedCouponIsRejected`/`usedCouponIsRejected`/`expiredCouponIsRejected`/`disabledCouponIsRejected`/`legacyFallbackCodeIsRejected`/`unknownCodeIsRejected` 均 400 且 msg 可区分、`belowMinOrderRejected` 409)。
- BLK-3:`RequestShapeTest.summaryInvalidItemIsBadRequest` **400** ✅。

---

## 3. G2 前端五项闸门(全部 rc=0)

| 项 | 命令 | 结果 | rc |
|---|---|---|---|
| 类型检查(src) | `npx vue-tsc --noEmit` | 0 error | **0** |
| 类型检查(tests) | `npx vue-tsc --noEmit -p tsconfig.test.json` | 0 error | **0** |
| 单测 | `npx vitest run` | **14 files / 227 passed** | **0** |
| 生产构建 | `npm run build-prod` | `✓ built in 25.90s` | **0** |
| lint | `npm run lint` | **0 errors / 13 warnings** | **0** |

**lint 棘轮核对**:13 条 warning 全部是 `eslint.baseline.json` 里的**存量豁免**(`Button`/`EmptyState` 的 `require-default-prop`、`useProductGallery.ts` 的 `no-console`、`ForgotPassword`/`Signup` 的 `vue/no-v-html`、`merchant/Wallet.vue` 的 `attributes-order`)。**无新增告警、未手工删表项**;`0 errors` 是本轮相对 D 阶段的实质改善。

---

## 4. G3 券链路(真实 HTTP)

**决定性对照(同一 token、同一时刻)**:

```
GET  /addresses       -> HTTP 200  {"code":200,"msg":"操作成功","data":[]}
POST /checkout/promo  -> HTTP 200  {"code":200,"msg":"操作成功","data":
                         {"code":"WELCOME10","discount":19.80,"couponId":"WELCOME10",
                          "title":"New User Discount","type":"percent"}}
```

> 这组对照证明"白名单致死"已解除:同一身份打两个端点**都是 200**,而 TASK-001 时
> `/checkout/promo` 对任何请求(含合法登录态)恒 400「请先登录后再使用优惠码」。
> 减免也正确:198 × 10% = **19.80**。

**匿名 → 401**(两个端点都验):

```
POST /checkout/promo    (无 Authorization) -> HTTP 401 {"code":401,"msg":"未登录或登录已过期"}
POST /checkout/summary  (无 Authorization) -> HTTP 401 {"code":401,"msg":"未登录或登录已过期"}
```

原始报文:`/tmp/qa-b/resp/H-*.http`。

---

## 5. G4 金额四方一致(含积分场景)

### 5.1 四方对拍

| 场景 | summary.total | create.amount | payment.amount | Σ product_order.total_money | 一致 |
|---|---|---|---|---|---|
| 无券 2×99 | 198.00 | 198.00 | 198.00 | 198.00 | ✅ |
| **用券 WELCOME10** 2×99 | **178.20** | **178.20** | **178.20** | **178.20** | ✅ |

```
[用券] summary -> {"total":178.20,"discountCode":"WELCOME10","subtotal":198.00,"discount":19.80}
[用券] create  -> {"amount":178.20,"orderId":"NO202610021011334576", ...}
[用券] 四方: summary.total=178.2 | create.amount=178.2 | payment.amount=178.20 | Σ rows=178.20
券核销: 3  1  used      ← 恰好核销一次
```

### 5.2 BLK-E1 闭环:不存在第三层扣减

对两种场景都做了断言 `total == subtotal − discount`(即无任何额外层):

```
[无券 2×99]     total == subtotal - discount ? ✅ 是(无积分层)
[用券 WELCOME10] total == subtotal - discount ? ✅ 是(无积分层)
```

**前端源码核对**:
- `useOrderSummary.ts:84` → `const total = computed(() => amount(summary.value.total))` —— **只取服务端权威总额,不写 fallback**(fallback 正是两条口径重新分叉的入口);
- `Checkout.vue`:积分抵扣状态整块删除,`loyaltyStore.spendPoints(...)` **已删**(原来抵扣不生效却真扣用户余额,**同一处的第二个资损面**);模板只留只读余额 + `pointsNotRedeemable` 文案;
- `useCartSummary.ts:64` → 购物车页同样收敛为 `amount(summary.value.total)`(G1c/task-19)。

### 5.3 U-4 明确结论:**G4 含积分场景,且积分层已被证明不存在**

三条证据链:

1. **服务端零积分落点**(DB 层):
   ```
   含 'point' 的表:  (空)
   含 'point' 的列:  (空)
   payment 表列: id, order_no, user_id, amount, channel, transaction_no, status, paid_time, create_time
   ```
   ⇒ 后端既不收积分、也没有任何积分字段可影响应付额。

2. **注入积分字段无效**(防"客户端减一层"):
   ```
   POST /checkout/summary {"items":[2×99], "pointsDiscount":50, "pointsToUse":5000}
     -> 200 {"total":198.00,"subtotal":198.00,"discount":0}      ← 积分字段被完全忽略,未减 50
   POST /checkout/summary {"items":[2×99, "price":0.01], "total":0.02, "pointsDiscount":50}
     -> 200 {"total":198.00,...}                                  ← 篡改价与积分都无效
   ```

3. **页面口径**(源码 + 单测):`useOrderSummary` 的 `total` 唯一来源是 `summary.total`;vitest 有两条专门钉它:
   - `useOrderSummary — 积分已退出应付口径(BLK-E1)` › `登录且余额很大时,total 仍**只**等于服务端 summary.total`
   - 同 describe › `不再暴露任何积分抵扣状态 —— 否则"再减一层"就有了接口`
   两条均在 227 passed 之内。

> **结论**:BLK-E1 要求的"结算页把积分输入设为可用值时,页面显示额仍等于服务端权威总额"成立 ——
> 因为积分输入区**已下线**(状态一并删除),页面根本没有可注入的积分层;且服务端对任何积分字段零响应。

---

## 6. BLK-I1 复验:结算页内加购 → 摘要重取(本轮核心新增)

### 6.1 三条判据与落点

| 判据 | 落点 | 结果 |
|---|---|---|
| ① 真实 HTTP 覆盖"**加购后再下单**"序列 + 四方一致 | **真实 HTTP**(新增 `82h-blki1-seq.py`) | ✅ PASS(§6.2) |
| ② 加购后 Total 变化且 == 服务端新值 | **e2e**(新增 `Checkout Add-to-Order refetch`) | ✅ PASS(§6.3) |
| ③ 空列表/跳转时不得有多余重取 | **单测**(mock 模式页面不发 HTTP,e2e 无从计数请求) | ✅ 4 条 vitest 覆盖(§6.4) |

### 6.2 判据①:真实 HTTP 的"加购后再下单"动作序列

只测"打开页面→下单"会漏掉这个序列,所以按动作顺序逐步打接口(「加购」在服务端的等价物就是 items 变成 A+B 后的摘要):

```
商品 2 单价(DB)= 149.00  ← 「加购」加入的就是它

① POST /checkout/summary {items:[产品1×2]}            -> HTTP 200  total=198.00
② POST /checkout/summary {items:[产品1×2, 产品2×1]}   -> HTTP 200  total=347.00   ← 加购后
   Total 是否变化? 198.0 -> 347.0  ✅ 变了(BLK-I1 要求的可观测变化)
   增量 == 加入商品小计? 149.0 vs 149.00  ✅
③ POST /payments/create  {items:[产品1×2, 产品2×1]}   -> HTTP 200  amount=347.00
④ POST /payments/confirm {paymentId}                  -> HTTP 200

四方对拍(加购后的新 items):
   summary.total(新)   = 347.0
   create.amount       = 347.0
   payment.amount      = 347.00
   Σ order.total_money = 347.00
   四方一致? ✅ PASS
```

⇒ 加购动作使 Total 变化(`198.00 → 347.00`,增量恰为加入商品小计),下单金额按**新** items 计;
页面若能跟上这一变化(判据②已证)就不会出现"显示旧值、实扣新值"。

### 6.3 判据②:e2e 实测(原始输出)

```
[1/1] › Checkout Add-to-Order refetch (TASK-002 BLK-I1) › 结算页内加购后：Total 随之变化，且等于新 items 的服务端总额
  1 passed (10.8s)
```

**用例钉的不可变量**:推进到 **Step 3 Review**(推荐位只在该步渲染,`v-if="currentStep === 2"`)→
读 Total → 点推荐位「Add to Order」→ 断言

- `totalAfter > totalBefore`(**停在旧值就是 BLK-I1 复发**);
- `totalAfter ≈ totalBefore + Σ(加入商品单价)`(容差 2 位小数)。

**两条调试教训(值得进团队约定)**:
1. **先确认目标元素在哪个分支里**:推荐位在**复核步**才渲染,而"打开结算页"默认停在 Step 1 ⇒
   必须先填完收货信息(Step1→2)与卡信息(Step2→3)。我第一版用例直接在 Step 1 找它,
   10s 超时失败;诊断后才定位。
2. **别在断言里用裸正则解析金额**:`formatPrice` 会加千分位,`$1,056.00` 被
   `/\$([0-9.]+)/` 截成 `$1` ⇒ 期望值偏小而得假红。**必须先去掉逗号再解析**。

### 6.4 判据③:单测层的"防抖动"证据(`useOrderSummary.spec.ts`)

```
useOrderSummary — items 变化触发重取（G1d / BLK-I1）
  ✓ 加购后 Total 必须变化且等于服务端新值（BLK-I1 回归锚点）
  ✓ 原地改数量也会重取（签名含 quantity：数组引用不变也算变化）
  ✓ 一次动作里加多件只发一次请求（pre-flush watcher 合并，不抖动）
  ✓ 清空 items 不重取（落单收尾清空购物车，不该发注定 400 的请求）
  ✓ 并发重取时，先发出的旧响应不会覆盖新值（乱序防护）
  ✓ 服务端回拉替换 items（金额构成不变）不会重复请求 —— 一次动作一次取数
  ✓ 收尾闸门（shouldRefetch 为假）时不重取 —— 落单清空购物车/清 directBuyItem 不是"改了订单"
```

后四条正是判据 ② 与 ③ 的落点。**实现方式**:`useOrderSummary.ts` 的 `pricingSignature`
(`id:quantity:price`)watcher + `shouldRefetch`(`() => !isCompletingOrder.value`)+ `fetchSeq` 单调守卫;
购物车页同形缺口在 `useCartSummary.ts` 一并收敛。

---

## 7. 回归网(无新增失败)

```
[PASS] 授权矩阵:GET /orders、/merchant/dashboard/stats、/admin/dashboard/stats、
       POST /checkout/summary(401/200/403/403)、/shoppingCart/list、/admin-accounts/list
[PASS] 主链路:下单 200 → 库存原子扣减 → 支付 200 且 payment=已支付 → confirm 幂等 ×3
[PASS] 取消 200 且库存回补 → 取消幂等(只回补一次) → 越权取消 403
[PASS] 超库存 → 409 且库存不变
[PASS] 并发下单不超卖(6 线程成功 6,stock 29→11 = 29−6×3)
[PASS] 并发 confirm 幂等(5 线程全 200,rows=1,pay=已支付)
[PASS] 后台真实聚合:admin stats Total Revenue == DB 聚合;merchant Total Sales == DB;
       category-counts All == DB 商品数;revenue-chart 今日 == DB 今日
```

> D 阶段那条唯一的"FAIL"(`POST /checkout/promo` 的 USER 列得 400)已澄清为**我的用例期望写错**:
> user1/user2 从未领券,而 C2 规定未领券就该 400;SHOP/ADMIN 得 403 也正确。
> 本轮的 G3 已用**已领券用户**实测 200(§4)。

---

## 8. 测试侧修正(我的写范围,三处)

### 8.1 MAJ-E2 —— `RequestShapeTest` 类 javadoc 与断言相反 ✅ 已修

- **问题**:javadoc 写「结算项不合法**仍是 409**」,而同文件断言已按 C7 是 **400** —— 注释与断言相反,极易被人"照注释改回去"。
- **改法**:javadoc 改为「结算项不合法是 **400**(入参不合法,与「业务冲突」409 区分开)」。
- **验证**:`RequestShapeTest` 9 run / 0F / 0E。

### 8.2 MAJ-E3 —— load-then-merge 的**判别用例** ✅ 已新增

- **背景**:`StorefrontAccountController` 已改为 load-then-merge(先读现有行,只覆盖显式给出的字段)。
- **为什么旧用例咬不住**:`partiallyProvidedFieldsStillWork` 开头 `clearPrefs()` ⇒ **库中无行**,
  走的是"首次提交"分支,两种实现的输出**恰好相同**(都是默认值),**没有判别力**。
- **新增**`loadThenMergeKeepsExistingValues`:
  ```
  ① POST {emailOrder:false, emailPromo:true,  smsOrder:false}   -> DB 0/1/0
  ② POST {emailPromo:false}                                     -> 断言 DB 0/0/0
  ```
  - load-then-merge ⇒ `email_order` 与 `sms_order` **保留 0**;
  - 旧实现(未给字段回落默认值)⇒ 会得 `1/0/1` ⇒ **本用例失败**。
- **并把** `partiallyProvidedFieldsStillWork` 的标题与注释改准为「**首次提交(库中无行)**」分支。
- **验证**:`AccountNotificationContractTest` 6 run / 0F / 0E。

### 8.3 MIN-E6 —— "白名单路径不得依赖登录态"护栏 ✅ 已新增

- **问题**:4 处 `page()` 未判空的 `getCurrentUser().getType()`(Review Gate 指出:`ProductOrderEvaluateServiceImpl:32`、`ShippingAddressServiceImpl:26`、`ShoppingCartServiceImpl:43`、`ProductOrderServiceImpl:64`)。**目前安全**(对应路径都在 `AuthzRules` 里),但任何一次"把路径挪进白名单"都会立刻 NPE → 500,而**现有两条闸门都不报警**。
- **新增**`whitelistPathsMustNotDependOnLoginState()`:枚举容器里真实注册的 handler,把
  「路径命中白名单」**且**「落在依赖登录态的 controller 前缀下」判为失败,并在失败信息里给出两种修法(加 null 守卫 / 不要放白名单)。
- **前缀清单**(源码人工维护 + 注释给出处):Review Gate 列的 4 条,加上同性质的 3 条
  (`/account`、`/coupons`、`/stock-alerts` —— 均为"先取变量、紧接着解引用",无 null 守卫)。
- **当前结果**:白名单里没有任何路径落在这些前缀下 ⇒ **断言为绿**,守的是**将来**。
- **验证**:`AuthzRegistrationGateTest` **3 run / 0F / 0E**。

---

## 9. e2e 同步(三件事 + 本轮新增)

| # | 项 | 处置 | 结果 |
|---|---|---|---|
| ① | `features.spec.ts` 的 checkout 重定向 | **拆两条**:匿名 → `/login` 且带 `redirect=/checkout`;seed 登录态后空车 → `/cart` | ✅ |
| ② | `product-reviews.spec.ts` 13 条失败 | **整体改写为断言「诚实空态」**(不跳过、不保留伪造评价断言) | ✅ 6 例全绿 |
| ③ | 我的 2 条 Cart 断言 | 按**正确不可变量**重写:`Tax (`/`Shipping` 行 `count=0` **且** 显示 Total == 小计 | ✅ |
| ④ | **BLK-I1 新增** | 结算页复核步内加购 → Total 变化且等于新 items 服务端总额 | ✅ |

**最终 e2e 结果**:

```
132 passed (2.1m)
```

### 9.1 ⚠️ 可见行为变更(需向用户披露)

**商品详情页不再展示演示评价。** `web/src/api/modules/reviews.ts` 的 `SEED_REVIEWS_ENABLED = false`,
评价区因此渲染空态文案「No reviews yet. Be the first to share your experience.」+ `0 reviews`,
而**此前是 8 条编造评价**(Alex Chen / Sarah Miller / …)。这是有意的**诚实降级**
("宁可空态,不要假数据"),后端评价端点就位后把开关翻回 `true` 即可恢复,
`useProductReviews` 的合并/水合/迁移逻辑全部原样保留。

**处置原则**:断言改为「诚实空态」而非跳过 —— 保留旧断言 = 替一个已删除的行为背书;
跳过 = 隐藏真实产品行为。**这与"不得为绿灯恢复已删除的错误语义"是同一条原则。**

随种子一起**下线**的覆盖(属已知缺口,后端评价端点落地后应连同种子恢复):
Load More 分页、星级筛选到非空集、搜索命中作者/正文、"With Images" 只看带图、
Most Helpful 排序、helpful 投票、回复**种子**评价、带图评价灯箱。
**仍然覆盖**(不依赖种子):空态文案/`0 reviews`/筛选控件可用且不报错/种子作者**反向断言全不出现**/
登录用户可写评价(计数 0→1、可删除、刷新后仍在)/未登录写评价引导登录。

### 9.2 断言纪律(本轮最值得记的教训)

我上一版那 2 条 Cart 断言把「**Tiered discount 标签不出现**」当成"满减行已删除"。
但那个标签**在券生效时仍会渲染**(值取 `summary.discount`)—— 于是"券可用"这件**正确的事**
被我的断言判成了失败。

> **规则**:断言要钉**不可变量**(契约层面的行为),不要钉**实现细节的字面量**(某个文案/标签/行是否存在)。
> 本轮的修正版钉的是:`Tax (`/`Shipping` 行不存在(契约已移除这两项)**且** 显示 Total == 权威小计。

另一处同类教训见 §6.2 的两条(先确认元素在哪个分支;别用裸正则解析带千分位的金额)。

---

## 10. 未覆盖项(如实)

| 项 | 原因 |
|---|---|
| 受控的超时实验(30min 自动取消) | 需直连 `UPDATE create_time`,超出授权。D 阶段已获得**观察性**证据(11 笔 `payment.status='已超时'` 且订单行 `已取消`),能力已确证 |
| balance 渠道**退款回补正路径** | 无 `balance>0` 账户可造(`PUT /admin/users/{id}` 不接受 balance) |
| 文件上传统(multipart / >10MB) | 未构造 |
| 管理端 approve/reject、用户 toggle/reset/delete 的副作用 | 会改动种子账号,风险高于收益 |
| `/chat/*` 端到端 | 未构造会话与消息 |
| 评价子系统(后端) | `product_order_evaluate` 表 **0 行**,无可断言数据 |
| 真机 / 多浏览器 | 仅 chromium |
| V6~V11 迁移后的后台真实化 | 本轮裁决**不迁移** |
| 积分"页面输入可用值"的**浏览器**级断言 | 积分输入区已下线,不存在可注入的 UI;已在 §5.3 用 DB 零落点 + 服务端字段零响应 + 单测三条替代 |

---

## 11. 残留数据清单

| 表 | 残留 |
|---|---|
| 表数 | **23**(V6~V11 未应用) |
| `user` | 8 行(种子 3 + `qa_b_*`×2 + `qa_d_*` + `qa_reg_*` + 本轮 `qa_h_*`) |
| `product` | 4 行(种子 3 + TASK-001 探针 `4 QA探针商品-改名`);库存/销量因历轮下单而变化 |
| `product_order` / `payment` | 历轮累积(含 D 阶段 11 笔 `已超时`);本轮 H 新增无券 198.00 与用券 178.20 两单 |
| `user_coupon` | 3 行(uid 5/6/8 的 WELCOME10,均 `used`) |
| `shipping_address` / `return_request` / `user_notification_pref` | 历轮累积少量行 |
| `shopping_cart` / `stock_alert` | 空 |

**未做任何清理**(无权直连写库);种子账号的密码/角色/状态/余额**未被修改**。

---

## 12. 证据索引

| 类别 | 位置 |
|---|---|
| G1 日志 | 容器 `/tmp/qa-h-mvn.log`(194/0F/0E/BUILD SUCCESS);surefire `/workspace/target/surefire-reports/*.txt` |
| G2 原始输出 | `/tmp/qa-h-tsc-src.log`、`-tsc-test.log`、`-vitest.log`、`-build.log`、`-lint.log` |
| e2e | `/tmp/qa-h-e2e.log`(首次:1 条我的新用例失败)、`/tmp/qa-h-e2e2.log`(**132 passed**) |
| 真实 HTTP 原始报文 | 容器 `/tmp/qa-b/resp/H-*.http` 与 `.req` |
| 结构化结果 | `/tmp/qa-b/out/h-g3g4.json` |
| 本轮脚本(可复跑) | `docs/TASK-001/_b-evidence/`:`run-gates-h.sh`、`restart-backend.sh`、`wait-ready.sh`、`regen-tokens.sh`、`80h-g3g4.py`、**`82h-blki1-seq.py`**(BLK-I1 判据①的真实 HTTP 序列)、`mock-catalog.py`、`ctx.sh` |
| 临时诊断 | 已全部删除(`web/tests/_diag-ctl*.spec.ts` ×3);`Get-ChildItem web/tests -Filter '_diag*'` = **0** |
