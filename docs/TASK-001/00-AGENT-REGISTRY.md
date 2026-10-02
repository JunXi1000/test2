# TASK-001 编制表与调度日志（总控 Agent）

> 依据 `Agent-System-Prompt.txt` §26.1 / §26.4 / §26.30 建立。
> 上一轮 TASK-000（见 [00-AGENT-REGISTRY.md](../TASK-000/00-AGENT-REGISTRY.md)）完成 Phase 1/2 与 Phase 3 部分实现，本轮**不重做规划**，只做「跑通 + 验收 + 审查」。

## 一、本轮范围（用户已裁决）

| 决策点 | 用户选择 | 对本轮的影响 |
|---|---|---|
| 目标范围 | **先只做「跑通与验收」**：构建 + 启动 + 端到端验收，产出问题清单后再决定 | 不新增业务功能；不推进 Phase 5 |
| 未提交改动 | **先审查，确认没问题再继续** | 审查结论是"能否原地保留基线"的前提，构成 A2 的阻断依赖 |

交付物：带原始证据的**问题清单** + 可验收结论 + 下一阶段范围建议。

## 二、Lead 侦察结论（开工前的既成事实）

| # | 事实 | 证据 | 影响 |
|---|---|---|---|
| F1 | 服务**已在运行**：容器 `nexus-dev` Up 5h，1000/5173/3306 均已发布 | `docker ps` | 本轮不是"起不来"，而是"跑的对不对" |
| F2 | 后端 `/` 返回 **401** = 就绪判据成立；前端 5173 返回 **200** | HTTP 探测 + `STARTUP.md` §3 | 就绪判据是"收到真实 HTTP 响应"，非 TCP 可连 |
| F3 | 线上库 `template_v3` **仅 23 张表**（Phase 1 基线），无 `wallet`/`platform_setting`/`merchant_setting` 等 | `information_schema` 查询 | 工作树 Phase 3 后端代码所依赖的表不存在 |
| F4 | `sql/migrations/V6~V11` 存在但**未被 git 跟踪、未应用** | `git status` + 库表清单 | Phase 3 运行期会 500/表不存在 |
| F5 | 后端 JVM 已运行 5h18m（≈15:31 启动），`src/main/java` 最近改动 20:13–20:15 | `ps -o etime` vs 文件 mtime | **运行态 ≠ 当前工作树代码**（过期运行态） |
| ~~F6~~ | ~~`STARTUP.md` 称 entrypoint 只导入 `V1…V5`~~ → **已被 env-verifier 证伪并修正** | entrypoint `:146-148` 实为 glob `sql/migrations/*.sql` | **全新卷不会漏 V6~V11**；真因是批次标记 `.schema-imported`（`:105`，Sep 27 18:21，早于 V6~V11）短路整个导入块 ⇒ **仅"已有卷"永久漏且 restart 不自愈**。性质由"功能缺口"降级为**文档漂移 + 运维缺陷** |

## 三、团队编制（本轮 3 名专业 Agent）

| Agent | role | 本轮任务 | write_scope | 关键禁止 |
|---|---|---|---|---|
| `code-reviewer` | `code_reviewer` | TASK-001-C（task-1）未提交改动审查 | `docs/TASK-001/07-*` | **只读**，绝不改代码；不进容器 |
| `env-verifier` | `devops_engineer` | TASK-001-A（task-2）环境/构建/启动；TASK-001-A2（task-4）迁移+重启复验 | `docs/TASK-001/08-*`、`08b-*` | 不改业务代码；改 `docker/` 须 Lead 批准 |
| `qa-acceptance` | `qa_engineer` | TASK-001-B0（task-3）验收方案；TASK-001-B（task-5）真实链路验收 | `docs/TASK-001/06*` | **只报 Bug 不修 Bug**；新增 e2e 须 Lead 批准 |
| （Lead） | `orchestrator` | TASK-001-Z（task-6）汇聚 + 独立终验 + 交付 | `docs/TASK-001/00-*`、`REPORT.md` | 不亲自写业务实现 |

未启用：product-analyst、architect、database、backend、frontend、reviewer(已由 code-reviewer 承担)。
理由（§26.26 避免过度调度）：本轮无新需求、无架构变更、无新端点，规划层无可交付物；数据库 Agent 的职责被收窄为"应用既有迁移"，已在 A2 内以受限写范围表达。

## 四、依赖图与任务板

