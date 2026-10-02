# TASK-000-E1 前端 · 硬编码假数据扫描与接口映射清单

> 产出者：frontend Agent｜任务：TASK-000-E1（task-5）｜日期：2026-10-01
> **用途**：本清单同时是前端的工作底稿，**也是后端的缺口输入**。每条给出精确行号与期望字段。
> **扫描范围**：`web/src/pages/admin/**`、`web/src/pages/merchant/**`（管理端 + 商家端全部页面）。

---

## 0. 一句话结论（总控请先读这段）

**管理端/商家端的页面本身几乎不写死业务假数据 —— 它们早已调用真实接口。**
真正的"假数据"分两处：**后端返回体里**（接口存在、路径正确、类型对齐，但服务端返回硬编码值），
以及 **§2 列出的前端编造数据**。

| 类别 | 数量 | 说明 | 详见 |
|------|------|------|------|
| **A. 后端返回假数据**（前端已就绪，等后端） | 8 个端点 | 页面已在调、类型已对齐；后端换成真实聚合即可，前端零改动 | §3 |
| **B. 前端四态 / 本地存储缺口** | 6 处 | 需前端改 | §4 |
| **F1. 前端编造评价**（🔴 最高危） | 8 条 | **无 mock 守卫，生产可见**，含伪造「已验证购买」与伪造商家回复 | §2 F1 |
| **F2. 前端编造评分/销量**（mock 内） | 6 处 | 生产不可见，但污染 E2E 与截图 | §2 F2 |
| **F3. 审计误报澄清** | 2 个 store | `followedStores`/`loyalty` **无编造数据**，已排除 | §2 F3 |
| **F4. 游客购物车合并**（P0） | 1 处 | 登录后被静默丢弃，**无需后端新增** | §2 F4 |

> ⚠️ 页面级硬编码假文案仅 1 处：`admin/Products.vue:134` 的商品描述占位符（§5）。

---

## 1. 页面清单与四态现状

图例：`✅` 已有｜`❌` 缺失｜`—` 不适用

| # | 页面 | Loading | Empty | Error | Success | 数据来源（api/modules） |
|---|------|---------|-------|-------|---------|------------------------|
| 1 | `admin/AdminHome.vue` | ✅ L120-128 | **❌** | ✅ L130 | ✅ L131-140 | adminDashboard |
| 2 | `admin/Merchants.vue` | ✅ L49 | ✅ L186 | ✅ DataTablePanel | ✅ | adminMerchants |
| 3 | `admin/Orders.vue` | ✅ L45 | ✅ L110 | ✅ DataTablePanel | ✅ | adminOrders |
| 4 | `admin/Users.vue` | ✅ L43 | ✅ L136 | ✅ DataTablePanel | ✅ | adminUsers |
| 5 | `admin/Reviews.vue` | ✅ L43 | ✅ L151 | ✅ DataTablePanel | ✅ | adminReviews |
| 6 | `admin/Products.vue` | ✅ | ✅ L53 | ✅ DataTablePanel | ✅ | adminProducts |
| 7 | `admin/Settings.vue` | **❌** | — | ✅ L4 | ✅ L6-77 | adminSettings |
| 8 | `admin/Notifications.vue` | ✅ | ✅ L15 | ✅ L13 | ✅ | notifications |
| 9 | `merchant/MerchantHome.vue` | ✅ L47-60 | **❌** | ✅ L61 | ✅ L62-79 | merchantDashboard |
| 10 | `merchant/Orders.vue` | ✅ L59 | ✅ L136 | ✅ L55 | ✅ | merchantOrders |
| 11 | `merchant/Products.vue` | ✅ L67 | ✅ L165 | ✅ L63 | ✅ | merchantProducts |
| 12 | `merchant/Settings.vue` | **❌** | **❌** | **❌** | ✅ | merchantSettings |
| 13 | `merchant/Wallet.vue` | **❌** | **❌** | **❌** | ✅ | merchantWallet |
| 14 | `merchant/Messages.vue` | — | — | — | ✅ | 委托 `ChatWorkspace.vue`（阶段 3 收口，自带状态，**不在本次范围**） |

