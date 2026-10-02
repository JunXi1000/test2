# TASK-001 交付报告：跑通与验收（总控 Agent）

> 依据 `Agent-System-Prompt.txt` §十七（用户只看结论）/ §二十一（验收 ≠ 采信声明）/ §二十二（最终交付标准）。
> 本报告所有数字均来自本轮实测或 Lead 亲自复现，未采信任何"任务完成"的口头声明。

---

## 一、结论摘要（先说能不能用）

| 问题 | 结论 |
|---|---|
| 站点能构建吗？ | **能**。后端 `mvn -B clean test` 编译通过（153 主源 + 24 测试源，编译期零错误）；前端 `vue-tsc` 双配置 **0 错误**、`build-prod` **rc=0**（28.75s） |
| 站点能启动吗？ | **能，而且已在跑**。后端 `:1000` 401（就绪判据）、前端 `:5173` 200，容器 `nexus-dev` Up |
| 跑的是当前工作树的代码吗？ | **是**（行为级证明，非 mtime 推断）。7 个"旧硬编码 → 新真实聚合"的端点返回与真实 DB 逐项吻合的动态值 |
| 主链路能走通吗？ | **能走通，但金额口径有 3 处不一致**。注册→浏览→加购→结算→下单→支付→订单→取消→库存回补全程 200 且数据落库；但**优惠券入口对所有人不可用**，购物车页金额低于实扣 |
| 测试闸门绿吗？ | **不绿**。`mvn test` = **171 run / 11 failures / 1 error**；Playwright e2e 140 passed（但仅 mock 模式，不是联调证据）；前端静态闸门全绿 |
| 这批未提交改动能直接当验收基线吗？ | **不能**。审查 verdict = `conditional`，**5 个 Blocker**（去重后）；但**没有任何文件需要整体回退** |
| 有越权/资损风险吗？ | **越权：零**（授权矩阵 15/21 逐格精确命中，跨角色/对象级全部 403 且目标数据未变）。**资损：有 3 处**（券入口死、购物车少显示 4.48、提现被静默吞掉返 200） |

**一句话**：站是活的、能跑、主链路通；但**当前工作树不是可验收基线**——优惠券功能整体不可用、金额存在三处口径不一致、测试闸门红灯，需要一轮修复才能交付。

---

## 二、本轮范围（用户裁决）

| 决策点 | 用户选择 | 执行结果 |
|---|---|---|
| 目标范围 | 先只做「跑通与验收」，产出问题清单后再决定 | 全程零业务代码改动；产出问题清单 + 本报告 |
| 未提交改动 | 先审查，确认没问题再继续 | 审查已完成：**有问题**（5 Blocker），故未进入"继续" |

**本轮未做的事（明确声明）**：未修任何 Bug、未新增功能、未提交 git、**未执行任何 DDL/DBA 变更**（V6~V11 迁移经裁决不应用，见 §五）。

---

## 三、已验收的事实（可直接采信）

### 3.1 环境与构建

| 项 | 结果 | 证据来源 |
|---|---|---|
| 后端测试 | `mvn -B clean test`：**171 run / 11 failures / 1 error / 0 skipped**（rc=1） | env-verifier（A），Lead 引用 |
| 失败清单 | `StorefrontPromoTest` 10F+1E、`RequestShapeTest` 1F | 同上 |
| 前端类型检查 | `vue-tsc --noEmit`（src）与 `-p tsconfig.test.json` 均 **0 错误** | 同上 |
| 前端生产构建 | `npm run build-prod` rc=0，仅 chunk>500kB 警告（注：`package.json` 无 `build` 脚本） | 同上 |
| 前端 e2e | Playwright **140 passed**（2.1m），**mock 模式** | qa（B） |
| 就绪判据 | 后端 `GET /` → 401 + JSON body；停后端后 http_code=000 / curl exit 7（两态实测） | A + Lead 复现（Z-1） |

### 3.2 运行态确实是最新代码（行为级）

