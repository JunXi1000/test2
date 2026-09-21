# 前端重构计划

> 立项：2026-09-20 · 对象：`web/`（`xmszjx-front`）
> 编码规范：[`aiagant.md`](./aiagant.md) · 工作约定：[`CLAUDE.md`](./CLAUDE.md)

## 约束（已确认）

| 项       | 结论                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| 行为边界 | **结构重构 + 允许改 UI/交互，但功能不可丢**；接口契约改动需先确认后端配合                                       |
| 依赖尺度 | 可装**开发/测试工具**；**运行时库不引入**（TanStack Query / Zod / VeeValidate / Sentry）；pnpm / Turborepo 不动 |
| 阶段顺序 | 阶段 0 → 9（下方）；阶段 6 在阶段 7 之前是有意的；**阶段 2b（主题机制收口）由阶段 2 拆出，单独立项**            |
| 死代码   | 直接删（git 历史可找回），不建 `_unused/`                                                                       |
| ESLint   | 存量豁免 + 增量严格                                                                                             |

## 已验证的基线（2026-09-20 实测，不是估计）

| 指标                                 | 实测值                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| 源码规模                             | 25,379 行（60 `.vue` / 69 `.ts`）                                                    |
| **`npx vue-tsc --noEmit`**           | **0 错误**（真的检查了 60/60 个 `.vue`）                                             |
| `any` / `console.log` / `@ts-ignore` | 65 处（`http.ts` 占 12） / 0 / 1                                                     |
| 最大页面                             | `ProductDetail.vue` **2083**、`Checkout.vue` **1314**（前 5 占全部 `.vue` 的 33.5%） |
| 零引用 composable                    | **5 个 / 1340 行**                                                                   |
| `src/styles/` 4 个文件               | **零引用 / 489 行**（`main.ts` 只引入 `assets/css/tailwind.css`）                    |
| 死依赖                               | `dayjs` 0 引用、`@vueuse/motion` 0 引用                                              |
| Element Plus chunk                   | 788,449 字节；含 **184 个** `El*` 名，模板只用 **32 种** `el-*`                      |
| 首屏 modulepreload                   | 含 `route-rare-admin` + `route-rare-auth`（rare-route 隔离被自己废掉）               |
| `test-features.sh`                   | curl 只能取到 `<div id="app"></div>` 空壳 → **假测试**（阶段 0 已删）                |

> E2E 条数随阶段推进增长：阶段 0 建立时 93 条，阶段 3 补 `tests/messages.spec.ts` 9 条 → **102 条**。
> 新增测试**不要**往 `features.spec.ts` 这个"什么都测一点"的大文件里堆，按特性另开文件（同 `messages.spec.ts`）。

**关键结论：类型纪律不是问题，重构靶心是巨型组件、重复样板、构建配置、测试可信度。别把预算花在补类型上。**

---

## 阶段表

### 阶段 0 — 立闸门 ✅ 已完成（2026-09-20）

| 项   | 内容                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 动作 | `typecheck` script · ESLint + Prettier（存量豁免）· Vitest · Playwright 扩主干 · 处置 `test-features.sh`                           |
| 涉及 | `package.json`、`eslint.config.js`、`.prettierrc.json`、`vitest.config.ts`、`tsconfig.test.json`、`playwright.config.ts`、`tests/` |
| 验收 | 见下方「闸门」；**四条全绿**                                                                                                       |

**闸门（实测，2026-09-20）：**

| 命令                  | 结果                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| `npm run typecheck`   | EXIT 0（`src/` + `tests/` 两个 project）                                             |
| `npm run lint`        | **0 error / 206 warning**（存量豁免棘轮，见下）                                      |
| `npm run test:unit`   | **67 passed**（3 文件：`checkout.spec` 21 · `search.spec` 33 · `userScope.spec` 13） |
| `npx playwright test` | **93 passed**（2.0 分钟，**无需后端** —— 全程 mock）                                 |

Vitest 首选三处「错了要赔钱或漏数据」的纯逻辑，已按计划落地：

- `api/modules/search.ts` — 排序 / 筛选 / 建议词缓存
- `api/modules/checkout.ts` — 阶梯折扣计算
- `stores/userScope.ts` — 跨用户作用域隔离（错了 = 看到别人的购物车）

`test-features.sh` **已删除**。它 curl SPA 拿到的是空壳 HTML，通行与否只取决于关键词是否碰巧出现在 shell 里（`app` 就在 `<div id="app">`，`NEXUS` 就在 `<title>`）。实测 **8 passed / 26 failed**，其中 26 个失败全是假警（那些页面确实工作，被 93 条 Playwright 用例证实），8 个通过里多数是 `-f` 文件存在性检查。它唯一的真实价值（PWA 静态资源可达）已被 `features.spec.ts` 的 Phase 11 覆盖，且**更强**（解析 JSON 断言字段，而非 grep 关键字）。

#### 阶段 0 的三个发现

**① 购物车登录态下不落盘（真 bug，已修）**

- **问题**：非 mock 下正常；**mock + 登录态**时购物车刷新即丢。
- **原因**：`stores/cart.ts` 的 `watch(items)` 是全文件唯一用 `getStorageScope() === 'guest'` 判定的地方，其余服务端路径一律用 `serverEnabled && isLoggedIn()`（L119/127/144/179/210）。mock 下 `serverEnabled=false`、登录态下 `scope!=='guest'` → 两个条件同时为假 → 本地不写。
- **影响**：mock 模式下登录用户加购后一刷新就空。E2E 用 `page.reload()` 的用例集体挂掉 —— 这正是 **94 条 E2E 中 44 条失败**的主因。
- **建议/修复**：把守卫改成与 `syncFromServer`/`syncAfterMutation` 一致的 `!(serverEnabled && isLoggedIn())`。非 mock 下 `serverEnabled` 恒真，**行为与改动前逐字等价**。
- **旁证**：先前把老 E2E 套件判为"一堆假测试"是**错的** —— 它是**基本正确但跑不起来**（mock 没开 + 后端没起 + 这个 bug），已更正。

**② E2E 的 mock 开关必须走 `storageState`**
`.env.development` 没有 `VITE_USE_MOCK` → `USE_MOCK=false` → 全部请求打向已停的 `127.0.0.1:1000`。`playwright.config.ts` 加 `storageState` 注入 `RUNTIME_USE_MOCK=true` 后，失败数 **44 → 10**，修掉 ① 后 **→ 0**。`storageState`（或 `addInitScript`）是 Playwright **唯一**能在应用脚本执行前写 localStorage 的官方入口，用例内的 `localStorage.setItem` 对**首次**请求已经太晚。

**③ 基线生成脚本是个自毁棘轮（我的工具，已修）**

- **问题**：`npm run lint:baseline` 会把基线写成**空表**。
- **原因**：生成器测的是「当前 error」，而基线本身把这些规则 `off` 掉了 → 测到 0 error → 写回 `{}`。
- **影响**：**实测空基线下 `npx eslint .` 报 88 个 error** —— 闸门在下次 lint 时静默变红，而执行者（照文档"重跑生成器"）很难把因果连起来。
- **修复**：`eslint.config.js` 增加 `ESLINT_IGNORE_BASELINE=1` 分支，生成器在 `new ESLint()` 前自行设置；并加不变式护栏 —— 「测到 error」与「基线非空」背离时**拒绝写盘**并 `exit 1`。
- 顺带：修正后的基线**合法收缩**一条（`tests/e2e-functional.spec.ts` 不再需要 `no-unused-vars` 豁免，因阶段 0 清掉了那些死变量）。