**响应式复核结论：无违规。**
- `admin/*` 表格：`el-table` 带 `min-w-[680px|880px|900px]`，但外壳 `DataTablePanel` 默认 `admin-table-shell`
  → `tailwind.css:106-108` 已含 `overflow-x-auto overscroll-x-contain`，横向滚动被正确兜住。
- `merchant/Wallet.vue` 表格：`L82` 有 `overflow-x-auto` 包裹 ✅
- `merchant/Orders.vue` / `merchant/Products.vue` 筛选行：`L8` / `L9` `max-sm:overflow-x-auto` ✅
- 两个 Layout 顶栏：`AdminLayout.vue:85` / `MerchantLayout.vue:93` 有 `overflow-x-auto` ✅

> 小瑕疵（非违规）：`admin/*` 页面根节点统一 `p-6`（如 `admin/Users.vue:2`），<768px 下左右各 24px 内边距偏奢侈，
> 建议 `p-4 sm:p-6`。**非阻塞，未改。**

---

## 2. 🔴 前端编造数据清单（高危，总控与 Reviewer 重点看这里）

> 判定口径：**是否包在 `if (USE_MOCK)` 分支内**。
> - **无守卫** → 生产构建（`VITE_USE_MOCK=false`）也会展示 = **消费者可见的虚假宣传**，性质最重。
> - **有守卫** → 仅 mock / 演示 / E2E 环境可见，**不是虚假宣传**，但会污染验收与截图。

### F1 🔴🔴 最高危 · 商品评价 100% 编造 · 无 mock 守卫

**这是全项目最严重的一处：消费者在生产构建里看到的每一条评价都是编造的。**

| 位置 | 编造了什么 |
|------|-----------|
| `web/src/api/modules/reviews.ts` **L43-148** | `SEED_REVIEWS` 共 **8 条**评价，全部凭空捏造 |
| ├ `L46,66,77,88,98,110,120,131` | **8 个不存在的用户名**：Alex Chen / Sarah Miller / Jordan Wang / Emily Zhang / Michael Brown / Lisa Park / David Kim / Rachel Torres |
| ├ `L47,67,78,89,99,111,121,132` | **8 个评分**：5,4,5,3,5,2,4,1（合起来平均 3.6，制造"真实分布"错觉） |
| ├ `L48,69,78,90,100,111,121,133` | **日期** 2026-01-20 ~ 2026-03-25 |
| ├ `L52,72,83,92,104,115,126` | Unsplash **外链头像**（真人照片，冒充买家） |
| ├ `L53,73,84,93,105,116,127,137` | **helpful 票数** 12/8/15/4/20/6/3/9 |
| ├ **`L49,68,79,100,123`** | **`verified: true` —— 伪造「已验证购买」标识**，法律风险最高的一项 |
| ├ `L106` | 评价晒单图片（外链） |
| └ **`L54-62`、`L138-146`** | **伪造商家回复**，署名 `Store Support`，内容为安抚话术 |
| `reviews.ts` **L156-162** | `getSeedReviews()` 深拷贝导出 |
| `reviews.ts` **L173-175** | 按商品 id 存 localStorage：`product_reviews_<id>`、`product_review_helpful_delta_<id>`、`product_review_helpful_voted_<id>` |
| **`web/src/composables/useProductReviews.ts` L73** | `const seedReviews = getSeedReviews()` —— **此处无任何 mock 判断，恒生效** |
| `useProductReviews.ts` **L84-96** | `hydratedSeedReviews` / `mergedReviews` 把种子与用户评价合并后上屏 |
| 影响页面 | `ProductDetail.vue` → `components/ui/product/ReviewSection.vue`（买家可见） |

**为什么评价能凭空出现**：`product_order_evaluate` 表存在，管理端 `GET /admin/reviews` 🟢 是真的，
但**全项目没有任何写入评价的端点** → 管理端列表恒空，而前台却展示 8 条编造评价。
两者合起来说明：**评价功能整体尚未打通**。