重启后 7 个"改前硬编码 / 改后真实聚合"的端点返回值与 DB 逐项吻合：`/admin/dashboard/stats`（Active Users="5"）、`/admin/dashboard/revenue-chart`（7 个连续自然日，旧为空列表）、`/admin/dashboard/recent-users`、`/search/trending`（按 `sales_volume DESC` 顺序内容全吻合）、`/products/category-counts`（`{All:4,数码产品:3,服装:1}`，与 DB 一致）、`POST /search` 的 facets、`/merchant/dashboard/stats`。**硬编码常量不可能产出这些值**，故旧代码被排除。

### 3.3 安全与正确性守住了（这部分质量很高，修复时不要削掉）

- **零越权**：授权矩阵 21 条中 15 条逐格精确命中；未登记端点（`/shoppingCart/list` 等）全 403；shop2 改 shop1 的商品/订单一律 403 且目标数据未变。
- **token 防线完整**：过期（用容器 `JWT_SECRET` 现造并自检签名）、篡改签名、缺 `type` → 全部 401/403。
- **金额服务端重算**：篡改前端 `price`/`amount` 被**静默忽略**，服务端按 DB 价格重算（198.00 / 99.00 正确）。
- **并发正确性**：并发下单不超卖（8×3 件 / 库存 20 → 成功 18、余 2、≥0）；并发 `confirm` 6 线程幂等；并发 `cancel` 5 线程只回补一次库存。
- **券逻辑本身是对的**：四重校验、`markUsedIfUnused` 条件 UPDATE 乐观锁、`unused→used` 状态流转、按行比例分摊（Hare 配额）——**死掉的是入口，不是逻辑**（见 §四 BLK-1）。

---

## 四、问题清单（按等级，含证据与归属）

> 编号说明：本轮有两个独立 agent 各自编号（审查 `REV-*`、测试 `QA-*`），存在语义重叠，下表已**去重合并**并给出映射，避免"把两个根因合成一个"。

### 🔴 Blocker（5，去重后）

| # | 问题 | 证据 | 归属 | 建议 |
|---|---|---|---|---|
| **BLK-1** | **优惠券入口对所有人不可用**：`POST /checkout/promo` 与 `POST /checkout/summary{code}` 对**已登录用户和匿名**一律 400「请先登录后再使用优惠码」；而同一 token 打 `POST /payments/create{code}` 成功（`amount:178.20`，DB `user_coupon` `unused→used`）。**根因**：`SpringMvcConfig.java:30-31` 把这两条路径放进 `excludePathPatterns` → 拦截器不执行 → `CurrentUserThreadLocal` 为空 → `StorefrontCheckoutController.java:165-168` 的 `currentUserId()` 恒 null → `CouponServiceImpl.java:114-115` 抛 400。**白名单是全有或全无，没有"可选鉴权"这一档** | qa（QA-B1）+ **Lead 亲自复现并给出决定性对照实验（Z-3/Z-4/Z-5）** | backend | 为白名单路径引入"可选鉴权"，或移出白名单。修完必须让"登录用户可用券、匿名被明确拒绝"两种情况都能通过 |
| **BLK-2** | `/checkout/promo` 语义变更（改为必须登录 + 必须已领券 + 删掉 SAVE10/VIP15 硬编码回退）**未同步既有测试** → `StorefrontPromoTest` **10F+1E** | A 实测；测试文件未被本批改动 | backend + qa | 改测试（不是回退代码）。**⚠️ 与 BLK-1 是两个根因**，见 §五裁决 |
| **BLK-3** | 「商品参数不合法」由 409 改成 400，未同步 `RequestShapeTest.java:78-80`（断言 409）→ **1 条红**；`CheckoutSummaryDTO.java:14-15` javadoc 仍写"均为 409" | A 实测 | backend | 二选一定口径后同步测试与注释 |
| **BLK-4** | **优惠码/积分显示额 < 实际扣款**：本批新增了 `code` 通道，但**没有任何客户端发送它**（`checkout.ts:64` 只发 `{items,zip}`；`usePaymentFlow.ts:126-141` payload 无 `code`），而后端只在收到 code 时才折扣 → 用券时页面金额低于实扣 | 审查（REV-B3） | frontend | 前端补 `code` 透传（约 3 文件 15 行） |
| **BLK-5** | **购物车页金额低于实扣 4.48**：真实购物车 `5×99+1×199=694.00`，`Cart.vue` 自算税 55.52 + 前端满减 60 得 **689.52**；而 `/checkout/summary`→694.00、`/payments/create`→694.00、`payment.amount`→694.00、`Σ total_money`→694.00。**Lead 静态复核**：`Cart.vue:21-22,31-36,60` 仍保留 `SHIPPING_FEE=12`/`TAX_RATE=0.08`/满减档并计入总额，而 `Checkout.vue` **已全部移除**（grep 零命中）⇒ 按代码复算 `694+55.52−60=689.52`，与实测逐分吻合 | qa（QA-B2）+ **Lead 复核** | frontend | Cart 改走 `/checkout/summary`，不要再自算 |

