# web/ 前端工作约定

本文件只记录**本项目已确认的决策与既有事实**。编码规范见 [`aiagant.md`](./aiagant.md)。

> ⚠️ `aiagant.md` 描述的是**目标态**；`web/` 是已有生产代码（126 个源文件 / 60 个 `.vue`）。
> 两者冲突时，按本文件的**增量对齐**策略执行，**不要按规范去重构既有代码**。

---

## 1. 已确认的落地策略（2026-09-20）

项目正处于**分阶段结构重构**中（进度见 [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md)：**阶段 0「立闸门」、1「死代码与构建」、2「三态规范化」、2b「主题机制收口」、3「消息页三份拷贝合一」、4「请求样板收敛」均已完成**；阶段 5–9 未开始）。此前"增量对齐、不重写旧代码"的约定**已作废**。

> 阶段 2b 的前期核实推翻了阶段 2 对主题机制的多处判断（`.dark` 其实会挂、merchant 并非暗色域），**详见第 6 节**。
> 2b-1 修好 merchant 的暗色接线；2b-2 给 admin 挂上 `.dark` 并补齐 6 页 Error+Retry、5 页空态，
> 外加两个原计划没发现的问题（`Notifications` 完全没有 catch；`Products` 网格没有任何空态）。

> 阶段 3 的**做法**值得后续阶段照抄：**先写特性化 E2E 钉住重构前的真实行为，再动代码**。
> 它纠正了原计划两处错误判断（"两者行为已完全一致"其实不一致；"需 E2E 护住"当时根本没有 E2E），
> 并且挖出一个真 bug —— **dashboard 消息页的 ErrorState 从没渲染过**（`loadAll` 在外层设 `errorRef`，
> 而 `loadConversations` 内部把异常吞了）。**加载失败要分两种语义：首次上抛、轮询静默**，别合成一个 `catch`。

**行为边界**：结构重构 + 允许改 UI/交互，但**功能不可丢**。
允许拆组件、抽 composable、整理数据层、补齐 Loading/Empty/Error、修视觉与响应式问题。
不允许悄悄改变业务语义；涉及接口契约的改动需先确认后端能配合。

**依赖尺度**：

| 类别                                                   | 结论                            |
| ------------------------------------------------------ | ------------------------------- |
| 开发/测试工具（ESLint、Prettier、Vitest、MSW、Husky…） | ✅ 可装                         |
| 运行时库（TanStack Query、Zod、VeeValidate、Sentry…）  | ❌ 仍不引入，现有手写方案继续用 |
| pnpm / Turborepo / Workspaces                          | ❌ 不动，维持 npm 单包          |

**其余新增依赖仍须先问。** 规范第 31/32/35/36 条：禁止编造 API、方案有分歧时由用户决定。

---

## 2. 组件约定（最重要的一条）

项目**有意**混用两套组件，按复杂度分层。模板里用命名区分，全项目一致，**务必保持**：

### 自建组件 → `src/components/ui/**`，模板里写 **PascalCase**

由 `unplugin-vue-components` 按文件名**全局自动注册，无需 import**。
风格是 shadcn-vue：`cva()` 定义 variants + `cn()` 合并类名（`Button.vue` 是标准范本）。主题变量（`--primary`、`--ring` 等）定义在 `src/assets/css/tailwind.css`（**唯一**被 `main.ts` 引入的样式入口）。

`Button`(25 处) · `Skeleton`(19) · `Card` · `StatusBadge` · `ErrorState` · `EmptyState` · `Toaster` · `ProductCard` · `StatCard` · `DetailDrawer` · `PageProgress` · `Breadcrumb` · `ConfirmDialog` · `FormField` · `SizeGuide` · `ProductQA` · `PaymentGatewayModal` · `ChatWidget`
`components/ui/chat/`（阶段 3 建立）· `ChatWorkspace` · `ChatMessageBubble` · `ChatConversationItem` · `ChatComposer` · `MerchantInfoPanel`
—— 消息页零件，买家页（`dashboard/Messages.vue`）与卖家页（`merchant/Messages.vue`）共用。
**它们不认识角色**：极性早已被 `useChatConversations` 折算成 `message.isSelf`，
模板里不要再出现 `user` / `merchant` 字符串，也别用 `v-if="isMerchant"` 这类分支往回长。

