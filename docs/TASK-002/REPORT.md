# TASK-002 交付报告：修到可验收（方案 A）

> 依据 `Agent-System-Prompt.txt` §二十二（最终交付标准）/ §十七（用户只看结论与可决策信息）/ §二十一（验收 ≠ 采信声明）。
> 上一轮（TASK-001）的验收结论见 [../TASK-001/REPORT.md](../TASK-001/REPORT.md)。
> 本轮所有数字均来自实跑或 Lead 亲自复跑，不复述任何 Agent 的口头声明。

---

## 一、结论摘要

| 验收目标 | 判据 | 结果 |
|---|---|---|
| **G1 后端测试闸门** | `mvn -B clean test` failures=0 且 errors=0 | ✅ **194 run / 0 failures / 0 errors / BUILD SUCCESS**（本轮起点 171/11F/1E） |
| **G2 前端闸门** | `npm test` = `vue-tsc`×2 + `lint` + `vitest`，另加 `build-prod` | ✅ 五项全 rc=0：`vue-tsc`(src) **0** · `vue-tsc`(tests) **0** · `vitest` **227 passed / 14 files** · `build-prod` ✓ · `lint` **0 errors**（13 warnings 全为存量豁免，无新增、未删表项） |
| **G3 券链路可用** | 登录+已领券 → `200` 且减免正确；匿名 → `401` | ✅ 减免 **19.80**；匿名两端点 **401**；决定性对照：**同一 token** 打 `/addresses` **200** 与 `/checkout/promo` **200** |
| **G4 金额一致** | `summary.total == create.amount == payment.amount == Σ product_order.total_money` | ✅ 无券 **198.00**、用券 **178.20** 四方全等；且 `total == subtotal − discount` 精确成立（**无第三层扣减**） |
| 回归 | e2e + 回归矩阵 | ✅ Playwright **132 passed / 0 failed**；回归矩阵（授权格、幂等、并发不超卖、后台聚合对拍）通过 |

**一句话**：方案 A 的四项目标全部达成；上一轮判定的 **5 个 Blocker 全部闭环**，且过程中把"页面显示额 ≠ 实际扣款"这一**已复发三次**的缺陷类按根因消灭（详见 §四）。仍未闭环的是上一轮清单里**不在方案 A 范围内**的 2 个 Major 与若干 Minor（详见 §七）。

---

## 二、本轮范围与方法

用户裁决：**方案 A —— 修到可验收**。

| 环节 | 做法 |
|---|---|
| **先冻结契约再派活** | 上一轮 BLK-4 的成因是"后端新增了 `code` 通道、前端从未发送"——**契约未冻结时前后端会各自发明签名**。故 Lead 先定死 C0–C7（见 [00-AGENT-REGISTRY.md](00-AGENT-REGISTRY.md)），三方按同一份契约实现，**任何一方认为契约有误只能回报 Lead** |
| **写范围互斥** | `backend-fix`→`src/main/**`、`frontend-fix`→`web/src/**`、`qa`→`src/test/**`+`web/tests/**`、`code-reviewer`→只读。零文件重叠，从设计上消除覆盖写 |
| **容器独占锁** | 唯一共享资源是容器 `nexus-dev`。P1 只放行一次编译、P2 归 qa 跑闸门、P3 归 Lead 终验；期间其他人不得进容器 |
| **Review Gate ×2** | 第一轮（task-11）判 `conditional` + BLK-E1；第二轮（task-17）判 `conditional` + BLK-I1。两轮都**无需回退任何修复** |
| **不采信声明** | 每个关键数字都要求原始报文/日志；Lead 另起炉灶复跑（§六） |

---

## 三、修复清单（按上一轮 Blocker 逐条追溯）

