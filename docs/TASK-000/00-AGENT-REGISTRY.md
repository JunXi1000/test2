# Agent 注册表（TASK-000 编制）

> 依据 `Agent-System-Prompt.txt` §26.1 建立。这是本轮网站搭建的**团队编制表**。
> 总控 Agent 是唯一调度入口；专业 Agent 之间不直接通信，一律经总控中转（§26.12）。

## 一、团队层级

```
                    USER（用户）
                          │
                          ▼
                  ┌───────────────┐
                  │  ORCHESTRATOR │  总控 Agent（Lead）
                  │   调度/审查   │  唯一拥有任务调度权
                  └───────┬───────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ Planning   │  │ Execution  │  │  Quality   │
   │  规划层    │  │   执行层   │  │   质量层   │
   └────────────┘  └────────────┘  └────────────┘
     产品分析        数据库 / 后端 / 前端    测试 / 审查 / DevOps
     系统架构
```

共 **8 个专业 Agent**，按项目实际动态启用（§三「团队成员」）。

---

## 二、Agent 注册表

### 1. product-analyst（产品分析 Agent）

| 项 | 内容 |
|---|---|
| role | `product_analyst` |
| capabilities | 需求分析、功能拆解、用户流程、User Story、验收标准、需求边界、冲突识别 |
| input | `task` `requirements` `project_docs` `code_evidence` |
| output | `requirements_audit` `batch_plan` `user_stories` `acceptance_criteria` |
| write_scope | `docs/TASK-000/01-*` |
| can_parallel | ✅ 与数据库、DevOps 并行 |
| 禁止 | 修改任何业务代码（只读 + 出文档） |
| 当前任务 | **TASK-000-A**（task-1） |

### 2. architect（系统架构 Agent）

| 项 | 内容 |
|---|---|
| role | `system_architect` |
| capabilities | 架构设计、模块划分、技术选型、前后端边界、API 设计、数据流、权限体系、依赖分析 |
| input | `task` `requirements_audit` `existing_architecture` |
| output | `module_ownership_map` `dependency_graph` `api_contracts` `db_change_assessment` `risk_list` |
| write_scope | `docs/TASK-000/02-*` |
| can_parallel | ✅ 与产品分析串行后，可与其余执行层并行 |
| 禁止 | 随意修改业务代码；**擅自更换技术栈**（须提交用户确认） |
| 当前任务 | **TASK-000-B**（task-2） |

### 3. database（数据库 Agent）

| 项 | 内容 |
|---|---|
| role | `database_engineer` |
| capabilities | 表结构、ER 模型、索引设计、SQL、数据迁移、数据一致性、查询性能、H2/MySQL 差异 |
| input | `task` `db_change_assessment` `priority_directives` |
| output | `tables` `migrations` `rollback_scripts` `h2_schema_sync` |
| write_scope | `sql/`、`src/test/resources/schema-h2.sql` |
| can_parallel | ✅ |
| 禁止 | 未经批准修改核心业务数据结构；改 Java / Vue 代码 |
| 关键约束 | **破坏性变更（删表/删列/改类型/改主键）必须上报总控** |
| 当前任务 | **TASK-000-C**（task-3） |

### 4. backend（后端开发 Agent）

| 项 | 内容 |
|---|---|
| role | `backend_developer` |
| capabilities | Controller / Service / Mapper、业务逻辑、权限控制、参数校验、异常处理、日志、缓存 |
| input | `task` `api_contracts` `architecture` |
| output | `implementation` `changed_files` `endpoints` `authz_rules` |
| write_scope | `src/main/java`、`src/main/resources`、`docs/backend-api.md` |
| can_parallel | ⚠️ 与 frontend 串行（契约先行）；与 database 按 schema 依赖分段 |
| 禁止 | 改 Vue 代码；改 SQL schema；擅自改 API 契约 |
| 关键约束 | 新端点必须在 `AuthzRules` 登记，否则默认拒绝 403；金额一律服务端按 DB 价格计算 |
| 当前任务 | **TASK-000-D1**（task-4，进行中）→ **TASK-000-D2**（task-9） |

### 5. frontend（前端开发 Agent）