- **`ChatWorkspace` 就是这两个页面的全部模板**（三栏骨架 + 数据 + 布局都内聚在它里面）。
  页面只给 7 个字符串/枚举 props 和 2 个插槽（`peer-avatar`、`conversation-avatar`），**不 emit 任何事件**。
  要改消息页的布局/交互，改这里一处即可，别去两个页面里各改一遍。
- 两侧真正的差异只有**对端头像长什么样**（买家看商家：有图且可点开资料抽屉；卖家看顾客：多数没图、图标兜底），
  而这是**必填插槽、没有默认值**。头像外层圆框与尺寸由零件提供，所以插槽里给图标请用相对尺寸（如 `h-1/2 w-1/2`）。
- `ChatWidget.vue` 是**另一条路**（浮窗，自有 markup 与 token 体系，未共用上面这些）；它仍是第三份消息实现，见阶段 9。

**三态用 `src/components/ui/state/` 下的两个组件**（阶段 2 建立）：
`ErrorState`（内联横幅 + Retry，非整页）与 `EmptyState`：

- `variant="default"`（省略即默认）：虚线面板 + 图标 + 标题 + 说明，默认插槽放操作按钮 → 整块列表为空。
- `variant="compact"`：无边框单行文案 → 侧栏 / 抽屉 / 局部筛选结果。
- 传 `:icon="SomeLucideIcon"`、`title`、`description`；留白/底色用 `class` 覆盖。
- **适用范围：全部四个域都可以直接用**（阶段 2b 已收口）。storefront / `dashboard/**` 走 DefaultLayout 的 `useDark()`，
  `merchant/**` 由 2b-1 补上同一句，`admin/**` 由 2b-2 在 `AdminLayout` 里恒定挂 `.dark` —— 令牌在四处都解析正确。

### Element Plus → 模板里写 **kebab-case**

`el-table`(5) · `el-form`/`el-form-item`(5/6) · `el-select`(8) · `el-input`(5) · `el-switch`(3) · `el-tag`(5) · `el-icon`(5) · `el-descriptions`(4) · `el-divider`(3) · `el-dialog`(2) · `el-dropdown`(2) · `el-tooltip`(2) · `el-timeline`(2) · `el-card`(2) · `el-drawer` · `el-tabs` · `el-image` · `el-popover` · `el-pagination` · `el-alert` · `el-divider` · `v-loading`

### 新增组件时的判定顺序

```
1. components/ui/** 里已有 → 用那个 PascalCase 组件
2. Element Plus 已有，且需要内部状态机 / 键盘导航 / 焦点陷阱 / 虚拟滚动
   → 用 kebab-case 的 el-*
3. 都没有 → 手写进 components/ui/<类别>/<Name>.vue，照 Button.vue 的 cva + cn() 写法
4. 需要新装 UI 库 → 停下先问
```

**不要**为了"统一"把 `el-table` 改写成自建表格，也**不要**把 `Button` 换成 `el-button`。

---

## 3. 会执行的规范条款

- Composition API + `<script setup>`，不写 Options API（现状 60/60 已符合）
- TS 严格类型，新增代码不用 `any`；接口数据不默认 `any`
- 组件单一职责；重复逻辑抽 `composables/`（`useToast`、`useFormValidation`、`useMerchantNotifications`、`useMessagesLayout`、`useChatConversations`(阶段 3)、**`useAsyncTask`(阶段 4)**。`useResponsive`/`useAccessibility`/`useLazyImage`/`useAnimations`/`useChatUploads` 因**零引用**已于阶段 1 删除——要复现这类能力请按需重写，不要凭记忆 import）
- **页面取数一律走 `useAsyncTask()`**（阶段 4 建立，22 个文件接入）。别再手写 `isLoading` + `errorRef` + `try/catch/finally` 三件套：
  `const { isLoading, error: errorRef, run } = useAsyncTask({ fallbackMessage: '…' })`，调用点写
  `const result = await run(() => apiCall()); if (!result.ok) return`。要点见 [`REFACTOR_PLAN.md`](./REFACTOR_PLAN.md) 阶段 4a：
  - 结果是**可辨识联合**不是 boolean（任务体自己可能 `return false`）；失败分支带 `cause`（原始抛出物，给 `console.error` 用）
  - **`silent` 只压 loading 标志，不清 error** —— 重试走的正是它
  - **`initialLoading` 要照抄原值**：传不传取决于该页首帧是否真会渲染出空态（现状 22 个调用点里 10 个传 `true`），不是风格问题
  - 首次加载失败写 `error`（渲染 `ErrorState`）；**轮询/追加失败只 toast，别写 error**（两种语义，别合成一个 catch）