| 上一轮缺陷 | 修复 | 关键位置 |
|---|---|---|
| **BLK-1 券入口对所有人 400**（白名单使守卫永远无法满足） | **C0 两步**：① 从 `SpringMvcConfig.excludePathPatterns` 删除 `/checkout/summary`、`/checkout/promo`；② **同时**在 `AuthzRules` 新增 `Rule("/checkout/**", USER)` | `SpringMvcConfig.java:20-39`、`AuthzRules.java:73-81` |
| **BLK-2 `StorefrontPromoTest` 10F+1E** | 按新契约重写为 15 例（正例带 token + 先领券；匿名 401 锚点；未领/已用/过期/下架/未达门槛各成例；两条硬编码兜底码用例改判 400）——**没有为绿灯恢复兜底码** | `StorefrontPromoTest.java` |
| **BLK-3 409/400 口径不一致（1F）** | 裁决**定为 400**（400=请求参数错误的标准语义），同步 `CheckoutSummaryDTO` javadoc 与 `RequestShapeTest` | `StorefrontCheckoutController.java:99/103`、`RequestShapeTest.java:75-81` |
| **BLK-4 优惠码通道无人发送** | `code` 全链贯通：`calculateOrderSummary(items,zip,code)`；`payment.ts` payload 带 `code`；`usePaymentFlow` 经必填 `discountCode` 取值；结算页**同一个码**喂 summary 与 payments/create；删掉"减两次" | `checkout.ts`、`payment.ts`、`usePaymentFlow.ts`、`Checkout.vue` |
| **BLK-5 购物车页金额 ≠ 实扣** | `Cart.vue` 删净自算运费/税/满减（`SHIPPING_FEE`/`TAX_RATE`/满减档/合计式/模板行），新增 `useCartSummary` 走 `/checkout/summary`；匿名不取数、只提示登录 | `Cart.vue`、`useCartSummary.ts` |
| **MAJ-3 五处「200 假成功」** | 4 处未实现写端点改 **501**（`PUT /admin/settings`、`PUT /merchant/settings`、`POST /merchant/wallet/withdraw`、`PUT /addresses/{id}/default`，后者**先归属校验再 501**）；`/account/notifications` 归因为**缺参数校验**（C6：三偏好全缺 → 400），**未误降级为 501**；前端 3 页做成诚实 UI（禁用 + 说明 + `toErrorMessage`） | `AdminApiController`、`MerchantApiController`、`StorefrontAddressController`、`StorefrontAccountController`、`admin/Settings.vue`、`merchant/Settings.vue`、`merchant/Wallet.vue` |
| **文档反向漂移** | `backend-api.md` 13 处 + `STARTUP.md`（V1…V11 口径、批次标记短路真因）+ `AdminApiController` 注释；含"兜底 SAVE10/VIP15""重算运费/税/满减""订单行数→订单单数" | `docs/backend-api.md`、`docs/STARTUP.md` |
| **MAJ-E3 通知偏好静默重置**（Review Gate 新发现） | `StorefrontAccountController` 改 **load-then-merge**（未提交字段保留库中现值，仅无记录时落默认值）；qa 补**判别用例**（全量 `{false,true,false}` 再部分 `{emailPromo:false}` ⇒ 断言 `0/0/0`；旧实现会得 `1/0/1`） | `StorefrontAccountController.java:101-121`、`AccountNotificationContractTest` |
| **护栏（防复发）** | `AuthzRegistrationGateTest` 新增第 3 条断言：**白名单路径不得依赖登录态**（现为绿，守的是将来） | `AuthzRegistrationGateTest` |

---

## 四、本轮的真正价值：把一类缺陷按根因消灭

这不是"修了 5 个 Blocker"，而是**同一类缺陷在一轮内暴露了三次**，每一次的通道都不同：

| 次序 | 通道 | 症状 | 机制 |
|---|---|---|---|
| BLK-4（上一轮） | **优惠码** | 用券时页面显示额 < 实扣 | 客户端的 `code` 从未发给后端 |
| BLK-E1（Review Gate 第一轮） | **积分** | 用积分时页面显示额 < 实扣 | 应付额仍是客户端自算，且减掉了后端**完全不认**的积分 |
| BLK-I1（Review Gate 第二轮） | **items 变化** | 结算页内加购后 Total 是旧值、实扣按新 items | 摘要**不重取**（服务端值过期） |

**处置上的一致取舍**：三次都**拒绝**用"收窄验收口径 / 记为 known-gap"把它压下去，而是消根因。最终状态：