#### 其他阶段 0 处置

- **`tsconfig.test.json` 新建**：`tsconfig.json` 只 include `src/**`，`tests/` 属"无主文件"、**完全不受类型检查**。补上后立刻挖出 4 个错误，其中 3 个正是「断言被掏空后留下的死变量」—— 即假测试的尸体。`npm run typecheck` 现在连跑两个 project。
- **假测试下线**：删 `features.spec.ts` 的 `expect(true).toBe(true)`；把 `expect(count).toBeGreaterThanOrEqual(0)`（恒真）、`expect(visible || true).toBeTruthy()`（恒真）、`if (await x.isVisible()) {...}`（按钮不存在也判过）等改为真断言。被守卫掩盖的"价格筛选不生效"由此暴露 —— 查证后是**选择器过时**（区间按命中结果动态算 count，`search.ts:155` 只返回 `count>0` 的区间，硬编码 `$50 - $200` 对 `q=phone` 本就不存在），改用 `data-testid="price-range-facet"` 结构定位。
- **`DEBUG_CHECKOUT_PREFILL`**：`Checkout.vue:414` 有个读 localStorage 预填收货信息的调试钩子，**留在了生产代码里**，且 10 条 E2E 依赖它。阶段 7 拆 `Checkout.vue` 时应连同 E2E 一并清掉。
- **钩子没用 husky**：仓库根是 Maven 工程、前端在子目录，husky v9 要求位于 git 根。改为 `.husky/pre-commit` 普通脚本 + `git config core.hooksPath web/.husky`（**本地 config，不进版本库**，换机器需手动设一次）。只对动过 `web/` 的提交生效。

### 阶段 1 — 清死代码 + 性能快赢 ✅ 已完成（2026-09-20）

| 动作                                                                    | 结果                            |
| ----------------------------------------------------------------------- | ------------------------------- |
| 删 5 个零引用 composable + 孤儿 `utils/chatUpload.ts`                   | ✅ −1340 行                     |
| 删 `src/styles/{theme,ui-optimization,admin,front}.css`                 | ✅ −489 行                      |
| 删死依赖 `dayjs`、`@vueuse/motion` + `vite.config.ts` 的 `dayjs` 死规则 | ✅ 移除 31 个包                 |
| 修 `manualChunks` rare-route 泄漏                                       | ✅ 2 个 chunk 退出首屏          |
| 拆 `vendor-misc`（框架 / i18n 独立成块）                                | ✅ 470.72 → **138.31 KB**       |
| 删 `stores/coupons.ts` 零调用的 `markUsed`                              | ✅                              |
| ~~改 12 处 EP barrel 导入~~                                             | ❌ **前提有误，收益 0（见下）** |
| ~~修 `useToast` 缺 `'warning'` variant~~                                | ❌ **非缺陷，不做（见下）**     |
| ~~删假用例 / `test-features.sh`~~                                       | 阶段 0 已做                     |

**闸门：typecheck EXIT 0 · lint 0 error/206 warning · unit 67 passed · E2E 93 passed**

#### 两项「计划误报」（实测推翻，未做）

**① EP barrel 导入：收益为 0，不是"−150~250 KB gzip"**
计划的前提是「chunk 里含 184 个 `El*` 名 = 整个库被打包」。**这是误读**：那 179 个 `El*` 是 `element-plus/es/index.mjs` 里 `makeInstaller([...])` 组件清单的**名字符串**，不是实现。决定性证据三条：

- 深导入改造前后 chunk **hash 完全一致**（`ui-element-plus-Bjplz6fw.js`，788.44 kB 逐字节相同）→ 模块集合没变。
- 未使用组件的实现**早已被摇掉**：CSS 类串 `el-calendar`/`el-cascader`/`el-color-picker`/`el-anchor`/`el-backtop` 在产物中出现 **0 次**，而这些组件在模板里也确实是 0 处使用。
- 即 `element-plus/es` barrel 本来就被 Rollup 正确 tree-shake 了。
  → 曾改过 11 个文件（12 处 → 深路径），**已全部还原**，避免为零收益留下 11 文件噪声。

**② `useToast` 缺 `'warning'` variant：不是缺陷**
`useToast` 的联合类型是 `'default' | 'destructive' | 'success'`，`Toaster.vue` 的 `getVariantClasses`/`getIcon` 实现**恰好覆盖这三者**，两边一致、无缺口。全项目调用方 variant 分布：`destructive` 62 · `success` 41 · `default` 6，**无人传 `'warning'`**。加一个没人用的 variant 属于凭空造能力，不做。
（`ElMessage.warning` 确实有 5 处调用，但那是**另一条轨道**——`useToast`(27 文件) 与 `ElMessage`(11 文件) 双轨并存，属阶段 4 的「统一提示渠道」，不是这里缺 variant。）

#### 阶段 1 的真实收益（实测，非估计）

首屏 `modulepreload` 的**组成部分**变了，但**逐项列出的这些块仍全部预加载**——因为 `ui-element-plus`/`vendor-*` 都是入口的静态可达依赖：

| chunk             | 改造前                                  | 改造后                            |
| ----------------- | --------------------------------------- | --------------------------------- |
| `vendor-misc`     | 470.72 KB（混装 vue/router/pinia/i18n） | **138.31 KB**                     |
| `vendor-vue`      | （含在上面）                            | **114.71 KB** · gzip 44.72        |
| `vendor-i18n`     | （含在上面）                            | **63.14 KB** · gzip 20.15         |
| `vendor-echarts`  | 295.12 KB（`zrender` 漏在 misc 里）     | **462.88 KB**（`zrender` 归位）   |
| `ui-element-plus` | 788.45 KB                               | 788.44 KB（**无变化**，符合预期） |

**要点**：拆 `vendor-misc` 的价值不是"减少首屏体积"（总量不变），而是**把发版才变的框架依赖与业务代码分离**，使 `vendor-vue`/`vendor-i18n` 能长期命中浏览器缓存。真正的首屏减重得靠**让 EP 退出首屏**（EP 现在 250 KB gzip 是首屏静态可达依赖）——那是路由级拆分，不在阶段 1 范围。

**首屏 `modulepreload` 实测：9 个 JS + 2 个 CSS = 1530.0 KB（未 gzip）**。这个数**改造前后基本不变**（只是分块归属变了），不要拿它当作阶段 1 的功劳。

#### 阶段 1 附带发现

- **券在结算后从不标记已用（潜伏功能缺口）**：`isUsed = true` 全项目**唯一写点**就在被删的 `markUsed` 里。删掉死代码后，"券永不被消耗"这一事实更清楚了 —— 但**这是产品语义问题，未擅自接线**（接线会改变行为：`available`/`used` 两个列表的归属会变）。需先定语义。
- **老 E2E 的 3DS 用例是 flaky**：`e2e-functional.spec.ts:1013`（Phase 2.1）在并行负载下偶发失败，单独跑必过。机制是 `gotoReviewWithCard` 用固定 `waitForTimeout(800)` 而非等待真实状态（新写的 `main-flow.spec.ts` 用 `expect(...).toBeVisible()` 等待，从未 flake）。建议把该助手改成等待下一状态。
- **`useChatUploads.ts` 与 `utils/chatUpload.ts` 是死的一对**：前者是后者唯一引用者，必须同时删。

