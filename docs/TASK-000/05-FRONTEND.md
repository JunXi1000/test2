# TASK-000-E1 前端 · 四态补齐 / 编造数据下线 / 结算契约调整

> 产出者：frontend Agent｜任务：TASK-000-E1（task-5）｜日期：2026-10-01
> 配套文档：[`05-FRONTEND-MAP.md`](./05-FRONTEND-MAP.md)（假数据与接口映射清单，请转后端与 Reviewer）

---

## 0. 交付摘要

| # | 工作项 | 状态 |
|---|--------|------|
| 1 | vue-tsc 错误基线 | ✅ 基线 0，交付后 0，**新增 0** |
| 2 | 硬编码假数据扫描 → `05-FRONTEND-MAP.md` | ✅ |
| 3 | 五页四态补齐 | ✅ |
| 4 | 既有契约接口层类型补齐 | ✅（`OrderSummary` 按新契约收紧） |
| 5 | F1 编造评价下线 | ✅ |
| 6 | 结算页运费/税/免邮调整 | ✅ |

---

## 1. 关键判断：没有新建四态组件

原任务描述是「抽通用可复用的四态组件」，**我判断这是错的指令并报备，获批准后改为「逐页补齐」**。

理由（均已核实，非推测）：

- `components/ui/state/` 下 `EmptyState` / `ErrorState` 与 `Skeleton` **已完备**，
  且 `cva` + `tailwind-merge` 风格与令牌化配色（无 `dark:` 变体）**已经是对的**。
- 全项目 **14 个页面**已在用这套体系，`CLAUDE.md §2` 还规定了 `variant` 两种形态的适用边界。
- 再抽一套「通用组件」只会产生与既有体系并行的第二套实现，14 个页面的新旧组件并存。

**真实缺口不是「缺组件」，而是「5 个页面没接这套体系」**。所以本次交付的是 5 个页面的修复。

---

## 2. 四态补齐（逐页）

| 页面 | Loading | Empty | Error | 改动要点 |
|------|---------|-------|-------|---------|
| `merchant/Wallet.vue` | ✅ 新增 | ✅ 新增 | ✅ 新增 | **三态全缺 → 全补**，见 §2.1 |
| `merchant/Settings.vue` | — | — | ✅ 新增 | 取数失败时**不出表单**，见 §2.2 |
| `admin/Settings.vue` | ✅ 新增 | — | 已有 | 补首帧骨架屏，见 §2.3 |
| `admin/AdminHome.vue` | 已有 | ✅ 新增 | 已有 | 统计/图表/近期用户三块补空态 |
| `merchant/MerchantHome.vue` | 已有 | ✅ 新增 | 已有 | 统计网格 + 低库存列表补空态 |

### 2.1 `merchant/Wallet.vue` —— 最严重的一处

这是全项目最危险的一处**静默失败**，原先代码里甚至有注释把它列为「有意排除」：

> `L739-741`：本页没有 error ref / isLoading……所以这一处**刻意不迁 useAsyncTask**

后果是：钱包接口失败时，余额区停在初始值 `$0.00`、流水表渲染成空表，
只有一个转瞬即逝的 toast。用户看到的不是「加载失败」，而是**「我余额是 0」**。

改法（与 `merchant/Orders.vue` 完全同构，不发明新写法）：

- `loadData` 改走 `useAsyncTask({ fallbackMessage: 'Failed to load wallet data', initialLoading: true })`
- 余额/待结算两处在加载时渲染 `Skeleton`，**不再显示 `$0.00`**
- 表格区与 `ErrorState` **互斥**（`v-if` / `v-else`），错误时整块换成带 Retry 的错误态
- `el-table` 的 `#empty` 插槽换成 `EmptyState`（与 `merchant/Orders.vue` 同样处理 EP 内建英文 "No Data"）
- 原始抛出物进 `console.error`，用户可见文案走 `ErrorState`

> ⚠️ `$` 货币符号在改造中一度被误删，已发现并修复 —— 前后各一次 `toFixed` 渲染均保留 `$` 前缀。

### 2.2 `merchant/Settings.vue`

原先取数失败只弹 toast，**表单照常渲染成全空的可编辑表单**，商家顺手点 Save 就把空值写回服务端。
这与 `admin/Settings.vue` 注释里描述的危险完全同类 —— 那一页修了，这一页没修。现已同构修复。