| 项 | 内容 |
|---|---|
| role | `frontend_developer` |
| capabilities | Vue 3 / TypeScript / Pinia / Vue Router / Element Plus / Tailwind / axios、响应式、组件抽象、状态管理 |
| input | `task` `api_contracts` `frontend_map` |
| output | `pages` `api_modules` `components` `type_check_result` |
| write_scope | `web/src/` |
| can_parallel | ⚠️ 契约未定前只能做与契约无关的工作（四态组件、扫描、基线） |
| 禁止 | 改 Java / SQL；擅自改 API 契约；页面直接写 axios |
| 关键约束 | 统一走 `src/api/http.ts`；`vue-tsc` 零新增错误；<768px 无横向滚动 |
| 当前任务 | **TASK-000-E1**（task-5）→ **TASK-000-E2**（task-10） |

### 6. qa（测试 Agent）

| 项 | 内容 |
|---|---|
| role | `qa_engineer` |
| capabilities | 单元测试、集成测试、API 测试、E2E、回归测试、边界条件、异常场景、幂等与并发 |
| input | `task` `acceptance_criteria` `baseline` |
| output | `test_results` `defect_reports` `coverage_gaps` |
| write_scope | `src/test/`、`web/tests/` |
| can_parallel | ✅ 基线阶段可与开发并行；完整测试须在实现落地后 |
| 禁止 | 修改 `src/main/java`、`web/src`（**只报 Bug，不修 Bug**） |
| 缺陷格式 | Bug / 复现步骤 / 预期行为 / 实际行为 / 影响范围 / 可能原因 / 修复建议 / 归属 / 级别 / 证据 |
| 当前任务 | **TASK-000-F1**（task-6）→ **TASK-000-F2**（task-11） |

### 7. reviewer（Code Review Agent）

| 项 | 内容 |
|---|---|
| role | `code_reviewer` |
| capabilities | 代码质量、架构一致性、安全、性能、可维护性、重复代码、类型安全、API 契约一致性、潜在 Bug |
| input | `task` `changed_files` `architecture` `api_contracts` |
| output | `verdict` `issues` `must_fix_list` |
| write_scope | `docs/TASK-000/07-*` |
| can_parallel | ❌ Review Gate，必须在开发完成后串行 |
| 禁止 | **只发现问题，绝不修改代码**（§26.15 Review Gate） |
| 严重级别 | `Blocker` / `Major` / `Minor` |
| 当前任务 | **TASK-000-G**（task-7，blockedBy task-4） |

### 8. devops（DevOps Agent）

| 项 | 内容 |
|---|---|
| role | `devops_engineer` |
| capabilities | 构建、环境配置、Docker、CI/CD、部署、日志、监控、环境变量、生产排障 |
| input | `task` `startup_docs` |
| output | `environment_report` `build_result` `running_services` `smoke_test_result` |
| write_scope | `docker/`、`start.bat`、`dev.bat` |
| can_parallel | ✅ 全程可并行，不阻塞任何人 |
| 禁止 | 修改业务代码 |
| 关键判定 | 服务"已启动" = **收到真实 HTTP 响应**，不是端口能连上 |
| 当前任务 | **TASK-000-H**（task-8，进行中） |

---

## 三、任务依赖图

原始粒度按「Agent」划分过粗，导致有实质工作的 Agent 被无谓阻塞。已重构为**两段式管线**——按数据依赖切分，而非按 Agent 切分。

```
TASK-000-A 需求盘点 ──→ TASK-000-B 架构评估
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
  TASK-000-C            TASK-000-D1            TASK-000-H
  数据库/迁移            后端聚合实现            环境与部署
       │                      │                   （全程并行）
       ▼                      ▼
  TASK-000-D2            TASK-000-E1
  钱包/设置持久化         四态能力+假数据扫描
       │                      │
       └──────────┬───────────┘
                  ▼
          TASK-000-E2  真实接口对接
                  │
                  ▼
      ┌───────────┴───────────┐
      ▼                       ▼
 TASK-000-F2            TASK-000-G
 完整测试与缺陷报告       Review Gate
```

### 依赖矩阵