### 阶段 2 — 三态规范化（**已完成 2026-09-20；原先"仅亮色域"的缺口已由阶段 2b 补齐**）

**闸门：typecheck EXIT 0 · lint 0 error/210 warning · unit 67 passed · E2E 93 passed**

#### 先修正计划里的三个错数

计划原文写「`EmptyState` 不存在、给约 35 个页面补 Error、`admin/**`+`merchant/**` 全军覆没」。实测后三处都不准：

| 计划原文                   | 实测                                                      | 说明                                                                  |
| -------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| 60 个页面                  | **40 个**（`src/pages` 下 `.vue`，另加 `src/components`） | 60 是 `.vue` 总数，不是页面数                                         |
| 约 35 个页面缺 Error/Retry | **亮色域真实缺口 3 个**                                   | 18 个里 12 个属暗色域、4 个是 auth 表单（另有正确形态）、1 个不是缺口 |
| Empty 态"根本不存在"       | **已存在，17 处 ad-hoc、约 5 种写法**                     | 目标是**收敛**，不是从零引入                                          |

#### 关键决策：只做亮色域，暗色域单列（用户确认）

范围收敛为 **storefront + `dashboard/**`**，暗色域的暗色态另立阶段。**决策不变，但当时给的理由是错的**（见下）。

#### ⚠️ 本节原判断已被阶段 2b 核实推翻（2026-09-21）

原写"**全项目从未给 `<html>` 挂 `.dark`**，故 `.dark` 令牌块与 360 处 `dark:` 变体全是死代码；admin+merchant 的暗色靠硬编码 zinc 撑着"。**核实后：错了两处。**