- **错误文案用 `toErrorMessage(e, 兜底)`**（[`src/utils/error.ts`](src/utils/error.ts)），`catch` 一律写 `catch (e)` 不带 `any`。
  **不要**再去读 `e.response.data.msg` —— `http.ts` 的拦截器已把后端 `{ code, msg, data }` 里最具体的那句折算进了 `e.message`。
  唯一例外是 `dashboard/Orders.vue` 的取消订单，它**刻意保留**原优先级，就地有注释。
- 数据页面必带 **Loading（`Skeleton`）/ Empty / Error（`ErrorState` + retry）**，不只写成功态
- Mobile First，覆盖 Mobile / Tablet / Desktop，不横向溢出
- 请求分层：`Page → composable / store → api/modules/* → src/api/http.ts`，不在页面里裸调 axios
- 中文注释、英文标识符/组件名/类型名
- commit：`feat: / fix: / refactor: / test: / style: / docs: / chore:`，一次只解决一个问题
- 改前先读代码、找根因、局部修改；发现架构问题先报「问题/原因/影响/建议」再动手

---

## 4. 技术栈与命令

Vue 3.4 · Vite 5 · TS 5.9（`strict` + `noUnusedLocals` + `noUnusedParameters`）· Pinia 2.2 · Tailwind **4** · Element Plus 2.8 · vue-router 4 · vue-i18n 9 · ECharts 5 · axios · lodash-es · @vueuse/core · Playwright

> 依赖表已删 `dayjs`（源码零引用；它仍作为 element-plus 的**传递**依赖存在于 node_modules，不要直接 import）与 `@vueuse/motion`（零引用）。新增运行时依赖仍须先问。

```bash
npm run dev          # vite，:5173，绑 127.0.0.1（横幅只有一条 Local）
npm run dev:lan      # vite --host，绑所有网卡 —— 手机/别的机器要访问时用这条
npm run prod         # vite --mode production
npm run build-prod   # 产物到 dist/
npm run preview
npm run typecheck    # vue-tsc：src/ + tests/ 两个 project
npm run lint         # ESLint flat config（存量豁免棘轮，见第 6 节）
npm run test:unit    # Vitest（src/**/*.spec.ts，happy-dom）
npm run test:e2e     # Playwright，自带 webServer 会自动起 :5173
npm test             # typecheck + lint + test:unit 闸门
```

**代理**：`/api` → `http://localhost:1000`，且 `rewrite` 会**去掉 `/api` 前缀**（后端无 context-path）。直连后端测试时 URL 不带 `/api`。

---

## 5. 目录约定

```
src/api/http.ts       统一 axios 实例：注入 Bearer token、拆 { code, message, data } 信封、401 统一跳登录
src/api/modules/*     按业务域分模块（34 个）
src/api/types.ts      接口信封类型；src/types/product.ts 领域类型
src/auth/session.ts   token 读写（集中式，勿绕开）
src/config/env.ts     API_BASE_URL / USE_MOCK / FEATURE_DEV_LOGOUT
src/stores/*          Pinia；src/composables/*  复用逻辑
src/components/ui/*   自建基础组件（见第 2 节）
src/pages/{,admin,merchant,dashboard}/*  页面
src/layouts/DefaultLayout.vue + 各域 Layout 组件
src/i18n/             vue-i18n（目前只有 locales/en.ts）
src/utils/cn.ts       clsx + tailwind-merge
src/utils/error.ts    toErrorMessage(e, fallback)：错误文案折算（阶段 4b）
src/composables/useAsyncTask.ts  页面加载器统一形态（阶段 4a）
src/assets/css/tailwind.css   主题变量(--primary/--ring…)来源,main.ts 唯一引入的样式
web/.env.development / .env.production
```