### 🟠 Major

| # | 问题 | 证据 | 归属 |
|---|---|---|---|
| **MAJ-1** | **营收环比恒 0 或负**：`AnalyticsMapper.xml:13-21` 的 `paidOrderFilter` **只有下界 `create_time >= since`、无上界** → `previousStart` 窗口是 `recentStart` 的超集（`AnalyticsServiceImpl.java:74-84`）。**Lead 独立复现**：同一响应里 Total Revenue `$248.00` 却 `change="+0.0%"`，而相邻的 Sales 指标（做了减法修正）正常给出 `+100%` —— 同响应内自相矛盾 | qa（QA-B3）+ **Lead 复核 Z-2** | backend |
| **MAJ-2** | **转化率恒 100%**：`AnalyticsServiceImpl.java:158` `int allRecent = ordersRecent;` 使 `ratio(ordersRecent, allRecent)` 恒为 1.0（代码注释自己写了"近似"） | 审查（Major）+ **Lead 复核** | backend |
| **MAJ-3** | **5 处「200 假成功」**（写操作返 200 但无任何效果）：`PUT /merchant/settings`、`PUT /admin/settings`、`POST /merchant/wallet/withdraw`（**提现被静默吞掉，资损语义最重**）、`POST /account/notifications`（前端字段形状与后端不匹配）、`PUT /addresses/2/default` | qa（QA-B4/5/6/9） | backend |
| **MAJ-4** | **反向 schema 漂移**：`src/test/resources/schema-h2.sql` **已含** V6~V11 的表/列/索引，而真实 MySQL 库只有 23 表 ⇒ **测试库比真实库更完整；`mvn test` 绿 ≠ 真实库就绪**（本轮 `mvn test` 的失败也因此与真实链路失败**不是同一环境**） | env-verifier（A2）+ 审查 | qa / database |
| **MAJ-5** | **孤儿 schema**：V6~V11 新增 **18 个对象（4 表 + 6 列 + 8 索引）在 Java 与 mapper 层引用数一律为 0**，全仓仅 2 处注释提及 ⇒ 应用迁移**不会让任何端点变真实** | A2 + 审查 + **Lead 独立 grep** 三方一致 | 下一轮计划 |
| **MAJ-6** | **entrypoint 批次标记短路**：`docker/entrypoint.sh:105` 的 `.schema-imported`（Sep 27，早于 V6~V11）短路整个导入块 ⇒ **已有卷永久漏迁移且 restart 不自愈**（全新 clone 不受影响，入口实为 glob） | A2 | devops |
| **MAJ-7** | **文档反向漂移**（比缺文档更危险，因为写的是反话）：`docs/backend-api.md:104/105/326` 仍写"兜底 SAVE10/VIP15""重算运费/税/满减"（均已删除）；`docs/STARTUP.md:78/198` 仍写"V1…V5，共 23 张表"；`AdminApiController.java:387/393-396`、`backend-api.md:147/148/327/334` 共 6 处"库中尚无该列"表述 | 审查 + A2 | backend + docs |