```
        ┌─────────────────────┐        ┌─────────────────────┐
        │ TASK-001-C (task-1) │        │ TASK-001-A (task-2) │
        │ 未提交改动审查       │        │ 环境/构建/启动验证   │
        │ code-reviewer       │        │ env-verifier        │
        └──────────┬──────────┘        └──────────┬──────────┘
                   │                              │
                   └───────────┬──────────────────┘
                               ▼
                   ┌───────────────────────┐
                   │ TASK-001-A2 (task-4)  │  ← 迁移 V6~V11 + 重启 + 复验
                   │ env-verifier          │     锁回 Lead → 移交 qa
                   └───────────┬───────────┘
                               ▼
                   ┌───────────────────────┐
                   │ TASK-001-B (task-5)   │  ← 真实后端端到端验收
                   │ qa-acceptance         │
                   └───────────┬───────────┘
                               ▼
                   ┌───────────────────────┐
                   │ TASK-001-Z (task-6)   │  ← Lead 汇聚 + 独立终验 + 交付
                   └───────────────────────┘

并行无依赖支线：TASK-001-B0 (task-3) 验收方案 —— qa 立即开工，不阻塞任何人
```

## 五、共享资源与冲突控制（§26.22 文件锁机制的等效实现）

本轮的真正共享资源不是文件，而是**容器 `nexus-dev`**（唯一 JDK/Maven/Node/MySQL 所在）：

| 资源 | 独占者 | 移交规则 |
|---|---|---|
| 容器（构建 / 重启 / DB / Playwright） | env-verifier（A → A2 全程） | A2 完成 → 锁回 Lead → Lead 移交 qa-acceptance（B）→ 完成后交回 Lead 终验 |
| `docs/TASK-001/07-*` | code-reviewer | 独占 |
| `docs/TASK-001/06*` | qa-acceptance | 独占 |
| `docs/TASK-001/08-*`、`08b-*` | env-verifier | 独占 |
| `docs/TASK-001/00-*`、`REPORT.md` | Lead | 独占 |

> 文件名前缀隔离 + 容器锁串行化，等价于 §26.22 的"总控必须避免两个 Agent 同时修改同一资源"。

## 六、已裁决的依赖争议

| 争议 | 裁决 | 依据 |
|---|---|---|
| 审查（C）是否应阻塞迁移（A2） | **应阻塞** | 若审查判定该基线不可保留，应用迁移就是把半成品固化进库；`blocked_by: [task-2, task-1]` |
| 环境验证（A）是否可与审查（C）并行 | **可并行** | A 只读环境/构建，C 只读代码，无资源交集 |
| qa 是否应等环境就绪才开工 | **部分解除** | B0（方案/矩阵）与契约无关，立即开工；B 保持阻塞，避免在未迁移的库上产出伪缺陷 |
| 是否让 env-verifier 直接"修好" docker/entrypoint 的迁移缺口（F6） | **不修，先报** | 本轮范围是"验收"，写入是范围外工作；F6 进问题清单交用户决策 |

## 七、调度日志（§26.30）

| 时间 | 事项 | 处置 |
|---|---|---|
| 本轮第 1 步 | 用户要求按 `Agent-System-Prompt.txt` 组建团队完成网站搭建 | 先读全文（2164 行）+ 勘察工作区，未立即派活 |
| 第 2 步 | 发现 TASK-000 已存在、且工作树有 56 个未提交 Phase 3 改动 | 向用户澄清**两个真正影响排期的选择**（范围 / 未提交改动去留） |
| 第 3 步 | 用户裁决：只做跑通与验收 + 先审查改动 | 据此收窄编制，砍掉规划层与开发层 Agent（§26.26） |
| 第 4 步 | Lead 侦察出 F3/F5/F6 三项硬事实 | 写入任务描述，作为 A/A2/B 的验收输入 |
| 第 5 步 | 建立 6 个共享任务（task-1~6）与依赖图 | 先建任务后派人（任务先于负责人存在） |
| 第 6 步 | 组建 3 名成员并派发首个任务 | 并行支线 B0 立即开工，避免空转 |

### 第 7~10 步：结果验证与两次裁决（§26.14 / §26.11）