**处置建议（同意总控倾向：宁可空态，不要假数据）**
1. **本期即删** `SEED_REVIEWS` 的渲染路径：`hydratedSeedReviews` 改为空数组，`mergedReviews` 只留 `storedReviews`。
2. 评价区在无真实数据时渲染**诚实空态**（`EmptyState`，文案如「暂无评价」），而不是 8 条假评价。
3. **不要删组件/删页面** —— `ReviewSection.vue` 与写评价的交互全部保留，等后端补 `POST` 评价端点后自动接上。
4. 需后端新增：`POST /products/:id/reviews`（写评价）、`GET /products/:id/reviews`（读评价+评分聚合）。
5. `localStorage` 里已落盘的旧种子数据（用户点过 helpful / 回复过的）建议**加版本前缀**或直接作废，避免删了种子却残留。

### F2 🟡 编造评分/销量/粉丝数 —— **均在 mock 守卫内，生产不可见**

| 位置 | 编造了什么 | 守卫 |
|------|-----------|------|
| `api/modules/product.ts` **L366-367** | `rating: +(3.8 + (id % 13) * 0.1)`、`reviews: 30 + ((id * 17) % 400)` —— **最像真实评分**的一处编造 | `L349 if (USE_MOCK)` ✅ |
| `api/modules/product.ts` **L343, L346, L364** | `DEMO_VIDEO_URL` 挂到所有 `id % 4 === 0` 的商品上 | 同上 ✅ |
| `api/modules/merchantPublic.ts` **L51-149** | 店铺评分 `4.5~4.9`、粉丝 `45600 / 32100`、销量 `1800~8900` | `L195 / L223 if (USE_MOCK)` ✅ |
| `api/modules/merchantPublic.ts` **L181-184** | `Math.random()` 生成 20 个商品的 price / rating / sales | 同上 ✅ |
| `api/modules/merchantProducts.ts` **L28-72** | `sales: 120 / 85 / 340 / 0 / 12` | mock 分支 ✅ |
| `api/modules/adminReviews.ts` **L29-109** | 8 条 mock 评价（含评分 5/4/5/1/2/4/1/5） | mock 分支 ✅ |

**结论**：因 `.env` 的 `VITE_USE_MOCK=false` 且 `.env.production` 不覆盖（`docs/MODULES.md §3` 已核实），
**生产产物不会渲染这些**。**不构成虚假宣传。**
但它们会出现在 **E2E 测试与演示环境**里 —— 请 QA 与 Reviewer 知悉：
截图/断言里的"评分 4.8"是 mock 产物，**不能作为验收依据**。

> 📌 顺带回答总控转述的「店铺页编造 rating=4.5」：`StorePage.vue:297` 只是**渲染** `profile.stats.totalReviews`，
> 其数据源在 mock 下是 `merchantPublic.ts` 的硬编码，在真实模式下是 `GET /merchants/:id/profile`
> （后端 🟡「stats 硬编码」）。**前端无编造，编造在后端。**

### F3 ✅ 审计误报澄清（两个 store 我逐一查了，**没有编造数据**）

总控提到审计漏了 `followedStores` / `loyalty` 两个 store。实际核查结果：

| store | 结论 | 依据 |
|-------|------|------|
| `stores/followedStores.ts` | **无编造**。初始 `items` 从 localStorage 读，默认 `[]`（`L22-30, L33`）。`followers?` 字段只是**关注那一刻的快照**（`L15-16 注释` + `L59`），不凭空造数 | `L22-30` |
| `stores/loyalty.ts` | **无编造**。初始为 `EMPTY_STATE = { points: 0, lifetimeSpend: 0, redeemed: [] }`（`L32`），积分只由真实消费累加 | `L32` |

两者都是 **localStorage-only 的功能缺失**（无后端同步），**不是编造数据**。
`docs/MODULES.md §2` 的 localStorage 表格确实漏记了这两项 —— **建议总控让文档补上**，
但它们不属于本清单的「编造数据」范畴。

### F4 🔴 游客购物车登录后被静默丢弃（REQ 3.3 P0）

| 位置 | 事实 |
|------|------|
| `web/src/stores/cart.ts` **L37** | `const serverEnabled = !USE_MOCK` |
| `cart.ts` **L67-68** | `syncFromServer()` 守卫 `if (!serverEnabled \|\| !isLoggedIn()) return` |
| **`cart.ts` L216-223** | `onUserScopeChange` → 登录后直接 `syncFromServer()`，**用服务端购物车覆盖 `items`**，游客 localStorage 里的商品**无任何合并、被静默丢弃** |
| `cart.ts` L208-210 | 非 mock + 登录态时**不写** localStorage，故本地副本在登录瞬间即失去意义 |