> 审查报告另列 11 Major / 12 Minor，其中与上表不重复的部分（如 `AdminHome.vue` 空态不可达、`AuthzRegistrationGateTest` 依赖容器枚举）详见 [07-CODE-REVIEW.md](07-CODE-REVIEW.md) §3。

### 🟡 Minor / Info

| # | 问题 | 证据 |
|---|---|---|
| MIN-1 | `GET /products/999999` 返回 **200 + `data:null`**（应为 404） | qa（QA-B7）+ **Lead 复现 Z-8** |
| MIN-2 | `docs/backend-api.md` 未登记工作树新增的 `/products/{id}/related`、`/bought-together`、`/complete-the-look`（实测均 200） | 审查 + qa |
| MIN-3 | `/orders` 映射层把运费/税/折扣写死 0；`GET /account/profile` 与 `POST /addresses` 响应字段集与前端 TS 接口不一致 | qa（QA-B11/B13） |
| MIN-4 | 未编码的 `?q=耳机` → Tomcat 返回 **HTML 400**，破坏统一 JSON 错误契约（编码后 200 且过滤真实生效） | qa（QA-B10） |
| MIN-5 | `web/package.json` 无 `build` 脚本（实为 `build-prod`）；宿主无 bash，Windows 侧 `dev.sh`/`start.sh` 不可执行 | A |
| MIN-6 | 登录响应把 JWT 放在 `data`（字符串）而非 `token` 字段；`facets` 是 `POST /search` 响应字段而非独立端点 | A2 |
| MIN-7 | 本轮验收残留测试数据：2 个测试用户、1 个探针商品（id=4）、17 笔订单；DB 用户 5 / 商品 4 / 订单 17 行 / `sum(total_money)=5644.20` | qa 附录 B + **Lead Z-10** |

---

## 五、Lead 的两项裁决（agent 之间存在分歧/重叠处）

### 裁决 1：本轮**不应用** V6~V11 迁移

依据：① **双向零消费者**（审查核实 Java 侧，Lead 独立 grep `src/main/resources`，唯一命中 `ShopMapper.xml:28` 的 `shop.status` 属基础 schema）；② 迁移不可重复执行（1060/1061）+ `AFTER` 列序未在真实库验证 ⇒ 有**部分应用**风险；③ 应用会让 6 处"库中尚无该列"表述变假话 ⇒ 制造新漂移，而本轮禁改代码；④ 用户范围＝只做跑通与验收，§十二 要求 DB 变更先评估必要性。**零收益 + 有风险 + 制造漂移 ⇒ 不做**，转为问题清单 MAJ-5/MAJ-6/MAJ-7，留待修 Blocker 的那一轮同批处理（含前置条件清单，见 [08b-RUNTIME-STATE.md](08b-RUNTIME-STATE.md) §5.4）。

### 裁决 2：BLK-1 与 BLK-2 **是两个根因，不得合并**

两者症状字符串相同（"请先登录后再使用优惠码"），但触发条件与修法都不同：

| | 根因 | 触发条件 | 修法 |
|---|---|---|---|
| **BLK-2** | 测试契约未同步（本批把"匿名可用、返 0.00"改成"必须登录"，但 `StorefrontPromoTest` 仍按匿名契约写） | **仅匿名**请求（H2/MockMvc 环境，无 token） | 改测试 |
| **BLK-1** | 设计自相矛盾：白名单路径永不进入拦截器 ⇒ 守卫永远无法被满足 | **匿名与已登录都失败**（真实链路） | 引入可选鉴权或移出白名单 |

**证据**：Lead 的 Z-4 对照实验——同一个有效 user1 token 打非白名单端点 `/addresses` 返回 **200 + 真实数据**，打 `/checkout/promo` 返回 **400**；Z-5 匿名同样 400。⇒ 不是 token 失效，而是白名单跳过拦截器。