- **应付额只有两个产出点**，且都只消费服务端 `summary.total`（`useOrderSummary.ts:84`、`useCartSummary.ts:64`），**刻意不写任何 fallback 算式**（"fallback 就是口径重新分叉的入口"）；两份逐字相同的私有 `amount()` 已合并为 `utils/amount.ts` 一份。
- **积分彻底退出应付口径**（输入区下线、5 个状态变量与相关 import 全删，并用 `not.toHaveProperty` 做接口级钉子）。
- **顺带堵住第二个资损面**：`Checkout.vue` 的 `loyaltyStore.spendPoints(...)` 已删——原行为是**抵扣不生效却真扣用户余额**。
- **items 变化改为绑数据而非绑动作**：`useOrderSummary.ts:151-158` 用价格签名（`id:quantity:price`）触发重取，配 `shouldRefetch` 闸门与 `fetchSeq` **乱序守卫**（否则自动重取反而会引入"旧值覆盖新值"的新不一致）；购物车页的**同形缺口**一并修掉。
- **判别用例（真能咬住回归）**：造 `subtotal−discount=85` 而服务端 `total=99` 的回包，断言页面值是 **99**——任何"看着对"的重算接回来即刻变红。两条同构钉子（结算页 + 购物车）均就位。
- Review Gate 第二轮给出**确定结论：应付额不存在第三处自算路径**（更宽的"客户端自算金额"另有 5 处，逐条分类，均不影响扣款）。

---

## 五、环境事故与处置（如实记录）

**Docker Desktop 在执行中停止运行**，容器与前后端全部下线，导致 H（qa）与 I（code-reviewer）**双双在执行中被中断**，两个任务停在 `in_progress`。

- **判定**：Docker 进程仍在但 Linux engine 命名管道不可用 ⇒ 判为引擎重启，非配置损坏；等待后自动恢复。
- **处置**：不重派已完成的工作——保留已落盘产物（I 的复审结论有效），恢复后只补未完成部分（H 的报告当时仍是修复前数字，已要求用本轮实跑**覆盖**）。
- **值得记的两条环境陷阱**（本轮两次踩到）：
  1. **Vite 会漏掉 `web/src` 变更**：dev server 曾吐出旧版 `router/index.ts`，把"匿名 `/checkout` 应落登录页"误判为"落 `/cart`"。**改完 `web/src` 必须先重启 Vite 再跑 e2e**，否则假红/假绿。
  2. **`nohup … &` 会随 `docker exec` 会话收 SIGHUP 被杀** ⇒ 长驻 dev server 必须 `setsid -f`。
  3. 这与 TASK-001 的"陈旧 class"（运行态早于源码改动）是**同一类问题**：**跨文件改动后，运行态必须重启才可信**。

---

## 六、Lead 独立终验（不采信声明）

| 检查 | 方式 | 结果 |
|---|---|---|
| 就绪判据 | 匿名 `GET /` | **401**（就绪）；前端 `:5173` **200** |
| G3 券链路 | **Lead 复跑** qa 的证据脚本 `80h-g3g4.py` | 复现：`/addresses` 200 + `/checkout/promo` 200（减免 19.80）、匿名 401；券核销恰好一次 |
| G4 金额一致 | 同上 | 复现：无券 198.00、用券 178.20 **四方全等**；`total == subtotal − discount` |
| **积分层不存在**（U-4） | 同上，**注入** `pointsDiscount:50` / `pointsToUse:5000` | `total` 仍为 **198.00** ⇒ 字段被完全忽略；DB 中"含 point 的表/列"查询为空 |
| BLK-I1 闭环 | **Lead 复跑** `82h-blki1-seq.py` | 复现：加购 198.0 → **347.0**（增量 149.0 恰为新加商品单价）→ create/payment/Σ 均为 347.00，四方一致 |
| G1/G2 闸门 | **Lead 亲自复跑** `_z-evidence/z-gates.sh` | 见下方"独立复跑结果" |
| 写入范围合规 | `git diff --stat` 与 `git status` | 本轮净增 `74 files changed, +3609/−1336`（TASK-001 基线 56/+1895/−714）；**未发现越界写入**，业务代码仅由对应 owner 修改 |