**所需后端支持：现有端点已够，本条无需后端新增。**
`/shoppingCart` 的 `page` / `add` / `update` / `delBatch` 四端点均已放行（USER 角色，`docs/backend-api.md §2` 末尾表格）。
合并可在前端实现：登录时读 guest localStorage → 对每个商品调 `/shoppingCart` add → 成功后清 guest 作用域。

**待总控裁决一个产品问题**：合并策略是「数量相加」还是「服务端优先 / 本地优先」？
我建议**数量相加**并对超库存项做上限截断 —— 但这是产品决策，请总控定。

---

## 3. 【A 类】后端返回假数据 —— 前端已就绪，等后端填实

前端**不需要改任何代码**，后端实现后页面自动变真。下表即后端的精确缺口。

### A1. 管理端仪表盘统计

| 项 | 内容 |
|----|------|
| 页面 | `web/src/pages/admin/AdminHome.vue` L33-50 |
| 接口 | `GET /admin/dashboard/stats` |
| 前端类型 | `AdminStat[]` = `{ label: string; value: string; change: string; icon: 'DollarSign'\|'Users'\|'ShoppingBag'\|'Activity' }`（`adminDashboard.ts:4-9`） |
| 后端现状 | 🔴 硬编码 `$0` / `0` / `+0%`（`AdminApiController` L35-46） |
| **后端需实现** | 真实聚合。注意 `icon` 是**枚举字符串**，后端需下发合法值，前端 `StatCard` 直接消费 |

| 项 | 内容 |
|----|------|
| 页面 | `admin/AdminHome.vue` L44-48, L52-102（ECharts） |
| 接口 | `GET /admin/dashboard/revenue-chart` |
| 前端类型 | `RevenueData[]` = `{ date: string; value: number }`（`adminDashboard.ts:15-18`） |
| 后端现状 | 🔴 `Collections.emptyList()`（L63-66） |
| **注意** | 返回空数组时，图表区域目前**是一片空白 div**（`AdminHome.vue:146` `class="w-full h-80"`），前端空态缺失，见 §3-G1 |

### A2. 商家端仪表盘统计

| 项 | 内容 |
|----|------|
| 页面 | `web/src/pages/merchant/MerchantHome.vue` L24-40 |
| 接口 | `GET /merchant/dashboard/stats` |
| 前端类型 | `MerchantStat[]` = `{ label: string; value: string; change: string; icon: 'DollarSign'\|'ShoppingCart'\|'Package'\|'TrendingUp' }`（`merchantDashboard.ts:4-9`） |
| 后端现状 | 🔴 硬编码 `$0` / `0`（`MerchantApiController` L38-48） |
| **后端需实现** | 真实聚合 + 合法 `icon` 枚举值 |
| 附带 | `GET /merchant/dashboard/low-stock` 🟢 已真实，前端 `LowStock[]`（`merchantDashboard.ts:10-14`）已对齐 |

### A3. 商家钱包 / 提现 / 流水 ✅ 对应 D2 新表

| 项 | 内容 |
|----|------|
| 页面 | `web/src/pages/merchant/Wallet.vue` L731-746（`loadData`） |
| 接口 | `GET /merchant/wallet` → `MerchantWallet { balance: number; pending: number; currency: string }`（`merchantWallet.ts:4-8`） |
| 接口 | `GET /merchant/wallet/transactions` → `WalletTransaction[]`，元素 `{ id: string; type: 'sale'\|'withdrawal'\|'refund'\|'fee'; amount: number; status: 'completed'\|'pending'\|'failed'; date: string; description: string }`（`merchantWallet.ts:10-17`） |
| 接口 | `POST /merchant/wallet/withdraw`，请求体 `{ amount: number; destinationId?: string; destinationLabel?: string }`（`merchantWallet.ts:96-100`） |
| 后端现状 | 🔴 三者全部占位：余额恒 0 / 空列表 / no-op |
| **后端状态** | 🟡 **需新增（D2 实现中）** —— 已获批新表 `merchant_wallet`、`merchant_wallet_transaction` |
| **字段口径提醒** | `amount` 前端按**正负号**渲染增减（`Wallet.vue:113` `Math.abs` + 前置 +/−），后端返回时**需带符号**：收入为正、支出为负。`date` 为 `YYYY-MM-DD` 字符串（`Wallet.vue:89` 直接 `prop="date"` 排序）。`currency` 前端目前**硬编码 `USD` 前缀**（`Wallet.vue:33`、`:51` 写死 `$`），若后端要支持多币种需另行契约 |