---

## 6. 已知缺口与存量例外（**不要擅自修**）

- **提示条只有一条渠道：`useToast`**（阶段 4c 收口，`ElMessage.*` 现全项目 **0 处**）。新代码不要 import `ElMessage`。
  **但 `ElMessageBox` 是有意保留的**（确认框 / 输入框：带焦点陷阱与键盘导航的模态交互），它的导入按需收窄成只引它一个。
  `useToast` 的 variant 是 `'default' | 'destructive' | 'success' | 'warning'`，**warning 是 4c 补的**（原 `ElMessage.warning` 的语义分级不能丢）。
- **`admin/Merchants.vue` 等页面有多处 `'Action failed'` 这类不含原因的固定错误文案**，后端给的具体原因就在 `e.message` 里却被丢弃。
  4c **只统一了通道、没有改这些文案** —— 改变用户可见文案属另一件事，**已报告、等用户表态，不要自行"顺手修好"**。
- ~~无 typecheck / lint / test 脚本~~ → **已于阶段 0 补齐**（2026-09-20）：ESLint 9 flat config、Prettier、Vitest、Playwright、husky + lint-staged 全部就位，闸门见第 4 节命令。
- **ESLint 走「存量豁免 + 增量严格」棘轮**：`eslint.baseline.json` 把「规则 → 存量违规文件」记成一张表，`eslint.config.js` 只对表内文件关掉对应规则。给存量代码升级规则时**不要手工删表项**，重跑 `npm run lint:baseline` 让表自然收缩；改完必须保证 `npm run lint` 无**新增**告警。
- **`tsconfig.test.json` 覆盖 `tests/**`**：`tsconfig.json` 只 include `src/**`，不建这个 project 的话 `tests/` 属"无主文件"，整个 E2E 目录不受类型检查（阶段 0 正是靠它挖出 3 条断言被掏空后留下的死变量）。`npm run typecheck` 会连跑两个 project。
- **没用 husky，是手写钩子**：本仓库根是 Java/Maven 工程、前端在 `web/` 子目录，husky v9 要求自己位于 git 根，从 `web/` 跑会报 `.git can't be found`；要让它工作就得往 Maven 根塞 `package.json`，代价过大。
  现方案：`.husky/pre-commit`（普通 shell 脚本，不依赖 husky 包）+ `git config core.hooksPath web/.husky`。钩子只对「本次提交动了 `web/` 下文件」生效，后端提交完全不受影响；动了 `web/src/` 才跑全量 `typecheck`（vue-tsc 约 10s）。
  **`core.hooksPath` 是本地 git config，不进版本库** —— 换机器/重新 clone 后需手动执行一次：`git config core.hooksPath web/.husky`。