**Lead 独立复跑结果（原始输出见 `_z-evidence/z-gates.out`，与 qa 报告互不影响地印证）**：

| 复跑项 | 结果 |
|---|---|
| `mvn -B clean test` | `mvn_exit=0`；`Tests run: 194, Failures: 0, Errors: 0, Skipped: 0`；`BUILD SUCCESS` |
| `vue-tsc --noEmit`（src） | `exit=0` |
| `vue-tsc --noEmit -p tsconfig.test.json` | `exit=0` |
| `npx vitest run` | `exit=0`；`Test Files 14 passed (14)`；`Tests 227 passed (227)` |
| `npm run build-prod` | `exit=0` |
| `npm run lint` | `exit=0`；`13 problems (0 errors, 13 warnings)`（存量豁免，无新增） |
| 环境恢复 | 后端 `GET /` **401**、前端 `:5173` **200**、`/api` 代理 200（返回真实聚合数据）、DB 仍 **23 表** |

> 复跑过程中发现并修正了我自己取证脚本的一处探针 bug（`curl` 失败时已输出 `000`，再叠加 `|| echo 000` 成 `000000`，被误判为"就绪"而提前退出）⇒ 已改为先取非空且非 `000` 的值。**这条 bug 本身也说明为什么不能只看脚本退出码**：脚本"跑完了"不等于"验到了"。

---

## 七、仍未闭环的项（不在方案 A 范围，如实列出）

| # | 项 | 状态 | 建议 |
|---|---|---|---|
| 1 | **营收环比恒 0 或负**（`AnalyticsMapper.xml` 的 `paidOrderFilter` 只有下界无上界 ⇒ `previousStart` 是 `recentStart` 的超集） | ❌ 未修（TASK-001 MAJ-1，**不在方案 A 范围**） | 下一轮 P1（补上界或改用减法修正；`AnalyticsServiceImpl` 第 91/103 行已有正确写法可照抄） |
| 2 | **转化率恒 100%**（`:158` `allRecent = ordersRecent` ⇒ `ratio` 恒 1.0） | ❌ 未修（TASK-001 MAJ-2） | 同上 |
| 3 | **孤儿 schema**：V6~V11 的 18 个对象实现引用数全为 0 | ⏸ 已裁决本轮不应用 | 与钱包/设置/评论审核的 Java 实现**同批**交付 |
| 4 | **H2 测试库比真实 MySQL 库更完整**（`mvn test` 绿 ≠ 真实库就绪） | ⚠️ 记账 | 端到端必须继续在 MySQL 上做（本轮已如此） |
| 5 | entrypoint 批次标记短路（已有卷永久漏迁移） | ⚠️ 记账 | 与 #3 同批修 |
| 6 | `GET /products/999999` → 200 + `data:null`（应 404） | ❌ 未修（Minor） | 下一轮 |
| 7 | Review Gate 的护栏建议 G-1…G-6（branded `ServerPayable`、源码形状哨兵、契约硬约定"金额规则归服务端"…） | 📋 建议 | 优先 G-1/G-3/G-4（成本最低、防复发最有效） |
| 8 | MIN-I1：`admin/Merchants.vue:234` 客户端硬编码 5% 佣金率（服务端已有 `commission_rate`） | ❌ 未修（Minor） | 下一轮（护栏 G-4 的首个整改对象） |
| 9 | 未覆盖项：受控超时实验、balance 渠道退款回补正路径、文件上传统、管理端副作用、`/chat/*` 端到端、评价子系统（表 0 行）、多浏览器（仅 chromium） | ⏸ | 见 [06-TEST-REPORT.md](06-TEST-REPORT.md) §10 |

---

## 八、必须向用户披露的可见行为变更

> 这些都是"诚实化"的副作用：以前页面在**假装**某事可用/有数据，现在如实表达。**请确认是否接受**。