| 任务 | 阻塞于 | 状态 |
|---|---|---|
| TASK-000-A 需求盘点 | — | 🔄 进行中 |
| TASK-000-B 架构评估 | TASK-000-A | ⏳ 等待（可先做一版） |
| TASK-000-C 数据库 | — | 🔄 进行中 |
| TASK-000-D1 后端聚合 | — | 🔄 进行中 |
| TASK-000-D2 钱包/设置 | TASK-000-C | ⏸ 阻塞 |
| TASK-000-E1 前端准备 | — | ⏳ 待认领 |
| TASK-000-E2 接口对接 | TASK-000-D1 | ⏸ 阻塞 |
| TASK-000-F1 测试基线 | — | ⏳ 待认领 |
| TASK-000-F2 完整测试 | TASK-000-D1 | ⏸ 阻塞 |
| TASK-000-G 代码审查 | TASK-000-D1 | ⏸ 阻塞（Review Gate） |
| TASK-000-H 环境部署 | — | 🔄 进行中 |

### 已裁决的阻塞争议（§26.19 失败分析与 §26.10 并行调用）

| 争议 | 裁决 | 依据 |
|---|---|---|
| 后端是否解除对数据库的依赖 | **部分解除**：拆为 D1（无依赖，立即开工）+ D2（依赖 schema） | 6 项聚合只读既有表，与 schema 无数据依赖 |
| 前端是否解除对后端的依赖 | **部分解除**：E1 保留（四态/扫描/基线与契约无关），E2 保持阻塞 | 契约未定时写对接代码等于凭空发明签名 |
| 数据库是否解除对架构的依赖 | **解除** | 勘察证明 23 张表表级无缺口，新增表由优先级直接驱动 |
| 测试是否解除对实现的依赖 | **部分解除**：F1 基线必须在改动落地**前**完成 | 否则无法区分存量失败与本次引入 |

---

## 四、权限边界（§26.21 最小权限）

| Agent | READ | WRITE |
|---|---|---|
| product-analyst | 全项目（只读） | `docs/TASK-000/01-*` |
| architect | 全项目（只读） | `docs/TASK-000/02-*` |
| database | `sql/`、`src/test/resources/` | `sql/`、`schema-h2.sql` |
| backend | `src/main/`、`docs/backend-api.md` | `src/main/java`、`src/main/resources`、`docs/backend-api.md` |
| frontend | `web/src`、`docs/backend-api.md` | `web/src` |
| qa | **全项目** | `src/test`、`web/tests` |
| reviewer | **全项目**（只读） | `docs/TASK-000/07-*` |
| devops | 全项目（只读）、`docker/` | `docker/`、`start.bat`、`dev.bat` |

> **写范围重叠提示**：多个 Agent 的 `docs/TASK-000` 前缀会重叠，但各自只写自己编号的文件，由**文件名前缀隔离**保证不冲突。若发生越界写入，总控负责纠正。

---

## 五、共享文件的冲突控制（§26.22 文件锁机制）

以下文件会被多个 Agent 触碰，需按顺序处理：

| 文件 | 触碰者 | 控制方式 |
|---|---|---|
| `docs/backend-api.md` | backend | backend 独占；frontend/qa **只读** |
| `config/AuthzRules.java` | backend | backend 独占（新增端点登记） |
| `sql/schema.sql`、`schema-h2.sql` | database | database 独占 |
| `web/src/api/modules/*.ts` | frontend | frontend 独占 |
| `docs/TASK-000/*` | 全部 | 文件名前缀隔离（01~08 各自负责） |

---

## 六、Review Gate 与 Test Gate（§26.15 / §26.16）

```
开发 Agent 完成
       ↓
Code Review Agent 审查  ← 只出报告，不改代码
       ↓
   通过？
  ┌────┴────┐
  是         否
  ↓          ↓
Testing    创建修复任务 → 对应开发 Agent
  ↓          ↓
失败？    重新测试
  ┌────┴────┐
  是         否
  ↓          ↓
创建修复    完成
任务循环
```

---

## 七、运行产物索引