### A4. 平台设置（管理端）

| 项 | 内容 |
|----|------|
| 页面 | `web/src/pages/admin/Settings.vue` L106-124 |
| 接口 | `GET /admin/settings` → `AdminSettings { siteName: string; maintenanceMode: boolean; allowRegistrations: boolean; commissionRate: number }`（`adminSettings.ts:4-9`） |
| 接口 | `PUT /admin/settings`，请求体 `Partial<AdminSettings>`，**返回 `AdminSettings`**（`adminSettings.ts:23-29`） |
| 后端现状 | 🔴 GET 硬编码 `siteName="Nexus Market"`；PUT **no-op（静默成功）** |
| **后端状态** | 🟡 **需新增（D2 实现中）** —— 已获批新表 `admin_setting` |
| ⚠️ **风险** | `Settings.vue:114-124` 的保存**不做任何差异比对**，PUT 返回值也被丢弃。前端点了 Save 就当成功。**在 PUT 真正落库前，这个页面会骗管理员。** |

### A5. 商家设置

| 项 | 内容 |
|----|------|
| 页面 | `web/src/pages/merchant/Settings.vue` |
| 接口 | `GET /merchant/settings` → `MerchantSettings { storeName; description; logo; location; responseTime; policies: { shipping; returns }; email; notifications: { email; push; sms } }`（`merchantSettings.ts:4-24`） |
| 接口 | `PUT /merchant/settings`，`Partial<MerchantSettings>` → `MerchantSettings`（`merchantSettings.ts:49-57`） |
| 后端现状 | 🟡 GET 部分硬编码；🔴 PUT no-op（**店铺名改不了**） |
| **后端状态** | 🟡 **需新增（D2 实现中）** —— 已获批新表 `merchant_setting` |
| 注意 | `logo` 字段前端已支持 `/file/upload` 真实上传（`Settings.vue:491-499`），只有 mock 分支用本地 data-URL 预览（L482-490），**非 mock 路径已通** |

---

## 4. 【B 类】前端自身真缺口（需前端修，本任务范围内）

### G1 🔴 高 — `admin/AdminHome.vue` 缺 Empty 态
- **行号**：统计网格 `L131-140`；近期用户列表 `L153-172`；收益图 `L144-147`
- **症状**：三块数据任一为空时，页面只是"什么都没有"，用户无法区分「真的没有数据」还是「没加载出来」。
- **修法**：三块各加 `EmptyState`（`variant="compact"` 给用户列表，`variant="default"` 给图表）。

### G2 🔴 高 — `merchant/MerchantHome.vue` 缺 Empty 态
- **行号**：统计网格 `L62-79`；低库存列表 `L88-105`
- **症状**：低库存为空时是一个空盒子（`L81-106` 只剩标题和边框）。
- **另注**：`L21` `iconComp?: any` 违反 `web/CLAUDE.md`「新增代码不用 any」，但属存量，本次不动。

### G3 🔴 高 — `merchant/Wallet.vue` 三态全缺（最严重）
- **行号**：`loadData` `L731-746`，catch 在 `L738-742`
- **现状代码**（`L739-741` 有原注释）：
  ```
  // 本页没有 error ref / isLoading，只有刷新按钮的 walletRefreshing，
  // 所以这一处**刻意不迁 useAsyncTask**（…REFACTOR_PLAN 阶段 4a 的「有意排除」一节）。
  ```
- **症状**：钱包接口失败时 —— 余额区（`L33`）显示 `$0.00`（初始值 `L624`），流水表格（`L83-135`）显示空表，
  仅弹一个转瞬即逝的 toast。用户 3 秒后看到的是"我余额是 0"，而不是"加载失败"。**这是全项目最危险的一处静默失败。**