### 2.3 `admin/Settings.vue`

`useAsyncTask` 未传 `initialLoading`，首帧先渲染全空表单再跳变。已补 `initialLoading: true` + `Skeleton`。

### 2.4 空态与响应式

新增空态全部复用 `EmptyState` 的 `variant="compact"`（侧栏/局部结果场景），
**未新增任何样式体系**，未引入 `dark:` 变体（`admin/**` 是永久暗色域，按 `CLAUDE.md §6` 不得加）。

**响应式复核结论：无新增违规，且原本就合规** ——
`admin/*` 的宽表格由 `tailwind.css:106-108` 的 `.admin-table-shell`（含 `overflow-x-auto`）兜住，
`merchant/Wallet.vue:82` 自身也有 `overflow-x-auto`。本次未引入任何固定宽度或新溢出风险。

---

## 3. F1：编造评价下线（总控已批准）

### 改动

`api/modules/reviews.ts` 新增开关 `SEED_REVIEWS_ENABLED = false`，`getSeedReviews()` 据此返回空数组。

### 为什么保留常量而不是删掉

1. `reviews.ts` L40-41 约定「id ≤ 100 是种子、`Date.now()` 是用户新写」的分界，
   `useProductReviews` 的 `migratedSeedIds` 仍在读这个区间；删常量要连带改判定，属于扩大改动面。
2. 后端 `GET/POST /products/:id/reviews` 就位后应整体删除，保留常量便于对照还原。

### 连带的文案修正

删种子后评价区会是「0 条评价」，但空态原文案是 **"No reviews match your filters."** ——
这在一个评价都没有的时候是**误导**（暗示有评价但被筛掉了）。已改为区分两种情况：

| 条件 | 文案 | 是否给「清除筛选」按钮 |
|------|------|---------------------|
| 一条评价都没有 | `No reviews yet. Be the first to share your experience.` | 否（重置无意义） |
| 有评价但被筛掉 | `No reviews match your filters.` | 是 |

### NaN 风险已核实排除

`reviewAvg`（`useProductReviews.ts:130`）有 `if (!merged.length) return 0` 守卫，
`ratingDistribution`（`L143`）用 `Math.max(...dist, 1)` 防除零 —— **无 NaN 风险**，未改这两处。

---

## 4. 结算页运费/税/免邮调整（总控追加范围）

### 改动清单

| 位置 | 改动 |
|------|------|
| `pages/Checkout.vue` | **移除运费行与税费行**（原 L983-996） |
| `pages/Checkout.vue` | **移除信任栏「Free Ship」徽章**，栅格 `grid-cols-3` → `grid-cols-2` |
| `pages/Checkout.vue` | 订单落库时 `shippingFee` / `tax` 用 `Number(...) \|\| 0` 兜底，避免 `undefined` 写进订单记录 |
| `pages/Cart.vue` | **移除「满 $200 免邮」进度条**（原 L268-290）与随之失效的 `freeShippingRemaining` |
| `composables/useOrderSummary.ts` | `prePointsTotal` **不再计入运费与税**；新增 `amount()` 兜住契约漂移 |
| `api/modules/checkout.ts` | `OrderSummary.shipping` / `.tax` **改为可选**，让「字段没回来」在类型上可见 |
| `utils/format.ts` | `formatPrice` 新增 `toAmount()` 兜底 —— 对齐它姊妹函数 `formatPricePlain` 早已有的防御 |

### 保留了什么

- **满减行**（`tieredDiscount` = `summary.discount`）—— **服务端算的**，不是前端常量，保留。
- **优惠码行**（`promoDiscount`）—— `/checkout/promo` 经 coupon 表校验，保留。
- **积分抵扣行**（`pointsDiscount`）—— 独立功能，与「免邮/满减」不同族，保留。

### 金额防御（总控点名的 NaN 风险）

`formatPrice` 原先是 `n.toLocaleString(...)`，对 `undefined` 会直接印出 **"NaN"**。
现按 `formatPricePlain` 的既有做法统一兜底为 `$0.00`。**对合法数字零影响**。

并在 `useOrderSummary.spec.ts` **新增一条回归测试**：后端不返回运费/税时，
`total` 必须是有限数、绝不出现 NaN。