**为什么不能合并**：只修 BLK-2（改测试）后功能**依然不可用**；只修 BLK-1（移出白名单）后匿名请求会变成 401，而测试仍期望 200/0.00，**测试仍红**。两个都必修，且必须分开记账。

---

## 六、未覆盖项与限制（不得当成已验）

| 项 | 状态 |
|---|---|
| 评价子系统（`product_order_evaluate` 0 行） | 无法判定 |
| 浏览器层 FE-01..21 用例 | 未执行，已用等价 HTTP + DB 取证替代 |
| 401 后清会话跳转 | 仅静态确认 |
| 30min 未支付超时取消的正路径 | 因授权边界未取端到端证据 |
| `product.sales_volume` 期间变化（10→20 等）的原因 | 未定位 |
| 5 条未定性项（如 `PUT /admin/reviews/1` 对不存在 id 返 200） | qa 报告 §10 / QA-B16 已列 |
| HEAD 基线对照（未跑 stash/worktree 基线） | 未做；12 条红的归因是"测试文件未改 + 新代码新增守卫"的强证据组合，非基线实测 |

---

## 七、下一阶段范围建议（请用户裁决）

| 选项 | 内容 | 代价 | 建议 |
|---|---|---|---|
| **A. 修到可验收（推荐）** | 修 5 个 Blocker + 12 条红测试 + 把 5 处"200 假成功"按统一规则改为 4xx/501 + 修文档反向漂移 ⇒ 目标：`mvn test` 全绿、券链路可用、金额三方一致 | 一个工作单元级别（Blocker 修复量都很小：B-1 加可选鉴权、B-4 补 code、B-5 改走 summary、B-2/B-3 改测试） | ⭐ 推荐：审查已确认**无文件需整体回退**，多数改动质量很高（券四重校验、乐观锁、按行分摊、订单状态机、entrypoint 修复），只差收口 |
| **B. 先收口资损** | 只修 BLK-1/BLK-4/BLK-5 + 提现静默吞掉（MAJ-3），让"金额可信" | 更小；但测试闸门仍红、后台假数据仍在 | 若时间紧可选 |
| **C. 回退这批未提交改动** | 回到 HEAD `f4df6ac` | 会丢失大量正确修复，且迁移/entrypoint 修复也会一起丢 | ❌ 不推荐 |

**另外建议（无论选哪个）**：修完后**必须提交一次 git**——当前 56 个文件 + 45 个未跟踪条目长期悬在工作树，是"运行态与代码不一致"这类问题反复出现的根源；并顺带清理本轮验收残留数据（MIN-7）。

---

## 八、产物索引

| 文件 | 内容 |
|---|---|
| [00-AGENT-REGISTRY.md](00-AGENT-REGISTRY.md) | 编制表、依赖图、容器锁协议、调度日志（含被证伪项的修正） |
| [06a-TEST-PLAN.md](06a-TEST-PLAN.md) | 验收矩阵（470 行）：买家 68 例 / 后台 47 例 / 授权 22 格 / 边界 16 例 |
| [06-TEST-REPORT.md](06-TEST-REPORT.md) | 真实链路结果（632 行）：181 个用例点、282 份原始报文、缺陷清单、端点总表 |
| [07-CODE-REVIEW.md](07-CODE-REVIEW.md) | 审查结论：`conditional`、4 Blocker / 11 Major / 12 Minor、逐文件处置表 |
| [08-ENVIRONMENT.md](08-ENVIRONMENT.md) | 环境矩阵、构建与测试原始输出、运行态过期判定、迁移缺口 |
| [08b-RUNTIME-STATE.md](08b-RUNTIME-STATE.md) | 重启与就绪证据、行为级现行性取证、孤儿 schema 对照表、迁移裁决 |
| [_z-evidence/z-final-verify.sh](_z-evidence/z-final-verify.sh) | Lead 独立终验脚本（可复跑，10 项检查） |
| [_b-evidence/](_b-evidence/) | qa 的 18 个取证脚本 |