- **修法**：改用 `useAsyncTask`（与 `merchant/Orders.vue` L253-265 完全同构），补 `Skeleton` + `ErrorState`（带 Retry）+ `EmptyState`（紧凑变体，插在 `el-table` 外 `L82` 的滚动容器内）。
- **⚠️ 注意**：该页 `L742` 的 toast 文案 `'Failed to load wallet data'` 也是不含原因的固定文案，与 `web/CLAUDE.md §6` 记录的存量问题同类 —— 但**这里它本身就是缺陷主体**（因为没有 ErrorState 兜底），随本次改造一并消除。

### G4 🟡 中 — `merchant/Settings.vue` 三态全缺
- **行号**：整个文件 `grep ErrorState|EmptyState|Skeleton|v-loading|useAsyncTask` **零命中**
- **症状**：取数失败时表单渲染成全空的可编辑表单（`form` 初始值见 L440 附近），
  管理员保存即把空值写回服务端 —— **与 `admin/Settings.vue:106-112` 注释里描述的危险完全同类，但那一页修了、这一页没修。**
- **修法**：照抄 `admin/Settings.vue` 的 `useAsyncTask({ fallbackMessage })` + `v-else` 互斥错误态。

### G5 🟡 中 — `admin/Settings.vue` 缺首屏 Loading
- **行号**：`useAsyncTask` 声明 `L102-104`（**未传 `initialLoading`**）
- **症状**：首帧立即渲染全空表单，取数完成后才跳变。
- **修法**：加 `initialLoading: true` + `Skeleton`。

### G6 🟡 中 — 商家钱包的「收款方式」纯本地
- **行号**：`refreshWithdrawMethods` `L655-666`、`removePayoutMethod` `L668-677`、`addUserPayoutMethod` `L712-728`
- **现状**：localStorage 键 `merchant_withdraw_methods_mru_*`（`docs/MODULES.md §2` 表格已登记为「❌ 仅本地，无后端可同步」）
- **症状**：换设备/换浏览器，商家保存的收款方式全丢。
- **后端状态**：⚪ **未建**（无表、无端点）。**本次不做**，仅登记为缺口。

---

## 5. ⚠️ 确凿的"前端写死假数据"（补充 §2 之外的页面级占位）

| 位置 | 内容 | 定性 |
|------|------|------|
| `web/src/pages/admin/Products.vue` **L134** | 商品描述渲染为占位文案：`"This is a placeholder description for the admin view. In a real app, we would fetch the…"` | **真·硬编码假数据**。`docs/MODULES.md §2` 亦已登记。 |
| `web/src/components/ui/ProductQA.vue` L28-75 | 商品问答硬编码 mock，提问/点赞仅前端状态 | 买家侧（非 admin/merchant），本次范围外，已登记 |

**`admin/Products.vue` L134 的修法**：现有 `GET /admin/products` 若已返回 `description` 字段，前端直接改为读该字段即可；
**若不返回**，则需后端在商品列表响应里补 `description`（或提供详情端点）。→ **需总控裁决后端是否补字段**。

---

## 6. 后端契约问题上报（前端不在此处硬凑）

| # | 问题 | 影响页面 | 建议 |
|---|------|---------|------|
| C1 | `PUT /admin/settings`、`PUT /merchant/settings` 为 **no-op 但返回成功**，前端无从察觉 | `admin/Settings.vue`、`merchant/Settings.vue` | D2 落库前，页面会误导管理员以为改成功了。**要么 D2 尽快落地，要么后端暂时返回 501/明确错误**，不要静默成功 |
| C2 | `POST /merchant/wallet/withdraw` 同样 **no-op** | `merchant/Wallet.vue` `handleWithdraw` | 同上 |
| C3 | `admin/Products.vue` L134 的描述占位，依赖后端是否返回 `description` | `admin/Products.vue` | 请后端确认 `GET /admin/products` 响应是否含 `description`；含则前端直接接，不含则请补 |
| C4 | `merchant/wallet` 收款方式无任何持久化 | `merchant/Wallet.vue` | 需新增表 + 端点。**优先级最低**（仅本地即可用） |
| C5 | `AdminApiController.updateReviewStatus` / `MerchantApiController.updateSettings` 文档标为 no-op | `admin/Reviews.vue`、`merchant/Settings.vue` | 同 C1 |

