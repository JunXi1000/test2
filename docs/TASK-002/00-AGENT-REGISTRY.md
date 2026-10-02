# TASK-002 编制表与契约冻结（总控 Agent）

> 用户裁决：**方案 A —— 修到可验收**。
> 上一轮 TASK-001 的验收结论与问题清单见 [../TASK-001/REPORT.md](../TASK-001/REPORT.md)。

## 一、本轮四个验收目标（用户可见的"完成"定义）

| # | 目标 | 判据 |
|---|---|---|
| G1 | 后端测试闸门全绿 | `mvn -B clean test` **failures = 0 且 errors = 0**（基线 171 run / 11F / 1E） |
| G2 | 前端闸门全绿 | `vue-tsc --noEmit`（src 与 test 配置）各 0 错误；`npm run build-prod` rc=0 |
| G3 | **券链路可用** | 登录 + 已领券 → `/checkout/promo` **200** 且减免正确；匿名 → **401** |
| G4 | **金额三方一致** | `summary.total == payments/create.amount == payment.amount == Σ product_order.total_money`（同一次下单） |

## 二、冻结契约（C0–C5）—— 先冻结再派活

> 上一轮 BLK-4 的成因就是"后端新增了 `code` 通道，而前端从未发送"——**契约未冻结时，前后端会各自发明签名**。故本轮由 Lead 先把契约定死，三方（后端/前端/测试）按同一份契约实现，**任何一方认为契约有误只能回报 Lead，不得自行变更**。

| 契约 | 内容 | 修复目标 |
|---|---|---|
| **C0** | **两步缺一不可**：① `/checkout/summary`、`/checkout/promo` 移出 `SpringMvcConfig.excludePathPatterns`；② **同时**在 `AuthzRules` 增加 `new Rule("/checkout/**", Set.of(USER))`。⇒ 匿名 **401**、登录 **200**。/ 只做① ⇒ 默认拒绝使登录用户得 **403**；只做② ⇒ 白名单优先使 `CurrentUserThreadLocal` 仍为空 ⇒ 仍是 400 | BLK-1（券入口对所有人不可用） |
| **C1** | `/checkout/summary`：无 `code` → 200 且 `discount=0`；有 `code` 未领券 → 400「您未领取该优惠券」；已用 → 400「该优惠券已使用」；正常 → 200 带真实减免。`shipping`/`tax` 保持可选（已移出契约） | BLK-1/BLK-4 |
| **C2** | `/checkout/promo`：必须登录 + 必须已领券 → 200 `{discount}`；未领 / 已使用 / 优惠码无效 → **400**；**未达门槛 → 409**（⚑ 勘误：Lead 初稿写"400"，实为本批之前既有的 409，测试刻意钉住「沿用既有错误码」，无缺陷驱动 ⇒ 裁决维持 409，见 §七 第 9 步）；**不得**恢复 SAVE10/VIP15 硬编码兜底 | BLK-1/BLK-2 |
| **C3** | `POST /payments/create`：带 `code` 时核销并计入实付；**前端传的 `price`/`amount` 一律忽略**，金额一律服务端按 DB 价重算（现状正确，不得改坏） | BLK-4 |
| **C4** | 同一次下单四处金额必须相等（见 G4） | BLK-4/BLK-5 |
| **C5** | 未实现的写端点不再返 200 假成功，统一 **501 + 明确 msg**：`PUT /admin/settings`、`PUT /merchant/settings`、`POST /merchant/wallet/withdraw`、`PUT /addresses/{id}/default` | MAJ-3 |
| **C6** | `/account/notifications`：字段名**保持** `emailOrder`/`emailPromo`/`smsOrder`（买家侧前端、DB、后端本就三方一致，无需对齐）；真缺陷是**缺参数校验** ⇒ 三个偏好**全缺 → 400**，不再 200 静默无效果 | MAJ-3（静默 200） |
| **C7** | 状态码口径：`StorefrontCheckoutController:84` 的「结算商品参数不合法」**定为 400**（不回到 409）；同步 javadoc 与测试 | BLK-3 |

## 三、团队编制与写范围（严格互斥，零重叠）

| Agent | 任务 | 写范围 | 关键禁止 |
|---|---|---|---|
| `backend-fix` | task-7（A） | `src/main/java`、`src/main/resources`、`docs/backend-api.md`、`docs/STARTUP.md` | 不碰 `src/test/**`、`web/**`、`sql/**`、`docker/**`；不执行迁移 |
| `frontend-fix` | task-8（B） | `web/src` | 不碰 `src/main/**`、`src/test/**`、`web/tests/**`、docs 契约 |
| `qa-acceptance` | task-9（C）→ task-10（D） | `src/test`、`web/tests`、`docs/TASK-002/06*` | **只报 Bug 不修 Bug**；不碰 `src/main/**`、`web/src/**` |
| `code-reviewer` | task-11（E） | `docs/TASK-002/07-CODE-REVIEW.md` | **只读**，绝不改代码 |
| （Lead） | task-12（F） | `docs/TASK-002/00-*`、`REPORT.md`、`_z-evidence` | 不亲自写业务实现 |