| 轮次 | 事项 | Lead 核验与处置 |
|---|---|---|
| 第 7 步 | qa 交回 B0（470 行方案 + 10 条静态疑点），并断言"V6~V11 在 Java 侧零引用" | **独立复核成立**：Lead grep `src/main/java` 确认 `platform_setting`/`merchant_setting`/`wallet`/`is_default` 仅存在于注释，无实现。据此预先把"迁移成功 ≠ 功能生效"同步给 env-verifier，避免其把"未实现"记成"迁移失败" |
| 第 8 步 | code-reviewer 交回 `conditional` + 4 Blocker | 采信前先自证：Lead 独立复核两条 Major —— `AnalyticsServiceImpl.java:82-84`（`paidOrderFilter` 只有下界无上界 ⇒ 营收环比恒 0 或负）与 `:158`（`allRecent = ordersRecent` ⇒ 转化率恒 100%）**均属实**；且同文件 `:91/:103` 做了减法、仅营收漏做，自证是遗漏而非设计 |
| 第 9 步 | **裁决 1：A2 不应用 V6~V11** | 依据：① 双向零消费者（Java 侧 code-reviewer 核实，SQL 侧 Lead 独立 grep，唯一命中 `ShopMapper.xml:28` 的 `shop.status` 属基础 schema）；② 迁移不可重复执行（1060/1061）+ U-14 有部分应用风险；③ 应用会让 6 处"库中无该列"表述变假话 ⇒ 制造新漂移，而本轮禁改代码；④ 用户范围＝只做跑通与验收，§十二 要求先评估必要性。**零收益 + 有风险 + 制造漂移 ⇒ 不做**，缺口转为问题清单条目 |
| 第 9 步 | 任务书改写而非口头通知 | 用 `team_task_update` 把裁决与依据写进 task-4（revision 2）并要求重读后再 claim，避免"先斩后奏"式写库 |
| 第 10 步 | env-verifier 交回 A2 | **A2 通过**：行为级（非 mtime 推断）证明运行态＝当前工作树代码——7 个差异端点返回与真实 DB 逐项吻合的动态聚合（`Active Users="3"`、trending 按 `sales_volume DESC` 顺序内容全吻合、分类计数 2/1），硬编码常量不可能产出这些值。附带修正 Lead 的 U-14 风险判断（`AFTER` 锚点列已静态排雷） |
| 第 10 步 | **裁决 2：B 阶段预算重排** | A 已获得 `mvn test` 171/11F/1E 与前端全绿，且跑 `mvn clean test` **必须先 pkill 后端**会毁掉 E2E 环境 ⇒ 指令 qa **不重复**跑 mvn/vue-tsc，Playwright 降为最低优先级（mock 模式对 B-3/B-4 零感知），预算集中到"真实 HTTP + DB 交叉验证" |
| 第 10 步 | 归属裁决（qa 提问） | 按 `git diff` 事实三层归因，而非观点：`usePaymentFlow.ts` 不在本批内（HEAD 即存在未改）⇒ B-3 属"本批契约先行、前端待接（未完成项，非回归）"；`Cart.vue` 在本批内且漏改 ⇒ B-4 属"本次引入" |

### 已获取的硬实证（截至第 10 步）

| 证据 | 结果 | 来源 |
|---|---|---|
| 后端测试闸门 | `mvn -B clean test` = **171 run / 11 failures / 1 error**（rc=1） | A（env-verifier） |
| 前端闸门 | `vue-tsc`(src/test) 各 0 错误；`build-prod` rc=0 | A |
| 12 条红测试归因 | 由本批新登录守卫（`CouponServiceImpl:114-116`）与 400/409 变更（`StorefrontCheckoutController:84`）触发，**与迁移/重启无关** | A + C 互证 |
| 运行态现行性 | 行为级确认＝当前工作树代码 | A2 |
| 孤儿 schema | V6~V11 新增 18 对象（4 表 + 6 列 + 8 索引），**实现引用数全 0** | A2 + C + Lead 三方一致 |
| 反向 schema 漂移 | `schema-h2.sql` **比真实 MySQL 库更完整** ⇒ `mvn test` 绿 ≠ 真实库就绪 | A2 |
| 审查结论 | `conditional`：4 Blocker / 11 Major / 12 Minor，**无文件需整体回退** | C |

## 八、运行产物索引

| 文件 | 负责人 | 内容 |
|---|---|---|
| `00-AGENT-REGISTRY.md` | Lead | 本文件 |
| `06a-TEST-PLAN.md` | qa-acceptance | 验收矩阵与用例（B0） |
| `06-TEST-REPORT.md` | qa-acceptance | 真实链路结果与缺陷清单（B） |
| `07-CODE-REVIEW.md` | code-reviewer | 未提交改动审查结论与 must_fix（C） |
| `08-ENVIRONMENT.md` | env-verifier | 环境/构建/启动证据与过期判定（A） |
| `08b-MIGRATION-APPLY.md` | env-verifier | V6~V11 应用、重启与复验（A2） |
| `REPORT.md` | Lead | 汇聚结论、问题清单、下一阶段建议（Z） |