---

## 7. 明确**不需要**后端改动的部分（前端自查结论）

为免后端重复劳动，以下已核实**完全可用**，无需改动：

- `admin/Merchants.vue` / `Orders.vue` / `Users.vue` / `Reviews.vue` / `Products.vue` / `Notifications.vue` → 对应 `admin*` 端点均 🟢
- `merchant/Orders.vue` / `Products.vue` / `Messages.vue` → 🟢，且四态已齐备
- `merchant/Wallet.vue` 的**提现方式增删、本地 MRU 排序、logo 上传** —— 前端逻辑完整，`/file/upload` 已通
- `admin/**` 响应式 —— `.admin-table-shell`（`tailwind.css:106-108`）已提供横向滚动容器

---

## 9. 🔴 E1 已实施改动对既有测试的影响（**请转 QA**）

本节由 E1 实施后新增。前端按总控裁定改了契约消费方，有两处**既有测试会失败**，它们不在前端写入范围内。

### T1 `web/tests/product-reviews.spec.ts` —— **会失败，需 QA 重写**

该文件**整份围绕 8 条编造种子评价构造**，删种子后必然失败：

| 行号 | 断言内容 | 现状 |
|------|---------|------|
| L56-57 | 期望作者名 `Alex Chen` / `Sarah Miller` | 种子已下线，不再渲染 |
| L74 | `/8 reviews/` | 实际变成 `0 reviews` |
| L107-109 | 「种子里的 5 星是 Alex Chen / Jordan Wang / Michael Brown」 | 同上 |
| L116-129 | 搜索 `Sarah` / `expectations` 的过滤断言 | 种子正文不存在 |
| L145-149 | 空态文案 `No reviews match your filters.` | **文案已改**：无任何评价时显示 `No reviews yet. Be the first to share your experience.` |
| L227-243 | `/9 reviews/`、`/8 reviews/`、`Sarah Miller` 计数 | 同上 |

**建议 QA 改法**：该 E2E 的原意是「评价区的筛选/搜索/分页/投票交互」。既然种子没了，
应改为**先通过 UI 写入若干条评价**（页面有 WRITE A REVIEW 入口），再用这些用户自建评价跑筛选断言 ——
这样既保住交互覆盖，又不再依赖编造数据。

### T2 `web/src/composables/useOrderSummary.spec.ts` —— ✅ 前端已自行更新

运费/税移出应付金额后，该 spec 有 7 处断言失效（`total` 由 `115` 变 `100` 等）。
它位于前端写入范围（`web/src`），已由前端更新为新契约口径，并**新增一条回归测试**：
后端不返回运费/税时 `total` 必须是有限数、**绝不出现 NaN**。
`BASE_SUMMARY` 刻意保留 `shipping: 10, tax: 5`，正好钉住「即使后端还返回，前端也不计入」。

### T3 `web/tests/e2e-functional.spec.ts` L791/L815 —— **需 QA 复核**
两条测试断言「满减自动生效 / 优惠码叠加满减」。前端保留了 `summary.discount`（服务端满减）
与 `promoDiscount`（优惠码）两行，**只移除了运费/税/免邮文案**，故这两条**预期仍通过**，
但既然结算页行序变了，建议 QA 跑一遍确认。

---

## 10. 给总控的待裁决项

1. **F1 评价**：同意「删种子、改空态」。需后端新增 `POST/GET /products/:id/reviews`。**请确认是否采纳。**
2. **F4 购物车合并**：策略选「数量相加」还是「服务端优先」？现有 `/shoppingCart` 四端点已够，**无需后端新增**。
3. **C3**：`GET /admin/products` 是否返回 `description`？决定 `admin/Products.vue:134` 能否直接改掉占位文案。
4. **A3 金额符号口径**：`WalletTransaction.amount` 是否带符号（前端 `Wallet.vue:113` 依赖正负号渲染）？
5. **A3 币种**：`MerchantWallet.currency` 前端未消费（硬编码 `$`）。建议本期**固定 USD**，多币种另立契约。
6. **文档补记**：`docs/MODULES.md §2` 的 localStorage 表格漏了 `followedStores` / `loyalty` / `cart` 合并逻辑，建议补。