> **写范围完全互斥是本轮的设计要点**：上一轮 56 个文件长期悬在工作树、且"运行态与代码不一致"，很大程度源于缺乏清晰的写入边界。

## 四、依赖图与阶段

```
P1 并行写入（文件层，三方可同时进行）
  task-7 backend-fix ──┐
  task-8 frontend-fix ─┼──→ 契约 C0–C5（Lead 冻结）
  task-9 qa 测试同步 ──┘
        │
        ├──────────────→ task-11 code-reviewer（只读，A+B 完成后即可并行）
        ▼
P2 闸门与回归（容器独占）
  task-10 qa-acceptance：mvn clean test + vue-tsc + build + 重启 + 真实 HTTP 四项回归
        ▼
P3 终验
  task-12 Lead：独立复跑 + 交付报告
```

| 任务 | 阻塞于 | 状态 |
|---|---|---|
| task-7 后端修复 | — | 🔄 进行中 |
| task-8 前端修复 | — | 🔄 进行中 |
| task-9 测试同步 | — | 🔄 进行中 |
| task-10 闸门与回归 | task-7,8,9 | ⏸ 等待 |
| task-11 Review Gate | task-7,8 | ⏸ 等待 |
| task-12 Lead 终验 | task-10,11 | ⏸ 等待 |

## 五、容器独占锁协议（§26.22 的等效实现）

本轮真正的共享资源仍是容器 `nexus-dev`（唯一 JDK/Maven/Node/MySQL 所在）。**同一时刻只允许一个持有者**：

| 阶段 | 锁持有者 | 允许的操作 | 交接 |
|---|---|---|---|
| P1 | `backend-fix`（唯一获批者） | 一次 `mvn -B -o -q compile`（**不 clean、不 test**，因为运行中的 dev 后端不能杀） | 完成后交回 Lead |
| P1 | frontend-fix / qa-acceptance | **禁止进容器**（只能静态自审） | — |
| P2 | `qa-acceptance` | `mvn -B clean test`（须先 pkill dev 后端）、`vue-tsc`、`build-prod`、重启后端、HTTP 回归 | 完成后交回 Lead |
| P3 | Lead | 独立终验 | — |

> 取舍说明：P1 只放行一次编译，是为了避免"三方同时 mvn/npm → target/ 与端口互相踩"。代价是前端与测试的类型/编译错误要到 P2 才暴露，由 Lead 回派给对应写入者——这是有意的串行化，不是遗漏。

## 六、本轮**不做**的事（防止范围蔓延，§八）

| 项 | 原因 |
|---|---|
| 应用 V6~V11 迁移 | 已裁决：零消费者、不可重复执行、应用会让 6 处注释变假话。留待"钱包/设置/评论审核"的 Java 实现与 schema 同批交付 |
| 实现钱包/设置/评论审核/默认地址的真实逻辑 | 属 Phase 3 未完成功能（D2），不是"修到可验收"的必要条件；本轮对它们做**诚实降级（501）** |
| 修 MAJ-1 营收环比恒 0、MAJ-2 转化率恒 100% | 不属四个验收目标；已在问题清单记账，建议下一轮 |
| 修 MIN-1 `/products/{id}` 不存在返 200、MIN-3 字段集不一致等 | 同上，非 Blocker |
| 提交 git | 需用户明确授权后才执行；本轮结束时给出建议的 commit 切分 |

## 七、调度日志