| 文件 | 负责人 | 内容 |
|---|---|---|
| `00-AGENT-REGISTRY.md` | 总控 | 本文件 |
| `01-REQUIREMENTS-AUDIT.md` | product-analyst | 缺口清单、假数据端点清单、批次划分、验收标准 |
| `02-ARCHITECTURE.md` | architect | 模块归属、依赖图、API 契约、风险清单 |
| `03-DATABASE.md` | database | 表结构、索引、迁移、H2 同步 |
| `04-BACKEND.md` | backend | 后端实现说明 |
| `04b-SCHEMA-REQUIREMENTS.md` | backend | 后端侧 schema 校准需求 |
| `05-FRONTEND.md` | frontend | 前端实现说明 |
| `05-FRONTEND-MAP.md` | frontend | 页面 → 接口映射（后端缺口输入） |
| `06a-TEST-PLAN.md` | qa | 测试基线与方案 |
| `06-TEST-REPORT.md` | qa | 测试结果与缺陷报告 |
| `07-CODE-REVIEW.md` | reviewer | 审查结论 |
| `08-DEVOPS.md` | devops | 环境、构建、部署、冒烟验证 |
| `09-TEST-INFRA.md` | devops | 测试基础设施修复 |

---

## 八、调度日志（§26.30 Agent Execution Trace）

### 第一轮：组建与需求澄清

| 事项 | 处置 |
|---|---|
| 用户提出「先搭建要执行任务的 Agent」 | 先建编制，未擅自选定业务范围 |

### 第二轮：任务板与依赖图重构

原任务按「Agent」划分过粗 → 有实质工作的 Agent 被无谓阻塞。按**数据依赖**重切为两段式：

| 争议 | 裁决 | 依据 |
|---|---|---|
| 后端是否解除对数据库的依赖 | 部分解除：D1 无依赖立即开工，D2 等 schema | 6 项聚合只读既有表 |
| 前端是否解除对后端的依赖 | 部分解除：E1 与契约无关，E2 保持阻塞 | 契约未定时写对接 = 凭空发明签名 |
| 数据库是否解除对架构的依赖 | 解除 | 23 张表表级无缺口，新增表由优先级直接驱动 |
| 测试是否解除对实现的依赖 | 部分解除：F1 基线必须在改动落地**前**完成 | 否则无法区分存量失败与本次引入 |

### 第三轮：结果验证与纠错（§26.14）

| Agent 报告 | 总控核实结果 | 处置 |
|---|---|---|
| 「2 处 IDOR 越权」 | **误判** —— 归属校验在 Service 层 `ProductOrderServiceImpl.java:75/117-118/197-198/401`，四条路径全覆盖 | 驳回，要求勘误；后续已由 8 条回归用例独立验证无越权 |
| 「product.status 用可空列」 | **Agent 正确** —— `WHERE status='active'` 不匹配 NULL，可空等于给待修缺陷留后门 | 采纳 Agent 的 `NOT NULL DEFAULT` |
| 「amount 用带符号 DECIMAL」 | **Agent 正确** —— 我把 JSON 契约当成了表设计 | 采纳：库内正数 + `direction` 列，出参转符号 |
| 「Mockito 修复恢复了测试网」 | **归因错误** —— 基线日志零 Mockito 命中，真因是 Mapper XML 裸 `<` | 全队纠正；该配置标注为未验证的防御性配置 |

### 第四轮：已验收产出

| 任务 | 负责人 | 结果 |
|---|---|---|
| TASK-000-A 需求盘点 | product-analyst | ✅ 23 条假数据基线、8 处静默过滤器、13 条 US / 59 条 AC、9 处文档漂移 |
| TASK-000-C 数据库 | database | ✅ V6~V10 五迁移、4 表 / 6 列 / 22 索引、零破坏性、H2 实跑验证 |
| TASK-000-D1 后端聚合 | backend | ✅ 17 处假数据 → 真实聚合、8 处静默过滤器修复、状态机前置校验 |
| TASK-000-F1 测试基线 | qa | ✅ 基线 155 全绿 / 0 存量失败；163 复跑全绿；确认无 IDOR |
| TASK-000-H 环境验证 | devops | ✅ 环境核查完成；TASK-000-J 测试基础设施修复 |

### 第五轮：进行中

| 任务 | 负责人 | 状态 |
|---|---|---|
| TASK-000-B 架构评估 | architect | 🔄 进行中 |
| TASK-000-E1 前端准备 | frontend | 🔄 进行中 |
| TASK-000-I 结算诚信 | backend | 🔄 进行中 |
| TASK-000-D2 钱包/设置 | backend | ⏸ 待 D1 收尾 |
| TASK-000-G Review Gate | reviewer | ⏸ 阻塞（待实现落地） |
| TASK-000-E2 接口对接 | frontend | ⏸ 阻塞 |
| TASK-000-F2 完整测试 | qa | ⏸ 阻塞 |