- **主题机制：三个域三种命运，别按直觉推断**（阶段 2 首次判断**错了**，阶段 2b 已从源码三路核实修正，以本段为准）：
  `.dark` 是**真的会挂**的 —— `DefaultLayout.vue:20` 的 `useDark()`（@vueuse/core）负责给 `<html>` 挂类。所以关键在于**哪个布局实例化了它**：

  | 域                                                                   | 吃到 `.dark`？                                                          | 实测后果                                                                                                                                                                                      |
  | -------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | storefront + `dashboard/**`（后者嵌在 DefaultLayout 的 children 里） | ✅                                                                      | 暗色可用；令牌与 `dark:` 变体都生效（含 dashboard 的 83 处）                                                                                                                                  |
  | `merchant/**` + `components/merchant/**`                             | ✅ **阶段 2b-1 已补上**（`MerchantLayout` 原先漏了 `useDark()`）        | 补前 **213 处 `dark:` 变体全不生效、恒为亮色**；现随主题切换。它是**亮色优先**设计（根节点 `bg-zinc-50 … dark:bg-zinc-950`），**不是暗色域**                                                  |
  | `admin/**`                                                           | ✅ **阶段 2b-2 已补上**（`AdminLayout` 恒定挂 `.dark`，不跟随主题偏好） | 它是**永久暗色域**：**一个 `dark:` 变体都没有**，暗色靠**无前缀的** `bg-zinc-950`/`text-zinc-200`/`border-zinc-800` 无条件撑着。补前 EP 组件是白底（`--el-bg-color: #fff`）、令牌解析成亮色值 |

  → 写新组件：**不要**加 `dark:` 变体，用令牌即可（令牌在两种模式下自动正确）；`admin/**` 里更是从没有过 `dark:`。
  → 令牌组件（`border-border`/`bg-card`/`text-muted-foreground`）在 **四个域都安全**。
  → `admin/**` 里挂 `.dark` 的**位置**有讲究：必须在 `<html>` 上。`el-select` 下拉、`el-dialog`、`el-popover` 都 teleport 到 `<body>`，
  变量只有定义在 `<html>`（EP 暗色变量文件的作用域正是 `html.dark`）它们才吃得到 —— 挂在布局根节点上等于没挂。
  → `.admin-*` 那套手写 EP 覆盖（`src/assets/css/tailwind.css:78-186`）**优先级仍高于** EP 暗色变量，
  挂上 `.dark` 后实测未被翻转（`--el-table-bg-color` 仍是 `rgb(26,26,28)`）。**不要去删它们**。
  → EP 暗色变量需 `main.ts` 引 `element-plus/theme-chalk/dark/css-vars.css`（阶段 2b 已补）。缺它时 `.dark` 虽生效但 EP 组件仍用亮色变量（`--el-bg-color: #fff`），暗色页面上每个 `el-*` 都是白底。

- **`src/api/http.ts` 存量使用 `any`**（拦截器与 get/post/put/del 泛型默认值）：属历史代码，按增量对齐不重写；但**不要以此为理由在新代码里继续加 `any`**。
- **`src/components.d.ts` 由 unplugin 生成**，勿手改；与源码不同步时重启 vite 即可重新生成。
- **`returns` / `stockAlerts` 的 store + api 两层不是"双写"**（已核实，先前的怀疑作废）：类型只在 api 模块定义一次、store 仅 `export type` 转出；写者只有 store，读者只有页面，没有任何页面 import 这两个 api 模块；非 mock 下服务端权威。**这两对是全项目最干净的部分——不要以"去重"为名拆掉。**
- **`src/api/modules/product.ts:297-298` 读未加作用域的裸 key**（`nexus_browsing_history` / `nexus_wishlist_items`），而 store 只写 `scopedKey()` 之后的 `..._u<id>`，全项目无任何写者 → 该 key 恒为空。**仅影响 mock 分支**（非 mock 走 `/products/recommend/{limit}`）："为你推荐"的个性化静默失效、退化为纯热门。**不是跨用户泄漏**（无写者即无数据可串）。
- **`api/modules/*` 有 9 个模块自己写 localStorage**（`orders.ts:178-217`、`payment.ts:58-87`、`address.ts:25-32`、`adminUsers.ts:23-30`、`adminOrders.ts:25-56`、`adminMerchants.ts:57-64`、`adminReviews.ts:116-127`、`merchantProducts.ts:29-36`、`search.ts:194-218`）——传输层替 store 干了持久化的活，属分层越界。

---

## 7. 项目特有的坑

- **Mock 开关**：`USE_MOCK` / `RUNTIME_USE_MOCK`（`localStorage.RUNTIME_USE_MOCK` 可覆盖 env）。新增请求代码必须同时考虑 mock 分支——历史上有过"mock 产生假 token，真实请求 401 → 登录死循环"的事故。
- **401 处理集中在 `http.ts` 响应拦截器**：会清 token、通知 `userScope` 回退 guest 作用域、按角色跳对应登录页并带 `?redirect=`。不要在业务代码里另写一套 401 逻辑。
- **后端错误体形如 `{ code, msg, data }`**，**具体原因常在 `data` 而非 `msg`**（如 409 登录失败的"用户名或密码错误"）。
- **JWT payload 含中文**：前端解码必须用 `TextDecoder('utf-8')`，直接用 `atob` 会乱码（Latin-1 误解释）。