| 步骤 | 事项 | 处置 |
|---|---|---|
| 1 | 用户裁决"按 A 开工" | 先冻结契约再派活（避免重演 BLK-4 的"各自发明签名"） |
| 2 | 契约 C0–C5 定稿 | 每条都对应上一轮实测出的具体缺陷，不是凭经验假设 |
| 3 | 按"写范围互斥"切三个并行任务 + 两个汇聚任务 | 前后端/测试三方零文件重叠，从设计上消除覆盖写 |
| 4 | 明确"本轮不做"清单 | 防止开发 Agent 顺手扩大范围（§八） |
| 5 | qa 中途上报：**只删白名单不够**，`AuthzRules` 无 `/checkout/**` 且默认拒绝 ⇒ 登录用户会从 400 变 403 | **采纳，契约修正 v2**：C0 扩为两步（删白名单 + 加 `/checkout/** → USER` 规则）。这是 Lead 冻结契约时的疏漏，靠下属"回报而非照做"补上 |
| 6 | qa 自查更正：`AuthzRules.isCovered()` 是 `match(rule.pattern(), path)` 方向，`/checkout/**` 能覆盖端点 ⇒ 无需改闸门 | 采纳。结论不变（两步缺一不可），仅表述纠正 |
| 7 | Lead 查证推翻自己的 C5 注记：买家端字段名三方本就一致，`{email,push,sms}` 属**商家端** | **契约修正 v3**：原"字段对齐"说法作废，改为 **C6**（真缺陷＝缺参数校验 ⇒ 三偏好全缺 → 400） |
| 8 | Lead 发现前端闸门口径写漏：`web` 真实闸门是 `npm test` = typecheck + lint + test:unit，且 `src/**/*.spec.ts` 同时参与 typecheck | 修正 G2 与 task-10；并把 `web/src` 内 4 个 spec 的回派给 frontend-fix（**重开 task-8 为 B2**） |
| 9 | backend-fix 上报 C2 字面冲突（我写 400，现状与测试是 409） | **裁决：维持 409**（§十 最小范围修改；无缺陷驱动；我初稿的 400 是假设而非需求） |
| 10 | **写冲突事件**：qa 编辑 `web/src/composables/useOrderSummary.spec.ts` 撞 `FS_STALE_VERSION` | **裁决 (B)：`web/src/**/*.spec.ts` 归 frontend-fix 独占，qa 只复核不改。** 根因是 Lead 把"断言归属"与"目录归属"切岔了；task-9 的 `write_scopes` 字段本就正确（不含 `web/src`），是散文描述引起歧义 ⇒ **以后以 `write_scopes` 字段为准**。文件系统版本守卫只在目录级单写者下才有意义 |
| 11 | backend-fix 上报 `/cart`、`/checkout` 无 `requiresAuth` 而 `fetchSummary()` 无守卫 | Lead 亲自核实（`router/index.ts:170/175`、`useOrderSummary.ts:129-130`）确认是真实隐患 ⇒ 立 **task-13（B3）**，并加入 D 的阻塞前置 |
| 12 | **Review Gate 判出唯一 Blocker BLK-E1**：结算页应付总额仍客户端自算且把**积分**减进去，而后端零积分概念 | Lead 亲自读码复核**成立**，并确认精确边界：`useOrderSummary.ts:121` 有缺陷、`useCartSummary.ts:55` 无缺陷。**裁决：修，不收窄 G4**（把已知"显示额 < 实扣"留在买家结算页不可接受）⇒ 立 task-14（G1）/task-15（G2）/task-16（H 复验）/task-17（I 聚焦复审）。**这是 BLK-4 同类缺陷的第二次复发，通道从"券"换成"积分"** |
| 13 | D 阶段闸门：**G1 后端 192/0F/0E 全绿；G3/G4/C5/C6/回归 20/20 通过；G2 前端失败 3 点** | 2 个根因全在 `web/src`（`Cart.vue:28` 未用声明使 typecheck+lint 必红；`usePromoCode.ts:63-68` watcher 把用户刚输入的码清空＝**真实行为缺陷**）＋1 个 spec 夹具 ⇒ 立 **task-18（G1b）**，加入 H 的阻塞前置 |
| 14 | D 暴露环境陷阱：Vite dev server 漏掉 `router/index.ts` 的 21:56 变更，导致"匿名 `/checkout` 落 `/cart`"的假失败 | 重启 Vite 后复验通过 ⇒ B3 实现正确。另修了 `nohup … &` 在 `docker exec` 会话结束时被 SIGHUP 杀死的问题（改 `setsid -f`）。**教训进团队约定：长驻 dev server 必须 `setsid -f`；跨文件改动的运行态验证必须先重启对应进程**（与 TASK-001 的"陈旧 class"是同一类问题） |
| 15 | **裁决（e2e 口径 a）**：`product-reviews.spec.ts` 13 条失败——该 suite 断言 **mock 种子评价**，而本批已刻意关闭伪造评价（`reviews.ts` 的 `SEED_REVIEWS_ENABLED=false`，TASK-001 已审为"诚实降级"） | **裁决：改写为断言"诚实空态"，不跳过、不保留伪造评价断言。** 依据与"不得为绿灯恢复已删除的错误语义"同源——保留这些断言＝把已删除的行为钉住；跳过则等于隐藏真实产品行为。**同时须向用户披露**：mock 演示评价已被关闭属可见行为变更，若要恢复属产品决策 |
| 16 | **裁决（e2e 口径 b）**：qa 自认其 2 条 Cart e2e 断言过宽（把"券生效时仍会出现的 `Tiered discount` 标签"误当已删除的满减行） | 采纳 qa 自己给出的正确不可变量并授权其重写：**`Tax (`/`Shipping` 行 count=0 且"显示 Total == 小计"**。这是"断言按实现擦屁股"的反面案例，值得记：**断言要钉不可变量，不要钉实现细节的字面量** |
| 17 | D 暴露的第二批闸门失败（`Cart.vue:28` 未用声明使 typecheck+lint 必红；`usePromoCode` watcher 吞掉用户输入＝**真实行为缺陷**；spec 夹具未接线） | 立 **task-18（G1b）**。同时把"前端真实闸门＝`npm test`（typecheck×2 + lint + vitest）"写进 task-16，并记下教训：**`build-prod` 绿不代表类型通过**（esbuild 不做类型检查） |
| 18 | Lead 裁决：`useCartSummary.ts:55` 由"不要动"**改判为要修** | 立 **task-19（G1c）**。理由：它当前与服务端 `total` 恒等、无用户可见缺陷，但它是"客户端自算应付额"这一**已复发两次**的缺陷类的最后一个存活实例 ⇒ 按根因消灭，不等第三次。frontend-fix 顺带把两份逐字相同的私有 `amount()` 合并为一份（"两份副本正是漂移的起点"） |
| 19 | **事故（环境，非 agent 失败）**：Docker Desktop 停止运行 ⇒ 容器与前后端全部下线 | H（qa）与 I（code-reviewer）**双双在执行中被中断**，两任务停在 `in_progress`。Lead 核实：Docker 进程仍在但 Linux engine 命名管道不可用 ⇒ 判为引擎重启而非配置损坏，等待后自动恢复。**处置**：不重派已完成的工作，改为"保留已落盘产物 + 恢复后只补未完成部分"；H 的报告仍是修复前数字，第二次放行时已要求**用本轮实跑覆盖** |
| 20 | **I 的复审结论**：BLK-E1 那一类**已按根因闭环**（13 项核对全过：两处应付额只取服务端值、积分彻底退出含接口级 `not.toHaveProperty` 钉子、第二资损面 `spendPoints` 已删、两条同构判别用例且夹具按生产接线）；**应付额不存在第三处**（更宽的"客户端自算金额"另 5 处逐条分类，均不影响扣款） | 采纳，verdict 仍 `conditional`（唯一卡点 BLK-I1）。**特别肯定 I 的诚实边界**：Docker 停机导致 V-1…V-6 一项都未取得，报告显式标注"未按已验处理"、未虚报 pass |
| 21 | **I 判出新 Blocker BLK-I1**：结算页内加购后**不重取摘要** ⇒ 页面 Total 是旧值、实扣按新 items ⇒ 显示额 ≠ 实扣 | **裁决：修，不收窄 G4**（第三次拒绝用"收窄口径 / 记 known-gap"把这一类压下去）⇒ 立 **task-20（G1d）**。采纳的解法：**绑数据（价格签名 `id:quantity:price`）而非绑动作**——"绑动作＝以后每加一个改 items 的入口都要记得补一行，那正是 BLK-I1 的成因"；配 `shouldRefetch` 闸门与 `fetchSeq` **乱序守卫**（否则自动重取反而引入"旧值覆盖新值"的新不一致） |
| 22 | frontend-fix 主动修掉**购物车页同形缺口**（该页有 4 个改 items 的入口，取过一次摘要后总额会一直停在首值） | **接受，不算范围蔓延**：与 BLK-I1 同属一个缺陷类，正是本轮治理目标本身。它还收敛了 `Cart.vue` 三处重复的券码三元（否则改数量会用不带券的摘要覆盖带券的 ⇒ 总额反弹） |
| 23 | frontend-fix 修正**测试方法本身**：新增 `flush()` 排空微任务 | 采纳。原断言只 `await nextTick()`，而重取是 fire-and-forget ⇒ **旧断言实际在测时序巧合**（D 阶段那条"移除"用例正是靠巧合绿的）。这条比它修的 Bug 更值得记：**绿灯可能来自巧合，而不是行为正确** |

## 八、产物索引

| 文件 | 负责人 | 内容 |
|---|---|---|
| `00-AGENT-REGISTRY.md` | Lead | 本文件 |
| `04-BACKEND-FIX.md` | backend-fix | 契约落实位置、状态码变更、**预期需 qa 同步的测试清单** |
| `05-FRONTEND-FIX.md` | frontend-fix | `code` 传递路径、购物车新口径、**预期失效的 e2e 断言清单** |
| `06a-TEST-SYNC.md` | qa-acceptance | 测试同步说明与新增回归网 |
| `06-TEST-REPORT.md` | qa-acceptance | 闸门数字、四项验收目标达成结论、回归结论 |
| `07-CODE-REVIEW.md` | code-reviewer | Review Gate 结论与契约落实核对表 |
| `REPORT.md` | Lead | 最终交付与 commit 建议 |