### ⚠️ 需要总控注意的中间态

前端已按新契约消费，但后端 TASK-000-I 落地前，`/checkout/summary` **仍会返回运费与税**。
此刻前端会**忽略**它们 → 若后端仍在按运费计费，结算页会**少显示运费**。
这是总控明示的「两边同批完成」的过渡态，我按指令执行并在此显式记录。

---

## 5. 质量闸门

```
vue-tsc --noEmit  (src/, 163 files)          基线 0  →  交付后 0    新增 0
vue-tsc --noEmit -p tsconfig.test.json      基线 0  →  交付后 0    新增 0
```

**基线获取方式需说明**：`web/node_modules` 目录存在但**为空**（依赖从未安装），
且我的 shell 无权在 `web/` 下写文件（沙箱策略，非 ACL 问题）。
故在 `%TEMP%\fe-deps` 另装依赖、镜像 `web/src` 与 tsconfig 后运行。基线**有效**，
但 `npm run typecheck` / `test:unit` / `test:e2e` 在正式依赖装好前都跑不起来 —— 已转 DevOps。

**单测未能执行**：`vitest` 需要 esbuild 起子进程，被沙箱以 `spawn EPERM` 拦下。
因此我对受影响的 spec 做了**人工逐条核对**（见 §6），未依赖运行结果。

---

## 6. 对既有测试的影响（已逐条核对）

| 文件 | 影响 | 处理 |
|------|------|------|
| `web/src/composables/useOrderSummary.spec.ts` | 运费/税移出后 **7 处 `total` 断言失效**（`115`→`100` 等） | ✅ **已更新**，并新增 NaN 回归测试 |
| `web/src/api/modules/checkout.spec.ts` | 未改 `checkout.ts` 的 mock 计算逻辑 | ✅ 不受影响 |
| `web/tests/product-reviews.spec.ts` | **整份围绕 8 条种子评价构造，必然失败** | ❌ 不在前端写入范围，**已上报 QA** |
| `web/tests/e2e-functional.spec.ts` L791/L815 | 满减与优惠码行**仍保留**，预期仍通过 | ⚠️ 建议 QA 跑一遍确认 |
| `web/src/utils/error.spec.ts` 等其余 spec | 与本次改动无交集 | ✅ 不受影响 |

---

## 7. 变更文件清单（14 个，全部在 `web/src` 与 `docs/TASK-000` 内）

**四态补齐**
- `web/src/pages/merchant/Wallet.vue`
- `web/src/pages/merchant/Settings.vue`
- `web/src/pages/merchant/MerchantHome.vue`
- `web/src/pages/admin/Settings.vue`
- `web/src/pages/admin/AdminHome.vue`

**编造数据下线**
- `web/src/api/modules/reviews.ts`
- `web/src/components/ui/product/ReviewSection.vue`

**结算契约**
- `web/src/pages/Checkout.vue`
- `web/src/pages/Cart.vue`
- `web/src/composables/useOrderSummary.ts`
- `web/src/composables/useOrderSummary.spec.ts`
- `web/src/api/modules/checkout.ts`
- `web/src/utils/format.ts`

**文档**
- `docs/TASK-000/05-FRONTEND-MAP.md`
- `docs/TASK-000/05-FRONTEND.md`（本文件）

> 未修改 `src/main/java`、`sql/`、`docs/backend-api.md`、`web/tests/` —— 与 backend / database / QA 无写入冲突。

---

## 8. 未做与后续

| 项 | 归属 | 说明 |
|----|------|------|
| 5 个页面的**真实接口对接** | TASK-000-E2 | 等 task-4，契约未定不做 |
| `admin/Products.vue:134` 占位描述文案 | 待总控/后端 | 已批准 `GET /admin/products` 返回 `description`，等后端落地即可改 |
| 钱包流水带符号口径 | 待 database | 已批准带符号，前端 `Wallet.vue:113` 已按符号渲染，无需改动 |
| 游客购物车合并 | TASK-000-E2 | 策略已批准「数量相加 + 超库存截断 + **必须可见截断**」，待实现 |
| 商家收款方式持久化 | 优先级最低 | 无表无端点，仅本地可用 |
| `product-reviews.spec.ts` 重写 | **QA** | 见 §6 |