判错的根因是取证方法：当时用 `grep 'classList.add("dark")'` 找挂载点，**匹配不到库内部实现**。实际上
[`DefaultLayout.vue:20`](src/layouts/DefaultLayout.vue#L20) 就是 `const isDark = useDark()` / `useToggle(isDark)`（@vueuse/core），**它会给 `<html>` 挂 `.dark`**，页头也有主题切换按钮。实测：点击后 `html.class="dark"`、body 背景 `rgb(255,255,255) → rgb(9,9,11)`、`localStorage['vueuse-color-scheme']="dark"`。

修正后的真实版图（**三个域三种命运，关键看哪个布局实例化了 `useDark()`**）：

| 域                                       | 吃到 `.dark`？                                              | `dark:` 变体              | 实际观感                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| storefront + `dashboard/**`              | ✅（`dashboard` 是 `/` 的 children，嵌在 DefaultLayout 内） | dashboard 83 处，**生效** | 暗色模式**本来就是好的**                                                                                           |
| `merchant/**` + `components/merchant/**` | ❌ `MerchantLayout` 里 `useDark` 出现 **0** 次              | **213 处，全不生效**      | **恒为亮色** —— 它是**亮色优先**设计（根节点 `bg-zinc-50 … dark:bg-zinc-950`），**不是暗色域**                     |
| `admin/**`                               | ❌ 同上（`AdminLayout` 里 0 次）                            | **0 处**                  | 永久暗色：靠**无前缀的** `bg-zinc-950`(8)/`text-zinc-200`(16)/`border-zinc-800`(13) **无条件**撑着，与主题机制无关 |

判据是**前缀**，不是色值 —— 两个域用的是同一套 zinc 视觉语言，差别只在有没有 `dark:`：

- `admin/`：`bg-zinc-950`、`text-zinc-200`、`border-zinc-800`（无前缀 → 恒定暗）
- `merchant/`：`dark:bg-zinc-900`(17)、`dark:bg-zinc-800`(15)、`dark:border-zinc-800`(7)（有前缀 → 只有挂了 `.dark` 才暗，而它没挂）

**"merchant 是硬编码暗色"是我先前的误判**，原文里那句已作废。

#### 另一处独立 bug：EP 暗色变量从未引入（阶段 2b 已修）

`.dark` 生效时 Tailwind 令牌跟着变，但 **Element Plus 的 `--el-*` 不跟令牌联动**，需要单独引
`element-plus/theme-chalk/dark/css-vars.css`（文件一直在 node_modules 里躺着，从未被 import）。缺失后果实测：
暗色页面上 `--el-bg-color: #fff`、`--el-text-color-primary: #303133`、`--el-border-color: #dcdfe6`
→ 每个 `el-dialog`/`el-form`/`el-input`/`el-select`/`el-drawer`/`el-dropdown`/`el-pagination`/`el-timeline` **仍是白底**。
已补在 [`main.ts`](src/main.ts)。补后实测：暗色 `#141414`/`#e5eaf3`/`#4c4d4f`，亮色态**零变化**（该文件作用域就是 `html.dark`）。

`EmptyState` **刻意不写 `dark:` 变体**是对的（纯令牌使其在两种模式下都自动正确），但注释里"写了也不生效"的理由要改。

#### 交付物

**新建 `src/components/ui/state/EmptyState.vue`**，两种形态照抄既有页面的真实写法（不是设计出来的）：

- `default`（富态）：`py-16 border border-dashed border-border rounded-xl` + 图标 + 标题 + 说明 + 默认插槽放操作。
  度量取自 `Returns.vue` / `Coupons.vue`（既有最规范的两处）。
- `compact`（紧凑）：无边框单行 `py-12 text-sm text-muted-foreground`，用于侧栏 / 抽屉 / 局部筛选结果。
- API：`{ icon?: Component; title?: string; description?: string; variant?: 'default'|'compact'; class?: string }`，
  照 `Button.vue` 的 `cva()` + `cn()` 写法。没要的留白用 `class` 覆盖（tailwind-merge 保证后者赢）。

**迁移 15 处空态**（亮色域全量，无遗漏）：

| 形态     | 位置                                                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 富态 ×10 | `dashboard/Returns` · `dashboard/Coupons` · `dashboard/Wishlist` · `dashboard/FollowedStores` · `dashboard/Addresses` · `Cart` · `StorePage` · `Compare` · `Home` · `SearchResults` |
| 紧凑 ×4  | `dashboard/Orders` · `dashboard/Messages`(侧栏) · `dashboard/Messages`(抽屉) · `ProductDetail`(评价筛选)                                                                            |

**有意做的视觉变更**（允许改 UI）：

- 三处"圆形底衬图标"（`w-16 h-16 bg-secondary rounded-full`）和一处 `w-12 h-12 opacity-40` **统一成内联 `w-10 h-10`** —— 这是收敛的代价。
- `SearchResults` 的 🔍 emoji **换成 lucide `Search` 图标**（该页本就 import 了 `Search`）。
- 边框统一为虚线（原先 `Home`/`Cart`/`StorePage` 是实线 `bg-card` 卡片）。

**补 Error + Retry ×2**（实测出的真缺口，非机械铺开）：

- **`dashboard/Messages.vue`：静默失败**。原 `onMounted` 是 `catch { /* empty */ }` 然后照常 `isLoading = false`
  → **加载失败被渲染成空态「No conversations found」，等于谎报"你没有会话"**。改为 `errorRef` + `ErrorState` + `@retry`。
- **`Compare.vue`：失败伪装成空态**。原 `catch` 只弹个 toast，然后落到
  「Nothing to compare / Add products to compare them side by side」——用户明明加了商品，文案却让他去加商品，且无重试入口。改为 `ErrorState` + `@retry`。

#### 三项「计划误报」（实测推翻，未做）

**① `Cart.vue` 不需要 ErrorState —— 它不是数据页**
原判"缺 Error"。核实：`getProductById` 在 `Cart.vue` 里**只服务于"编辑条目"弹窗**（用户动作），其失败已用 toast + 关弹窗正确处理；购物车数据来自 store，没有会失败的页面级取数。**不补**。

**② admin 的 5 个列表页并非"没有空态" —— 有 EP 内建的**
它们都用 `el-table`，EP 自带英文 `No Data` 占位。我的正则看不见内建态，故"缺空态"对这几页不成立。
真正该做的是给 `el-table` 传 `empty-text`/`#empty`——属暗色域那个阶段。

**③ auth 4 页（Login/Signup/Forgot/Reset）不是缺口**
它们在表单内联展示字段级错误，是**另一种正确形态**，不该套 `ErrorState`。

#### 其它核实（顺手排掉的假警报）

- **阶段 1 删掉的 4 个样式表没留下孤儿类名**：从 HEAD 取出 4 个 CSS，抽出 50 个类名回查源码，唯一命中 `loading` 是**同名 prop**（`:loading=`），非类名。`admin-list-item-card` 等 admin 类定义在 `tailwind.css:119`，**未随 `admin.css` 一起被删**。
- **`lint` 206 → 210 warning 的来源已定位**：`eslint .` = 210，`eslint . --ignore-pattern EmptyState.vue` = **206**（与阶段 1 记录一致）。即增量全部来自新组件的 4 条 `require-default-prop`，与 `Button.vue` 既有的 3 条**同一类**；15 处调用点**零新增告警**。闸门只卡 error，且 `require-default-prop` 不在基线中，属存量风格。
- **`SearchResults` 预搜索落地页（`Find What You Need` + trending）刻意未迁移**：那是**发现态引导**（6xl emoji + 推荐词），不是"没结果"的空态，性质不同。

#### 遗留（未做，需产品决策）

- **`Compare.vue` 的空态现在近乎不可达**：`onMounted` 在 `items.length < 2` 时直接 `router.replace('/')` 并 `return`，
  成功取数必得 ≥2 个商品 → `products.length === 0` 只在"取数失败"时成立，而那条路已改由 `ErrorState` 承担。
  **未删**：它是防并发的兜底分支（另一标签页清空 compare 时仍可能命中），删 6 行 UI 换不来收益、却承担竞态风险。**留着，记在此处**。

### 阶段 2b — 主题机制收口 · ✅ **已完成（2026-09-21）**

> **本节已按核实结果重写。** 原先把 admin 与 merchant 捆成"暗色域"、并提出 A/B/C 三选一 —— 那个前提错了：
> **merchant 根本不是暗色域**（它是亮色优先 + 213 处写好却没生效的 `dark:` 变体），两个域的问题也不同源，
> 套不进同一个方案。修正后拆成两件互不相干的事。

#### 2b-1 · merchant 的暗色模式是坏的 ✅ **已完成（2026-09-21）**

`MerchantLayout.vue` 从不实例化 `useDark()`，于是 **213 处已经写好的 `dark:` 变体全部不生效**，
merchant 无论用户选什么主题都恒为亮色。这是**接线漏了**，不是设计取舍 —— 写这些变体的人显然预期它们生效
（`MerchantLayout.vue:65` 根节点 `bg-zinc-50 … dark:bg-zinc-950`，两个分支都写了）。

**实际修法**：在 `MerchantLayout.vue` 加 `useDark()`（与 `DefaultLayout.vue:20` 同款），**未改任何页面文件**。
用户决策：**merchant 不放主题按钮**，跟随用户在 storefront 的选择 —— 故刻意不接返回值
（`useDark()` 内部的 watch 是 `immediate` 的，调用即生效；接了就成 `noUnusedLocals` 违规）。

**因果实测**（同一脚本，唯一变量是这个文件，回退到 HEAD 复测过一次）：

|              | `html.class` | 布局根节点底色                          | 用户已选暗色                                   |
| ------------ | ------------ | --------------------------------------- | ---------------------------------------------- |
| 改前（HEAD） | `(空)`       | `oklch(0.985 0 none)` = zinc-50         | `vueuse-color-scheme="dark"` —— **被完全忽略** |
| 改后         | `dark`       | `oklch(0.141 0.005 285.823)` = zinc-950 | 生效                                           |

另一条独立旁证：该文件**自己的 scoped CSS 里就有 `.dark .merchant-top-nav { scrollbar-color: rgb(63 63 70) }`**
—— 连滚动条配色都按 `.dark` 写好了，这条规则同样一直是死的。写这个文件的人明确预期 `.dark` 存在。

`--el-bg-color` 在 merchant 暗色下同步为 `#141414`（受 2b-2 那行 EP 变量修复所赐）。
闸门复跑：typecheck 0 / lint 0 error·210 warning / unit 67 / E2E 93 全通过。

#### 2b-2 · admin 是永久暗色域，缺的是"把 `.dark` 挂上"，不是暗色态组件 ✅ **已完成（2026-09-21）**

admin **零个 `dark:` 变体**，暗色靠无前缀的 `bg-zinc-950`/`text-zinc-200` 无条件撑着。
它的问题不是"暗色分支没生效"，而是**它暗着、却没挂 `.dark`** → 令牌解析成亮色值 → 任何令牌组件放进去都画白边。
`admin/**`+`merchant/**` 全域**只用了 8 处令牌类**（`text-muted-foreground` ×4、`border-border` ×3、`bg-primary` ×1），
所以给 admin 挂 `.dark` **几乎不改变现有观感**（只翻转这 8 处，方向恰好是从错到对）。

**修法**：`AdminLayout.vue` 在 `onMounted` 给 `document.documentElement` 加 `.dark`、`onBeforeUnmount` 摘掉。
之后 `EmptyState`/`ErrorState` 在 admin 里**开箱即用，无需新 prop、也无需第二套组件** ——
**原 A/B/C 三选一由此作废：A（加 `tone` prop）与 B（两套空态）都不必做。**

**为什么必须挂在 `<html>` 而不是布局根节点**：`el-select` 下拉、`el-dialog`、`el-popover` 都 teleport 到 `<body>`，
只有变量定义在 `<html>`（EP 暗色变量文件的作用域正是 `html.dark`）它们才吃得到。
**为什么不复用 `useDark()`**：那个跟随用户偏好，而 admin 没有亮色形态，必须恒定暗色。

**因果实测**（挂载前 → 挂载后）：

| 探针                                                 | 挂载前          | 挂载后                                    |
| ---------------------------------------------------- | --------------- | ----------------------------------------- |
| `body` 底色                                          | `#fff`          | `rgb(9, 9, 11)`                           |
| `--el-bg-color`                                      | `#fff`          | `#141414`                                 |
| 工具栏上的 `el-input` / `el-select`                  | 纯白            | 暗色                                      |
| teleport 出去的下拉（`parentIsBody: true`）          | 亮色            | 暗色（选中项 `rgb(64,158,255)`）          |
| `.admin-data-table` 的手写覆盖 `--el-table-bg-color` | `rgb(26,26,28)` | `rgb(26,26,28)`（**未被覆盖，符合预期**） |
| dashboard（走 DefaultLayout，不受影响）              | —               | 无回归                                    |

具体工作项**均已完成**，另有两处原计划没写到的问题：

1. **`el-table` 的空态** —— 是 **4** 页不是 5 页（Users / Merchants / Orders / Reviews；**Products 是网格、根本没有 `<el-table>`**，
   原判断记错了）。4 页都改用 `#empty` 插槽挂 `EmptyState`，并用 `class="border-0 py-10"` 去掉自带虚线边框
   （表格外壳本身已有边框，套两层会变成盒中盒）。**未改写成自建表格**，遵守 CLAUDE.md 禁止条款。
2. **补 Error + Retry** —— 6 页（上述 4 页 + Products + Settings）。
   `Settings` 的静默失败最危险：取数失败时 form 保持全空，页面照样渲染成一张**可编辑的表单**，
   管理员顺手点 Save 就会把空值写回服务端覆盖真实配置 → 改为失败时不出表单。
   **操作类 catch（改状态/重置密码/编辑/删除）刻意保留 toast** —— 一次操作失败不该把整张表换成错误页。
3. **`admin/Notifications.vue`** —— 除了空态迁移，还挖出**它压根没有 catch**：
   原代码是裸的 `onMounted(async () => { notifications.value = await getNotifications() })`，
   取数失败既是**未处理的 Promise rejection**，又让页面照常渲染成空态「No notifications」——
   又一个"失败被谎报成空"。
4. **【新发现】`admin/Products.vue` 没有任何空态** —— 它是网格不是表格，没有 `#empty` 可挂，
   `v-for` 空数组时就是一片空壳。已补 `EmptyState`，且**必须带 `!loading` 守卫**：
   网格不同于 EP 表格，加载中它什么都不渲染，只看 `length === 0` 会在 0.72 不透明度的遮罩下先闪一屏「没有商品」。

**验证方式**：把 `localStorage['mock_admin_users']` 写成非法 JSON（mock 的 `getMockData()` 是裸 `JSON.parse`），
制造一次**真实取数失败** → ErrorState 出现、表格消失、Retry 可点；清掉该 key 后点 Retry → **4 行数据回来**，
证明重试真的能恢复。空态则用无意义搜索词逐页触发，5 页全部 `stillSaysNoData: false`（EP 的 `No Data` 已被替换）。
Notifications 的失败路径用**关掉 mock + 后端 :1000 离线**跑通（Vite 代理返 500 → 真实网络失败），
页面停在原路由、未触发 401 跳转。

闸门复跑：typecheck 0 / lint 0 error·210 warning（与基线逐项一致）/ unit 67 / E2E 93 全通过。

#### 明确**不**并入 2b 的一项

**`merchant/Messages.vue:189` 的 `catch { /* empty */ }` 静默失败**（与 `dashboard/Messages.vue` 阶段 2 修的那份同款）
**并入阶段 3** 一起修 —— 阶段 3 本就要把消息页三份拷贝合一，现在修等于改两遍。
→ **已于阶段 3 完成**。并且发现**阶段 2 在 dashboard 修的那份其实是死的**：`errorRef` 永远设不上，
详见阶段 3 的「顺手修掉的问题 1」。

#### 顺序与状态

**2b-1、2b-2 均已完成**。两项都**没有碰 `EmptyState` 的 API**，故阶段 2 的产出无需返工
（`EmptyState`/`ErrorState` 是靠给 admin 挂 `.dark` 才变得可用的，组件本身一行未改）。

### 阶段 3 — 消息页三份拷贝合一 · ✅ **已完成（2026-09-21）**

#### 原计划的判断有两处**说错了**（先纠错，再记结果）

1. **「约 250 行逐字重复」不准确**。实测：script 有 97 行不同、template 有 214 行不同（23 个 hunk），
   其中 132 行是 dashboard 独有的商家资料抽屉。所以**逐字重复的面积比 250 小**；
   但**两个 script 的函数清单是 1:1 完全相同的 12 个函数**，重复的是**逻辑**而非字面。
2. **「风险低（两者行为已完全一致）；需 E2E 护住」自相矛盾，且两点都错**：
   - 行为**不一致**：dashboard 有 ErrorState / EmptyState / `aria-current` / 商家资料抽屉；
     merchant 是裸 `catch { /* empty */ }` / 硬编码空态 div / 无 aria。
   - E2E **当时根本不存在**（只有一条 auth 守卫 + 一条「ChatWidget 存在」）。"需 E2E 护住"是空的。

#### 实际做法：先补护栏，再重构

**第一步（做在重构之前）**：新建 `tests/messages.spec.ts`，9 条**特性化测试**把重构前**实际跑通**的行为逐条钉死：

- 极性是重点。mock 里那条种子消息 `senderType` 恒为 `'SHOP'`，所以**同一份数据必须落到相反的一侧**
  —— 买家 `['left']`、卖家 `['right']`。这个差异**看模板看不出来**（class 还是那些 class），
  所以断言是**量气泡中心落在会话区哪半边**，不绑 class 字符串。
  裸改 class 的重构会误报，而真正的极性错误会漏报 —— 量几何是唯一可靠表达。
- 顺带确认了一处路由事实：merchant 的父路由是 `/merchant/dashboard`，
  所以卖家消息页是 **`/merchant/dashboard/messages`**，不是 `/merchant/messages`（我第一版写错，404 暴露）。
- **刻意不断言「刷新后消息还在」**：mock 的累积数组活在模块作用域，整页 reload 会重新求值模块，
  那是 mock 的性质不是页面的行为。

**同时修掉一个阻塞前置**：mock 的 `sendMessage` 不落库（`getMessages` 无脑返回同一个常量），
表现为「发出去的消息闪一下就不见了」——不修的话「发送」这条用例根本没法测。
改 `api/modules/chat.ts`：`getMessages` 按 `conversationId` 过滤**累积数组**，`sendMessage` 推入并同步会话预览。
（id 不能用 `Date.now()`，连发会撞 `:key`。）

**第二步（重构本体）**：

| 产出                                              | 说明                                                |
| ------------------------------------------------- | --------------------------------------------------- |
| `composables/useChatConversations.ts`(288)        | 数据层。构造参数 `selfSender: 'user' \| 'merchant'` |
| `components/ui/chat/ChatWorkspace.vue`(343)       | **三栏骨架本体**（第三步）。数据 + 布局都内聚在这里 |
| `components/ui/chat/ChatMessageBubble.vue`(81)    | 单条气泡。**只读 `message.isSelf`，不认识角色**     |
| `components/ui/chat/ChatConversationItem.vue`(80) | 会话条目。头像走 `#avatar` 插槽                     |
| `components/ui/chat/ChatComposer.vue`(45)         | 输入条。两侧**零差异**，无任何角色参数              |
| `components/ui/chat/MerchantInfoPanel.vue`(220)   | 商家资料抽屉（买家页独有，整块搬出）                |

**极性的收敛方式**（这是本阶段的核心）：
`api/modules/chat.ts` 的 `mapConversation` **早就**按当前角色把 `shopName`/`userName` 归一化成了
`participantName`，而两个页面各自又把它**拆回去**（`merchantName` / `userName`）。
所以正确做法是**停止反解**，直接用 `participant*`。
剩下的真差异只有一个布尔：**这条消息是不是我发的** —— 在 `mapMessage` 里算**一次**：

```ts
isSelf: (m.senderType === 'SHOP' ? 'merchant' : 'user') === selfSender
```

模板从此只见 `msg.isSelf`，`user` / `merchant` 字符串在模板里绝迹。

**顺手修掉的三个问题**（都是计划里点名要并入本阶段的）：

1. **dashboard 的 ErrorState 是死的（真 bug）**：`loadAll` 在外面 `try/catch` 设 `errorRef`，
   而 `loadConversations` **内部** `catch { /* keep current state */ }` 把异常吞了 ——
   异常根本传不出来，`errorRef` 永远是 `''`，**阶段 2 加的 ErrorState 从来没渲染过一次**。
   修法：把加载拆成两种语义并**有意区分** —— `load()`（首次，失败**上抛**并写 `errorRef`）
   与轮询用的 `fetchConversations(false)`（失败**静默**，一次瞬时抖动不该把整页换成错误态）。
2. **merchant 的裸 `catch { /* empty */ }`** + 硬编码空态 div → 与 dashboard 对齐（ErrorState + `EmptyState`）。
3. **merchant 缺 `aria-current`** → 随 `ChatConversationItem` 统一补上。

#### 第三步：抽 `ChatWorkspace` 外壳（用户要求单独做，没有并进阶段 9）

我把这一步的收益判断反了，先说错在哪：原话是"再抽一层要把差异做成 props/slots，收益低于前两步"。
**真实情况是差异比我估的少得多** —— 我认为"页面特权"（头像可点、`User` 兜底）必须变成一堆可选参数，
但那些特权全都长在**头像**这一块 markup 上，做成一两个插槽就够了，剩下 90% 的骨架是逐字相同的。

做法：外壳**自己调 `useChatConversations` + `useMessagesLayout`**（`layoutKey` 由页面给，因为要分域持久化），
所以页面不再持有任何 chat / layout 状态。这样就不必向外传十几个 props：

| 面向       | 内容                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| props（7） | `selfSender` `layoutKey` `title` `searchPlaceholder` `selectPrompt` `peerLabel` `inspectorHint` —— 全是字符串/枚举 |
| slots（2） | `peer-avatar`（**聊天头部与气泡共用**，页面只写一遍）、`conversation-avatar`                                       |
| emits      | **0**。点会话 / 发消息 / 重试全是内部行为                                                                          |

两处仍然"必填插槽、无默认值"：头像内容没有合理默认，给个默认实现只会误导（还会退回"空 src 破图"）。
顺带把 `ChatConversationItem` 的 `avatarFallback` / `avatarAction` 两个参数和 `open-info` 事件**删掉换成插槽** ——
那两个参数把"买家传 action、卖家传 fallback"这类**与本组件无关的知识**散在了调用方，
而插槽能把 markup 和它的回调一起还给页面。副作用是 dashboard 的 `merchantInfoTargetId` + `activeMerchantInfo`
两个 ref / computed 也没了：插槽直接把手头那条会话交给页面，不用再按 id 回查。

**一个刻意的取舍**：页面持的是**点击那一刻的会话对象引用**，而轮询每轮都会重建 `ChatConversation`
（只复用 `messages` / `online`）。原实现是按 id 从最新数组里回查，所以理论上"更新"。实际无差 ——
抽屉只用 `participantId`（开抽屉那一刻读一次）与 `online`（恒为 false）；但**将来若往抽屉里加会话上的字段，
要记得它会停在打开那一刻**。选引用而不是回查，是因为回查需要把 `conversations` 再漏给页面，
为一件当下不存在的事把刚收掉的接口再开一个口子不划算。

**dashboard 页因此保留了一层 `<div class="flex min-h-0 min-w-0 flex-1 flex-col">` 包壳。**
不是我想要的多余嵌套：布局会往页面**根节点**传 `:class`，`Transition` 也只认单根，
而抽屉必须与工作区并列（工作区不认识它，也不该认识），所以页面得单根 —— 包壳是最省事的办法。

#### 行数的诚实账

|                            | 阶段 3 前 | 第二步后 | 第三步后                          |
| -------------------------- | --------- | -------- | --------------------------------- |
| 两个页面合计               | 1415      | 660      | **105**（62 + 43）                |
| `useChatConversations.ts`  | —         | 288      | 288                               |
| `components/ui/chat/` 零件 | —         | 439      | **770**（含 `ChatWorkspace` 343） |
| **合计**                   | 1415      | 1387     | **1163**                          |

第三步是三个阶段里唯一**总量真的下降**的一次（−224），因为被合掉的是纯 markup，
不像前两步要把逻辑搬进 composable 再配上注释。更要紧的是两页的 script 从"12 个函数的 1:1 拷贝"
变成 dashboard 11 行 / merchant 0 行 —— **下一步改动不会再需要"两边都改一遍"**。

`ChatWidget.vue`(341) 仍是第三份拷贝，**本阶段没动它**：它是浮窗（自己的 markup、自己的 token 体系），
外壳这套三栏结构套不上去。它能共用的是数据层与气泡/输入条两个零件 —— 见阶段 9。

#### 验证

- 方式：**先写 9 条特性化 E2E → 再重构**，每一步都跑这 9 条。数据层合一后 9/9 绿，抽出组件后 9/9 绿，
  抽出外壳后仍 **9/9 绿**。极性（买家 `['left']` / 卖家 `['right']`）是唯一可能被 markup 重构悄悄改掉的
  东西，它一路绿到底就是这一步的证据。
- 闸门：typecheck 0 / lint **0 error · 210 warning（与基线逐项一致）** / unit 67 / **E2E 102**（原 93 + 新 9）。
- 另外做了**人工视觉核对**（步骤改了 markup，几何断言覆盖不到头像渲染）：1440px 下买/卖两页、
  1700px 下买家三栏各截一张图确认 —— 外壳把聊天头部的头像框从 `overflow-hidden` 改成了
  `flex items-center justify-center overflow-hidden`（统一成卖家页那份），
  所以卖家页的 `User` 图标改用相对尺寸 `h-1/2 w-1/2`，在 40px 框里得 20px、32px 框里得 16px，与原值一致。

### 阶段 4 — 请求样板收敛 · ✅ **已完成（2026-09-21）**

拆成四件相对独立的事（4a 加载器 / 4b 错误文案 / 4c 提示渠道 / 4d 单测），用户确认了其中两处方案选择：
**加载器用「任务式 `useAsyncTask`」**、**提示渠道「统一到自建 `useToast`」**。

#### 4a · `useAsyncTask()` — 加载器统一形态

新建 [`src/composables/useAsyncTask.ts`](src/composables/useAsyncTask.ts)（89 行，含注释），
**22 个文件**接入。原来每个页面的 `isLoading` / `errorRef` / `try-catch-finally` 三件套逐字重复，
现在是一句 `const { isLoading, error, run } = useAsyncTask({ fallbackMessage: '…' })`。

**三个设计决定，都是被真实调用点逼出来的，不是设计出来的：**

1. **返回值是可辨识联合，不是 `boolean`。**
   `{ ok: true; value: T } | { ok: false; error: string; cause: unknown }`。
   原因：有调用点的任务体**自己就会 `return false`**（`Home.vue` 的 `fetchProducts` 在「没有更多数据」时于
   try 内部返回 false）。若 `run()` 也返回 boolean，「任务说没有更多了」与「任务抛异常了」就分不开，
   调用点只能再读一次 error ref 去猜。联合类型让两种情况在类型上就是两条分支。
2. **`silent` 只压 loading 标志，**不**影响 error**（该清照清、该写照写）。
   第一版写成「loading 和 error 都不动」，那是错的：`Home.vue` 的 Retry 走的正是 silent 分支
   （只在首屏空列表时才显示骨架屏），error 一起不清的话，点了 Retry 的 `ErrorState` 会原地不动，**看起来像按钮坏了**。
3. **`initialLoading` 选项存在，且默认是 `false`。** 本项目 **13 个页面**的加载标志原本都是 `ref(true)`，
   是**有意为之**：请求在 `onMounted` 里才发起，而首屏渲染早于 `onMounted`，初值给 `false` 的话
   首帧会先渲染出「空态 / 错误态」再被骨架屏顶掉。迁移时**照抄原初值**，不要顺手统一成 `false`（选项 JSDoc 里写明了）。

**`cause` 字段是后来补的（值得记一笔）**：迁移由两个子代理并行完成，其中一个报告了**唯一无法完全等价的地方** ——
`merchant/Products.vue` 原先 `console.error` 打的是**原始抛出的 Error 对象**（含堆栈），
而 `run()` 内部 catch 之后只剩折算好的字符串，控制台诊断载荷被降级了。
修法不是在各调用点各自处理，而是给失败分支加 `cause: unknown` 透传原始抛出物：
**给用户看的永远是 `error` 那句字符串，控制台还能展开真 Error**。该文件已改为 `console.error('…', result.cause)`，
`useAsyncTask.spec.ts` 补了一条断言 `result.cause` 是**同一个引用**（不是折算后的字符串）。

**有意排除（不是遗漏，是判断）：**

| 页面                                   | 为什么不迁                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cart` / `Wishlist` / `FollowedStores` | 骨架屏只是 `setTimeout` 演的，**没有 fetch、没有 error ref** —— 没有可收敛的东西                                                                                                                  |
| `Returns` / `Coupons`                  | 取数委托给 store，页面不自己发请求                                                                                                                                                                |
| `merchant/Wallet.vue`                  | 它既**没有 error ref 也没有 isLoading**，只有一个刷新按钮的 `walletRefreshing`。迁了要么多一个没人读的 loading（撞 `noUnusedLocals`），要么形状比原来更绕。**刻意保留原结构**，已在代码里就地注释 |

> 计划原文写「约 21 个文件」，实测**22 个**，基本吻合。真正被推翻的是更早一版按 `errorRef` 枚举出的「20 个页面」——
> 那个口径漏掉了 `merchant/Products.vue` 这类**用 toast 而非 error ref** 的加载器（同类的 `merchant/Wallet.vue` 见上表）。

#### 4b · `toErrorMessage()` — `catch (e: any)` 归零

新建 [`src/utils/error.ts`](src/utils/error.ts)（33 行）。取值优先级：`Error.message` > 抛出的字符串

> 形如 `{ message }` 的对象 > 兜底文案。

**为什么这个函数这么短：因为 [`api/http.ts`](src/api/http.ts) 的拦截器已经把活干完了。**
成功分支对 `code ≠ 0/200` 主动 `throw new Error(res.msg || res.message || 'Request Error')`；
失败分支会把 `error.message` **改写**成后端 `{ code, msg, data }` 里更具体的那句（优先 `data`，其次 `msg`）。
所以调用点**不该再去 `e.response.data.msg` 二次取值** —— `e.message` 已经是最具体的那句了。

`catch (e: any)` 实测 **12 处**（不是计划里写的 26/24：加载器那批已随 4a 一并消失），现为 **0 处**，全部改为
`catch (e)` + `toErrorMessage(e, 原兜底文案)`。这 12 处**用户可见文案一字未改**。

**唯一一处刻意不换的**：`dashboard/Orders.vue` 的取消订单，原表达式是
`e?.response?.data?.msg || e?.message || 'Failed to cancel order.'` —— 它把 `response.data.msg` 排在 `message` **之前**。
这不是笔误导致的等价改写：当后端返回 `{ code, msg: '操作失败', data: '用户名或密码错误' }` 时，
拦截器把 message 折算成了更具体的 `data`，而这句话读的是较笼统的 `msg`，**两者并不等值**。
换掉会改变用户看到的文案，属于另一件事 —— 所以**原样保留该优先级**（就地注释说明），只把 `any` 去掉。

#### 4c · 提示渠道统一（`ElMessage` → `useToast`）

`ElMessage.*` 调用点在 diff 里删掉 **67 行**，现全项目 **0 处**；`useToast` 从 28 个文件增至 **38 个**。
用户在同一次操作里看到两种提示样式的问题消失。

**刻意保留 `ElMessageBox`**（`Merchant`/`Products`/`Users`/`Addresses`/`Wallet` 等的确认框与输入框）：
那是**带焦点陷阱和键盘导航的模态交互**，不是提示条。CLAUDE.md 第 2 节的判定顺序正指向它
（"Element Plus 已有，且需要内部状态机 / 键盘焦点陷阱"→ 用 el-*）。这些文件的 element-plus 导入相应收窄为只引 `ElMessageBox`。

两处顺带补上的能力：

- **`useToast` 增加 `'warning'` variant**。阶段 1 曾判定"加一个没人用的 variant 属于凭空造能力"——那个判断**当时是对的**
  （确实无人传 `'warning'`），但 4c 一旦动手，`ElMessage.warning` 就有 5 处调用待迁。
  此时要么把它们拍平成 `default`、要么升级成 `destructive`，两种都是在**丢失原有的语义分级**，
  所以补 `warning` 是必要的，不是造能力。
- **`Toaster.vue` 补无障碍**：常驻的外层容器加 `role="status" aria-live="polite" aria-atomic="false"`
  （不能加在 `TransitionGroup` 上 —— 它随内容一起挂载/卸载，`aria-live` 必须**先于**内容存在才能播报），
  图标按钮补 `aria-label="Dismiss notification"`。

#### 4d · 单测

`useAsyncTask.spec.ts`（135 行 / **12 条**）与 `error.spec.ts`（34 行 / **6 条**）。
单测总数 **67 → 85**。覆盖的都是**约定本身**而非实现细节：`silent` 不清 error、任务体 `return false` 不算失败、
`reportError:false` 不污染 error ref、`cause` 是同一引用、以及 `null`/`undefined`/`0`/`false`/`Symbol`/`{}`/`[]`/`Map` 一律走兜底。

#### 闸门（实测）

| 命令                | 结果                                                     |
| ------------------- | -------------------------------------------------------- |
| `npm run typecheck` | EXIT 0                                                   |
| `npm run lint`      | **0 error / 209 warning**（比 210 基线**少 1**，无新增） |
| `npm run test:unit` | **85 passed**（5 文件）                                  |
| `npm run test:e2e`  | **102 passed**（1.9 分钟）                               |

> 那少掉的 1 条是这样来的：给关闭按钮加 `aria-label` 时先引入了 1 条 `vue/attributes-order`，
> 顺手把该按钮的 `@click` 挪到属性之后 → 既消掉新增的、也消掉原本就有的 1 条，净 −1。

#### 已知差异（接受并记录，不是没发现）

1. **`Compare.vue`**：`catch` 到 `message` 为空串的 Error 时，原实现写 `''`（界面上什么都不显示，等于谎报"没有可比较的商品"），
   现在显示兜底文案。这与阶段 2 立下的「失败不许报成空」同向，属修正。
2. **i18n 兜底文案的求值时机**：由「catch 那一刻求值」变成「setup 时求值」。因为项目**只有 `locales/en.ts`**
   （无运行时切换），两者恒等；**将来若真的加上语言切换，这里要跟着改**。
3. `admin/Orders.vue` 等操作类 catch 的 `catch (error)` 里未使用的参数一并清成了裸 `catch { }`（eslint 本就允许，属顺手）。

#### 明确**未做**的一项（用户未表态，**不擅自执行**）

**恢复被丢弃的真实失败原因**：`admin/Merchants.vue` 等页面有多处 `ElMessage.error('Action failed')` 这类
**不含任何原因**的固定文案，后端返回的具体原因（`e.message`）就在手边却被丢掉了。
4c 只统一了**通道**，**没有改这些文案** —— 它改变的是用户可见文案，属于另一件事，需用户点头。
**当前状态：只报告，未做。**

> 原计划把本项目标为「请求样板收敛」，现在看**真正的靶心其实是 `useAsyncTask` 一处**（22 文件受益），
> 4b/4c 是它顺带带出来的两笔债。阶段 5 的 `useListQuery()` 应**建在 `useAsyncTask` 之上**，不要另起一套加载形态。

### 阶段 5 — 列表页抽象

`loading`/`searchQuery`/`statusFilter`/`loadData`/`onMounted`/debounce watch 六件套在 8 个 admin/merchant 页面逐字重复。抽 `useListQuery()` + `<DataTablePanel>`。
**`el-table` 不动**——CLAUDE.md 明确禁止改写成自建表格。

### 阶段 6 — 类型地基（拆巨页的前提）

- 同一"商品"结构被定义 **4 次**：`types/product.ts` `Product`、`merchantProducts.ts` `MerchantProduct`、`adminProducts.ts` `AdminProduct`、`merchantPublic.ts` `MerchantFeaturedProduct`
- `MerchantStat` 2 份**同名不同定义**（`adminDashboard.ts` vs `merchantDashboard.ts`），`dashboard.ts` 的 `Stat` 是第三份
- 约 60 个领域类型散落在 `api/modules/*`（`Order`/`Address`/`Coupon`/`CartItem` 全在模块文件里），`src/types/` 只剩 1 个文件
- **31 处 API 调用未传泛型**（命中 `http.ts` 的 `<T = any>` 兜底）——模式一致：查询传泛型、变更不传

放在阶段 7 之前是有意的：否则拆出来的子组件仍绑着 4 份互相打架的商品类型。

### 阶段 7 — 拆巨页

`Checkout.vue`(1314) 先做——`usePaymentFlow()` 边界最清晰（支付网关状态机 + 3DS 回调 + 落单）。
`ProductDetail.vue`(2083) 后做——评价子系统可整块搬成 `useProductReviews()` + `<ReviewSection>`。
**风险高**：支付三步向导、3DS、评价 CRUD 必须人工 + E2E 双验证。**必须等阶段 0 的 E2E 就位。**

### 阶段 8 — 数据层收敛

- **订单无单一 owner**：`api/modules/orders.ts` 自己写盘，`dashboard/Orders.vue` 与 `DashboardHome.vue` 又各缓存一份 ref，取消订单不互相同步
- **券码目录硬编码 3 处**：`stores/coupons.ts`、`api/modules/loyalty.ts`、`api/modules/checkout.ts`
- **9 个 `api/modules/*` 自己写 localStorage**（传输层替 store 干持久化）
- **mock 开关双轨**：`RUNTIME_USE_MOCK`（store 用）vs `USE_MOCK`（api 模块用）
- **失败态清空数据**：`stores/returns.ts` / `stockAlerts.ts` 的 catch 把列表置 `[]`，"加载失败"与"没有记录"不可区分

### 阶段 9 — 展示层收敛

`ProductCard.vue` 已存在却只被 3 处使用，另有 **7 处**页面手写商品卡 markup；图片上传逻辑 **3 份**（`ProductDetail` / `merchant/Products` / `merchant/Settings`）；`formatPrice` **5 份**；邮箱正则 **3 份**；促销码块 **2 份**。

---

## 待决策项（不阻塞阶段 0–5）

1. **i18n**：现状英文固定 + 12/60 文件走 `$t` + 其余硬编码英文字面量 = **双轨制**。要么补齐 admin/merchant（约 200 key），要么摘掉 vue-i18n（省掉 chunk 里的消息编译器）。**维持现状是最差选项**——同时付 i18n 运行成本与不一致成本。
   （注：33 个 `.vue` 含中文，但逐行核对后全是**中文开发注释**，不是用户可见文案；唯一可见中文是全角括号。）
2. **mock**：29/30 个 API 模块内嵌 mock 数据 = 生产代码里的测试代码。迁 MSW 能让 `api/modules/*` 从 3148 行砍掉一半。
3. **wishlist / browsingHistory / followedStores**：后端 `ProductCollect`/`ShopCollect`/`ProductBrowsingHistory` 接口**现成但前端从未接线**。接线会把"免登录本地收藏"变成"登录后同步"——**是功能语义变更，不是重构**，须先确认。
4. **loyalty**：后端**零接口**，积分只存浏览器 localStorage（清缓存即丢、换设备不同步、与订单无对账）。需先定产品语义。

---

## 止损线（不要动的东西）

以下经核实是健康的，重构期最容易被误当"重复代码"清掉：

- **`returns` / `stockAlerts` 的 store + api 两层**：类型只在 api 模块定义一次（store 仅 `export type` 转出）、写者只有 store、读者只有页面、非 mock 下服务端权威。**这是全项目最干净的部分**，拆掉会连带毁掉 mock 分支与作用域重载。
- **`Button` / `Skeleton` / `StatusBadge` / `ErrorState` / `ConfirmDialog` / `DetailDrawer`**：`ConfirmDialog`/`DetailDrawer` 内部本就是 `el-dialog`/`el-drawer` 的封装，不是重复造轮子。
- **两套 UI 体系的命名约定**：自建组件 PascalCase（`components/ui/**`，unplugin 全局自动注册）+ Element Plus kebab-case。**禁止为"统一"把 `el-table` 改写成自建表格，或把 `Button` 换成 `el-button`。**
- **`userScope` 的订阅机制**：解决了真实问题（换用户读旧数据）。只需修两处：`api/http.ts` import `@/stores/userScope` 的依赖倒置、`scopedKey()` 在热路径反复 `JSON.parse`。

## 已知 bug（小，但属实）

`api/modules/product.ts:297-298` 读未加作用域的裸 key（`nexus_browsing_history` / `nexus_wishlist_items`），而 store 只写 `scopedKey()` 后的 `..._u<id>`，**全项目无任何写者** → 该 key 恒为空。
**仅影响 mock 分支**（非 mock 走 `/products/recommend/{limit}`）："为你推荐"的个性化静默失效、退化为纯热门。
**不是跨用户泄漏**（无写者即无数据可串）。