| # | 变更 | 之前 | 现在 | 原因 |
|---|---|---|---|---|
| 1 | **商品详情页不再展示演示评价** | 8 条**编造**评价（Alex Chen、Sarah Miller…） | 空态「No reviews yet…」+ `0 reviews` | 本批刻意关闭 `SEED_REVIEWS_ENABLED`（后端评价表 0 行，秀假数据属欺骗）。**后端评价端点就位后翻回 `true` 即可恢复** |
| 2 | **积分不再可抵扣** | 结算页可输入积分，页面显示"已抵扣"（但后端不认，实扣不减 ⇒ 用户白掉积分） | 积分输入区下线，仅保留只读余额 + 「暂不可抵扣」说明 | 后端零积分概念；保留假抵扣＝继续制造"显示额≠实扣" |
| 3 | **匿名购物车看不到应付总额** | 显示一个**自算的**总额（含不存在的运费/税，且 ≠ 实扣） | 显示本地小计 + 「登录后可见总额」 | C0 要求 `/checkout/summary` 必须登录；匿名自算＝又一套口径 |
| 4 | **匿名访问 `/checkout` 会跳登录** | 匿名可打开结算页（随后被 401 当成"会话过期"清 token） | 干净跳 `/login?redirect=/checkout` | 避免把访客当过期用户处理 |
| 5 | **4 处写端点由「200 假成功」改为 501** | 保存/提现点击后返回 200 但**什么都没发生** | 501 + UI 明示不可用 | 未实现的写端点不该假装成功（其中**提现被静默吞掉**资损语义最重） |

---

## 九、是否提交 git（建议，等你授权）

本轮**未提交任何内容**。当前工作树已膨胀到 `74 files changed, +3609/−1336` + 大量未跟踪文件；TASK-001 的经验表明**长期悬空的工作树正是"运行态与代码不一致"的温床**。

**建议的 commit 切分**（等你确认后执行；`web/.husky` 钩子会在 `web/src` 变更时跑 `typecheck`）：

1. `fix(TASK-002): 券入口鉴权与优惠码全链贯通（C0 两步 + code 透传）`
2. `fix(TASK-002): 应付额唯一来源化 —— 结算/购物车消费服务端 total，积分退出扣款口径`
3. `fix(TASK-002): 未实现写端点诚实降级（4×501 + 通知偏好参数校验与 load-then-merge）`
4. `fix(TASK-002): 结算页 items 变化重取摘要 + 乱序守卫`
5. `test(TASK-002): 同步 12 条红测试并补回归网（券链路/金额一致/降级副作用/白名单护栏）`
6. `docs(TASK-002): 修正反向漂移（backend-api/STARTUP）与 TASK-002 治理记录`

---

## 十、产物索引

| 文件 | 负责人 | 内容 |
|---|---|---|
| [00-AGENT-REGISTRY.md](00-AGENT-REGISTRY.md) | Lead | 契约 C0–C7、写范围、容器锁协议、23 条调度日志（含被证伪项与事故处置） |
| [04-BACKEND-FIX.md](04-BACKEND-FIX.md) | backend-fix | 契约落实位置、状态码变更、G2 三处收口、测试同步清单 |
| [05-FRONTEND-FIX.md](05-FRONTEND-FIX.md) | frontend-fix | `code` 传递路径、购物车口径、B2/B3/G1/G1b/G1c/G1d 各节、**应付额来源唯一化核对清单** |
| [06a-TEST-SYNC.md](06a-TEST-SYNC.md) | qa-acceptance | 测试同步说明与新增回归网 |
| [06-TEST-REPORT.md](06-TEST-REPORT.md) | qa-acceptance | 本轮实跑数字、G1–G4 结论、BLK-E1/BLK-I1 闭环证据、未覆盖项、残留数据 |
| [07-CODE-REVIEW.md](07-CODE-REVIEW.md) | code-reviewer | 第一轮结论 + 第二轮 BLK-E1 复审、第三处排查、护栏建议 G-1…G-6 |
| [_z-evidence/z-gates.sh](_z-evidence/z-gates.sh) | Lead | **Lead 亲自复跑 G1/G2 闸门**的脚本（可复跑） |
| [_z-evidence/z-gates.out](_z-evidence/z-gates.out) | Lead | 上述复跑的原始输出 |
