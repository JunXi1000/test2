# TASK-000-F1 · 测试基线与测试方案

> **产出人**:测试 Agent(qa) · **产出时点**:开发改动大量落地**之前**
> **基线锚点**:`git HEAD = f4df6ac`(chore: drop the orphan root package-lock.json)
> **范围**:只读 + 写 `src/test/`。**未修改任何 `src/main/java`、`web/src`、`pom.xml`。**

---

## 0. 给总控的三句话

1. **后端基线是干净的**:155 个 `@Test` / 21 个测试类 / **155 全绿 / 0 存量失败**。与 `DEVELOPMENT.md §5` 记载的数字完全吻合。加入我新增的 AC-02.3 护栏后为 **163 个测试 / 22 个类 / 163 全绿**。
2. **基线必须在独立检出上跑**。共享工作区里 backend / database Agent 正在写 `AnalyticsMapper.xml`,构建读到了半截文件(第 151 行 XML 语法错),一次跑崩 139 个测试。`git archive HEAD` 导出到 TEMP 才是可信的「改动之前的样子」,**已定为 F2 标准做法**。
3. **前端运行时基线 blocked(环境限制,不是测试失败)**。`vue-tsc` 0 error 已由我与 DevOps **双方独立复现为绿**;**运行时绿/红未知,不编数字**。

**F1 收尾状态**:后端测试网已由 TASK-000-J 修复并**复跑验证**(163 全绿,不再需要绕过)。前端运行时结论已收敛,停止本机重试。

---

## 1. 基线数据

### 1.1 后端(`mvn -B clean test`,H2 `MODE=MySQL`,**不需要 MySQL**)

| 指标 | 值 |
|---|---|
| 测试总数 | **155** |
| 测试类 | **21** |
| **通过** | **155** |
| **失败** | **0** |
| 跳过 | 0 |
| 构建 | `BUILD SUCCESS` |
| 耗时 | ~22s |
| 基线锚点 | `f4df6ac` 的 `git archive` 独立检出 |

**TASK-000-J 落地后的复跑**:加入本轮新增的 AC-02.3 护栏后为 **163 个测试 / 22 个类 / 163 全绿 / `BUILD SUCCESS`**,且**不再需要 `-DargLine` 绕过**。测试网已恢复至可依赖状态。

**逐类明细**(全绿):

```
AuthzRulesTest                 6      ErrorModelTest                  19
RequestIdFilterTest            4      MerchantApiControllerTest        8
AddressControllerTest          6      OrderCancelCharacterizationTest 8
AdminApiControllerTest        10      OrderControllerTest              3
AuthControllerTest             6      ProductControllerTest            6
AuthFlowTest                  12      RequestShapeTest                 9
AuthorizationBaselineTest     14      SecurityControllerTest           6
ChatControllerTest            10      ShoppingCartCharacterizationTest 6
                               StorefrontPaymentControllerTest    2
                               StorefrontPromoTest               11
                               OrderCancelConcurrencyTest         2
                               ResetCodeStoreTest                 6
                               TemplateApplicationTests           1
```

### 1.2 前端

| 项 | 状态 | 数值 |
|---|---|---|
| `vue-tsc --noEmit`(主工程) | ✅ 双方独立复现为绿 | **0 error** |
| `vue-tsc --noEmit -p tsconfig.test.json`(含 7 个 e2e spec + `playwright.config.ts`) | ✅ 双方独立复现为绿 | **0 error** |
| Playwright e2e(运行时) | ⛔ **blocked(环境限制)** | 存量 **7 spec / 193 test / 0 skipped** —— **用例已就位,运行时未验证** |
| vitest 单测(运行时) | ⛔ **blocked(环境限制)** | 存量 **13 spec / 184 test** —— **用例已就位,运行时未验证** |

> ⚠️ **「前端类型层健康」≠「前端运行时健康」**。
> 类型层已由测试 Agent 与 DevOps Agent **双方独立复现为绿**;但 193 个 e2e 与 184 个单测的**实际通过率目前未知**。
> 任何后续文档都不得把 typecheck 通过写成测试通过,也不得把「未验证」写成「未通过」—— 后者同样不成立。详见 §2 ENV-2。

e2e 存量分布:`e2e-functional` 65 · `features` 53 · `admin-lists` 23 · `product-reviews` 20 · `messages` 13 · `main-flow` 11 · `product-gallery` 8。

### 1.3 基线复现命令

```bash
# 后端(标准做法:独立检出,避开工作区竞态)
cd "$(mktemp -d)" && git -C /path/to/repo archive HEAD | tar -x
cd ./-  && mvn -B -Dmaven.repo.local=<可写路径> clean test
```

⚠️ 跑之前必须先停 dev 后端,否则 `maven-clean-plugin` 删不掉被 JVM 占用的 `target/`。

---

## 2. 环境阻塞项(非产品缺陷,但会让「测试网」整体失声)

### ENV-1 · 大面积测试 ERROR 的**两个独立根因**(症状几乎相同,必须分开诊断) 🔴

> **本节经过一次跨 Agent 归因纠错。** 结论是:**「139/147 个测试集体 ERROR」这一个症状,
> 在不同 runner 上有两个完全不同的病因,而它们互不替代。** 记错任一个都会误导后来者。

#### 根因 A:Mapper XML 转义缺陷(**DevOps 的 runner 上确实发生了**)

| 项 | 内容 |
|---|---|
| 现象 | 147 ERROR,首个真实失败是 `SqlSessionFactory` 建不起来,其余 146 个以 `ApplicationContext failure threshold exceeded` **连带阵亡** |
| 真凶 | `AnalyticsMapper.xml:151` 的裸 `<`(应为 `&lt;`)→ `SAXParseException` → MyBatis 映射文件解析失败 → 整个 Spring 上下文加载失败 |
| 恢复原因 | **backend 修好了那个裸 `<`** |
| 危险性 | **症状与病因距离极远**:报错全落在 context 加载,照着查会一路查到测试框架上,永远查不到 Mapper XML |

#### 根因 B:Mockito inline mock maker 无法自附加(**测试 Agent 的 runner 上确实发生了**)

对**同一棵树**做 A/B(唯一变量 = `mockito-extensions` 配置)。该树**根本不存在 `AnalyticsMapper.xml`**
(13 个 mapper 文件,实测 `Test-Path` = False):

| Arm | MockMaker 配置 | 结果 | `Could not self-attach` 命中 | `SAXParseException` | `AnalyticsMapper` |
|---|---|---|---|---|---|
| **A** | 无 | `Tests run: 163, Errors: 147` | **441** | **0** | **0** |
| **B** | 有 | `Tests run: 163, Failures: 0` | 0 | 0 | 0 |

| 项 | 内容 |
|---|---|
| 根因 | `pom.xml:24` 把 `mockito.version` 从 Spring Boot 托管的 5.7.0 覆盖为 **5.11.0**;Mockito 5.x 默认 **inline** mock maker,必须自附加 ByteBuddy agent。而 Spring Boot 的 `ResetMocksTestExecutionListener` 在**每个**测试的 `beforeTestMethod` 都会碰 `MockUtil` |
| 讽刺之处 | **全项目没有一个测试用到 Mockito**,却因此把 139 个 Spring 上下文测试全部拖死 |
| 恢复原因 | **新增 `src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker` = `mock-maker-subclass`**(不改版本,遵守 `DEVELOPMENT.md §4.4`) |

#### 两条结论(都保留,不要二选一)

1. **A 与 B 互不替代。** A 只在「源码树里有坏 XML」时成立;B 只在「runner 禁止 self-attach」时成立。
   DevOps 的 runner 允许 self-attach,所以他的基线里 Mockito 完全没有痕迹 —— **他的检索是对的**,
   只是与我的运行**不是同一棵树**(他跑的是含 `AnalyticsMapper.xml` 的工作区,我跑的是 `git archive HEAD` 的纯净检出)。
2. **因此两个配置都要保留,谁也不能替代谁:**
   - Mapper XML 良构性校验(DevOps 已在每次编译后跑,当前 `MAPPER_XML_COUNT=14 / ALL OK`)
   - `mock-maker-subclass`(让套件在受限 runner 上可跑)

> 🔴 **给后来者的操作纪律**:跑测试前若发现**大面积 context 加载失败**,
> **Mapper XML 良构性与 Mockito 两项都要查** —— 不要只查其一就下结论。
> 只查 Mockito 会漏掉 XML(DevOps 的教训);只查 XML 会漏掉 Mockito(我的教训)。

### ENV-1b · 端口 1000 的「绿」可能是陈旧代码 🔴

DevOps 发现后端源码树一度编译不过,但容器跑的是**旧 class**,1000 端口一直是绿的。

> **纪律**:任何「服务正常 / 联调通过 / 接口有响应」的说法**都不构成证据**,除非附带「本次编译成功」。
> F2 做联调或冒烟前,必须确认服务是当前源码编译产物(`mvn -B clean package` 成功 + 进程重启)。

### ENV-2 · 前端运行时基线 blocked ⛔(**环境限制,不是测试失败**)

> **本节结论已由测试 Agent 与 DevOps Agent 双方独立复现,判定收敛。**

| 项 | 内容 |
|---|---|
| **现象** | `spawn EPERM` |
| **精确栈** | `vite.config.ts` 加载阶段 → `esbuild/lib/main.js:1975 ensureServiceIsRunning → ChildProcess.spawn → EPERM` |
| **波及面** | vitest、vite dev server、Playwright 的 `webServer` **三者全废** —— 三者都要 esbuild,且 `vite.config.ts` 在**加载阶段**就要它 |
| **关键判断** | **这是一个根因,不是三个独立 bug**。esbuild 以「子进程 + 管道 stdio」启动,正好撞在受限模式的既定边界上,所以三者一起死是**必然结果** |
| **次生问题** | `web/`、`src/`、`docs/`、`docker/` 在受限 pwsh 沙箱下整体不可写;`web/node_modules` 为空且 ACL 拒写 |
| **Docker** | 也不可用:`permission denied ... npipe:////./pipe/dockerDesktopLinuxEngine`(沙箱禁命名管道) |
| **性质** | **不是测试失败,不是产品缺陷,是 runner 能力边界** |

**双方一致的前端结论**:

| 维度 | 结论 |
|---|---|
| **类型层面** | ✅ **双方独立复现为绿** —— `vue-tsc --noEmit` 主工程 + `tsconfig.test.json` 双份,均 **0 error** |
| **运行时**(vitest / Playwright / `vite build`) | ⛔ 在受限 runner 上**确定失败**,根因单一 = esbuild 子进程 spawn EPERM |

> ⚠️ **措辞纪律(不得含糊)**:
> - ✅ 应写:「**用例已就位,运行时未验证**」
> - ❌ 不可写:「未通过」「测试挂了」「e2e 是红的」
>
> 193 个 e2e / 184 个 vitest 用例本身**没有任何证据表明有问题**,它们只是**在本受限 runner 上跑不起来**。

### ENV-3 · 陈旧 class 伪装成「服务正常」 🔴(**协作方式,影响一切结论的可信度**)

DevOps Agent 发现:后端源码树一度**编译不过**,但容器跑的是**旧 class**,所以 1000 端口一直是绿的 —— **那个绿是陈旧代码**。抓到 2 个编译错误,均在几分钟内被 backend 修掉。

> **由此确立一条测试纪律**:
> **任何「服务正常 / 联调通过 / 接口有响应」的说法,在当前协作模式下都不构成证据,除非附带「本次编译成功」。**

对 F2 的约束:做联调或冒烟前**必须确认服务是当前源码编译产物**(`mvn -B clean package` 成功 + 进程重启),否则测的是旧代码。

### ENV-4 · 共享工作区竞态 ⚠️(**协作方式**)

F1 第一次在工作区跑测试时,139 个测试挂在 Spring context 加载失败上,根因是 `src/main/resources/mapper/AnalyticsMapper.xml` **第 151 行 XML 语法错误**(SAXParseException)。该文件 mtime 与构建时间窗重合 —— **backend Agent 正在写它,构建读到了半截文件**。

> 这不是 Bug,是多 Agent 共享工作区的固有竞态。**对策已由总控采纳**:F2 跑完整测试前确认各 Agent 落盘完成,或走独立检出。

---

## 3. 本轮已验证的结论

### ✅ AC-02.3 护栏通过 —— 总控的 IDOR 判断正确

总控要求我写越权回归用例验证「`/merchant/orders/{id}` GET 与 PUT 是否存在 IDOR」,并明确:**若跑出非 403 立刻上报**。

**结论:没有 IDOR。总控判断正确。**

已新增 `src/test/java/com/project/platform/controller/MerchantOrderOwnershipTest.java`(8 个用例,**8/8 全绿**),覆盖三个入口:

| 入口 | 链路 | 结果 |
|---|---|---|
| `GET /merchant/orders/{id}` | `selectById` → `checkOrderOwner` | shop1 读 shop2 订单 → **403** ✅ |
| `PUT /merchant/orders/{id}/status` | `selectById` + `updateById` | shop1 改 shop2 订单 → **403**,且状态未被改写 ✅ |
| `PUT .../status` (`cancelled`) | `cancelByOrderNo` / `cancel` | shop1 取消 shop2 订单 → **403**,且**库存不回补** ✅ |
| `GET /merchant/orders/{id}` (USER) | 角色层 | → **403** ✅ |
| `PUT .../status` (shop2 本人) | 正向 | → **200** 且状态真改写 ✅ |
| `GET /merchant/orders/{id}` (ADMIN) | 角色层 | → **403**(`AuthzRules` 里 `/merchant/**` 只登记 SHOP) |
| `POST /admin/orders/{id}/cancel` (ADMIN) | `AccessGuard` ADMIN 旁路 | → **200** 且状态真改写 ✅ |

**归类:③ 误判/预期行为 —— 当前行为正确。** 本类是**回归防护**,不是缺陷报告。批次 1 要改 `MerchantApiController` 状态机分支,那正是这个入口,留着断言成本极低、防的是最难发现的一类回归。

> 写测试时我自己踩了两个坑,记下来免得后人重蹈:① `cancelled` 是 **PUT** 的一个 status 取值,用 POST 会拿到 **405**(方法错配,不是授权结论);② ADMIN 走 `/merchant/**` 在**授权层**就被挡,根本到不了 `AccessGuard` 的 ADMIN 旁路 —— 要验那条旁路必须走 ADMIN 够得着的 `/admin/orders/{id}/cancel`。

---

## 4. 覆盖矩阵

图例:✅ 有自动化 · ⚠️ 部分/仅角色层 · ❌ **无自动化覆盖** · 🔒 D2 落地后才可测

### 4.1 授权与越权

| 场景 | 现状 | 备注 |
|---|---|---|
| 规则表逐条(前端调用面放行 / 遗留端点默认拒绝 / 角色不跨域 / null 兜底) | ✅ `AuthzRulesTest` 6 例 | 纯单测,毫秒级 |
| HTTP 层:合法访问矩阵 / 未登记 403 / 匿名 401 / 角色不跨域 / 购物车归属 | ✅ `AuthorizationBaselineTest` 14 例 | A/B/C/D 四段 |
| 商家订单对象级归属(AC-02.3) | ✅ **本轮新增** 8 例 | 护栏 |
| **商家 wallet / settings 的 shopId 归属** | ❌ | 🔒 D2 落地后启用 |
| 提现的归属 + 幂等 | ❌ | 🔒 D2 落地后启用 |
| **越权读他人评价 / 商品详情** | ⚠️ | 角色层有,对象层无 |

### 4.2 错误模型

| 场景 | 现状 |
|---|---|
| 5 类异常 → 4xx、`msg`/`data` 双写 | ✅ `ErrorModelTest` **19 例**(最厚的一张网) |
| Bean Validation / 缺参 / 路径变量类型错 / 畸形 JSON / 方法不允许 / 无处理器 | ✅ 全部已覆盖 |

### 4.3 订单状态机与资金(**最大缺口区**)

| 场景 | 现状 | 缺口 |
|---|---|---|
| 取消幂等(重复 / 并发只生效一次) | ✅ `OrderCancelConcurrencyTest` 2 + `OrderCancelCharacterizationTest` 8 | — |
| 余额支付取消净额为零 / card 支付取消不凭空加余额 | ✅ 已覆盖 | — |
| 超时取消任务 / 有界扫描 | ✅ 已覆盖 | — |
| **`待支付` 直接跳 `已完成` → 400(AC-02.1)** | ❌ | 状态机**非法跃迁**整片无网 |
| **发货后 `tracking_number` 非空(AC-02.2)** | ❌ | 当前 `shipped` 分支写死 `setTrackingNumber("")` |
| 完整合法链路 `待支付→待发货→待收货→已完成` | ❌ | |
| **结算金额一致性:summary.total == payments.create.amount == DB total_money** | ❌ | TASK-000-I,F2 验收 |
| **优惠码 `SAVE10`/`VIP15` → 400 且不产生优惠** | ⚠️ | `StorefrontPromoTest` 只覆盖 coupon 表分支,遗留硬编码回退分支无「应拒绝」断言 |
| **并发下单 / 超卖** | ❌ | 现有并发测试只覆盖**取消**,不覆盖**下单扣减** |
| **重复提交幂等(支付 confirm)** | ✅ `StorefrontPaymentControllerTest` 2 例 | |
| 购物车归属校验 | ✅ `ShoppingCartCharacterizationTest` 6 + `AuthorizationBaselineTest` 1 | 覆盖较完整 |

### 4.4 统计聚合与数据真实性

**通用断言标准(总控下发,本方案采纳为总纲):**

> **返回体里任何业务字段的值,都必须能由数据库复算得出。**

配合总控的区分标准:**返回 `0`/空/`null` 是诚实的可接受结果;返回常量 `4.5`/`"Unknown"`/硬编码英文文案才是缺陷。**

| 端点 | 现状 | 断言方式 |
|---|---|---|
| `GET /admin/dashboard/stats` | ❌ 硬编码 `$0`/`0` | 断言 == DB 聚合;禁止常量 |
| `GET /admin/dashboard/revenue-chart` | ❌ 恒返回空数组 | 断言随种子数据变化 |
| `GET /admin/merchants` `revenue` 字段 | ❌ 恒 `0` | 断言 == DB 聚合 |
| `GET /admin/products` `status` | ❌ 恒 `"active"` | |
| `GET /admin/reviews` `status` | ❌ 恒 `"visible"` | |
| `GET /merchant/dashboard/stats` | ❌ 4 项全硬编码 | |
| `GET /merchant/wallet` / `/transactions` | ❌ 恒 `0` / 空列表 | 🔒 D2 |
| `GET /admin/settings`、`PUT` | ❌ 硬编码 / **no-op 返 200** | 🔒 |
| `GET /merchant/settings` 里的 `location:"Unknown"`、`responseTime` | ❌ 硬编码 | |
| `PUT /merchant/settings`、`POST /merchant/wallet/withdraw` | ❌ **no-op 返 200** | 🔒 D2 |
| `GET /search/trending`、`/search/facets` | ⚠️ 硬编码或空 | |
| **`GET /merchants/{id}/profile` 的 `rating`** | ❌ | **== 该店评价 `AVG(rate)`;无评价必须为 0,绝不为 4.5** |
| **不存在的店铺 id → 404** | ❌ 当前 200 + `"Unknown Store"` | |

### 4.5 静默失效的过滤器(**最容易漏测**)

以下 8 处**返回 200 但结果与请求无关**,全部无自动化覆盖:

| 端点 | 失效点 |
|---|---|
| `GET /admin/users?role=` | `role != "all"` 时**恒返回空**(filter 里直接 `return false`) |
| `GET /admin/products?status=` | 参数收了不用 |
| `GET /admin/orders?q=` | 参数收了不用 |
| `GET /admin/reviews?q=&status=` | 两个参数都收了不用 |
| `GET /merchant/products?status=` | 参数收了不用 |
| `GET /merchant/orders?q=` | 参数收了不用 |
| `GET /merchants/{id}/products?category=` | 参数收了不用 |
| `GET /dashboard/stats`(买家) | Pending 用减法推导,口径需核 |

> **通用测法**:同一个端点用**两种不同过滤值**各请求一次,断言两次结果**不同**。返回 200 但两次一模一样 = 参数未生效。这比逐个写期望值高效得多。

### 4.6 边界与异常

| 场景 | 现状 |
|---|---|
| 空 items 结算 → 400 | ✅ `ErrorModelTest.summaryEmptyItemsIsBadRequest` |
| 缺 code / subtotal → 400 | ✅ |
| **超长输入**(超长用户名 / 备注 / 地址 / 上传文件名)**无任何覆盖** | ❌ |
| **空数据场景**(新库零订单 / 零评价的仪表盘)**无覆盖** | ❌ |
| **token 过期** | ❌ `JwtUtils` 24h 过期,**过期路径无任何测试** |
| token 签名错误 / 被篡改 | ⚠️ `AuthFlowTest.currentUserInvalidTokenRejected` 覆盖了「非法 token」,非「过期 token」 |
| 密码强度 / 重复用户名 | ✅ `AuthFlowTest` 12 例 |

---

## 5. 待补用例清单(F2 执行,按优先级)

### P0 · 资损线

| # | 用例 | 目标端点 | 断言 |
|---|---|---|---|
| 1 | **提现幂等**:同一笔提现重复提交 N 次 | `POST /merchant/wallet/withdraw` | 余额**只扣一次**;流水**不重复**;第 2+ 次返回幂等而非报错 🔒 |
| 2 | **提现归属**:shop1 提 shop2 的现 | 同上 | 403 🔒 |
| 3 | **结算金额一致性** | `/checkout/summary` → `/payments/create` → DB | 三者 `==`(容差 0.01);DB `total_money` 也相等 |
| 4 | **非法优惠码拒绝** | `POST /checkout/promo` | `SAVE10` / `VIP15` → **400**,且 `discount == 0`,DB 无优惠券核销 |
| 5 | **并发下单超卖** | `POST /checkout/create` | N 线程抢 M 件库存,最终 `stock >= 0` 且成功数 `<= M`;**无一笔超卖** |
| 6 | **重复提交幂等** | `/payments/confirm` | 重复 confirm 不重复扣款(已有 2 例,**补并发版**) |

### P1 · 授权与对象级

| # | 用例 | 断言 |
|---|---|---|
| 7 | **merchant wallet/settings 归属**(AC 同级) | shop1 读写 shop2 数据 → 403 🔒 |
| 8 | **admin/reviews 越权** | 非 ADMIN 访问 → 403 |
| 9 | **新端点登记回归** | D1/D2 新增端点必须在 `AuthzRulesTest` 放行清单 + `AuthorizationBaselineTest` A 段各出现一次 |
| 10 | **未登记新端点默认拒绝** | 新端点若忘了登记,三角色全 403 —— **这是本项目最容易在改动中被打破的一条** |

### P1 · 状态机

| # | 用例 | 断言 |
|---|---|---|
| 11 | **AC-02.1 非法跃迁** | `待支付` → `已完成` → **400** |
| 12 | **AC-02.2 快递单号** | 发货后 DB `tracking_number` 为**非空字符串**(当前代码 `shipped` 分支写死 `""`) |
| 13 | 完整合法链路 | `待支付→待发货→待收货→已完成` 每步 200 且 DB 状态正确 |
| 14 | 终态不可再跃迁 | `已完成` / `已取消` 订单的任何状态变更 → 400/409 |

### P2 · 数据真实性(通用标准逐端点铺开)

| # | 用例 | 断言 |
|---|---|---|
| 15 | 仪表盘统计可复算 | `admin/dashboard/stats`、`merchant/dashboard/stats` 每个字段 == DB 聚合;**常量值即失败** |
| 16 | `revenue-chart` 随数据变化 | 造 N 笔已完成订单后,返回点数 == N(当前恒空) |
| 17 | `merchants` 的 `revenue` | == DB 聚合(当前恒 0) |
| 18 | **`profile.rating` 真实性** | == `AVG(rate)`;**无评价时必须 0,绝不为 4.5** |
| 19 | **不存在的店铺 → 404** | 当前 200 + `"Unknown Store"` |
| 20 | no-op 端点不再假装成功 | `PUT /admin/settings`、`PUT /merchant/settings`、`POST /wallet/withdraw`、`PUT /admin/reviews/{id}` 🔒 |
| 21 | **过滤器生效**(8 处) | 两种不同过滤值 → 结果必须不同;两次相同即参数未生效 |
| 22 | `/dashboard/stats` Pending 口径 | 用减法推导的结果与 DB 一致 |

### P2 · 边界与安全

| # | 用例 | 断言 |
|---|---|---|
| 23 | **token 过期** | 造一个过期 JWT → 401 + 前端清会话;`/common/currentUser` 同样 |
| 24 | **超长输入** | 用户名 / 备注 / 地址 / 评价内容超长 → 400 或安全截断,**不得 500** |
| 25 | **空数据** | 零订单 / 零评价时仪表盘与列表返回 0/空,**不得 NPE / 500** |
| 26 | SQL 注入 | `q=' OR '1'='1`、`id=1;DROP TABLE` → 参数化,无异常 |
| 27 | **新表同步 schema-h2.sql** | D2 每张新表都要有对应 H2 建表语句,否则测试报表不存在 |

---

## 6. 目前无自动化覆盖的真实链路 ⚠️

> **这一节是本方案最需要被记住的部分。**

### 6.1 Vite 代理 `/api` → `:1000` 的前后端联调 —— **e2e 全绿也覆盖不到**

`web/playwright.config.ts` 用 `storageState` 在**页面脚本执行前**注入 `localStorage.RUNTIME_USE_MOCK='true'`,所以:

- 所有 e2e 都跑在 **mock 模式**,`USE_MOCK=true`
- 这意味着 **e2e 永远不会打到后端**
- 因此 **193 个 e2e 全绿 ≠ 前后端联调通过**

**这条链路上目前 0 自动化覆盖**,具体风险:

| 风险 | 现状 |
|---|---|
| Vite 代理 rewrite 是否正确(`/api` → 去掉前缀) | 无人验证 |
| `web/src/api/modules/*.ts` 与后端 `ResponseVO{code,msg,data}` / `PageVO{list,total}` **契约是否对得上** | 无人验证 |
| 字段名 / 类型 / 可空性错配 | 无人验证 |
| 401 拦截器 → 清会话 → 跳登录的**死循环**(DEVELOPMENT.md §3 警告过) | 无人验证 |
| **新端点漏登记 `AuthzRules` → 页面静默 403** | Mock 模式下**测不出来** |
| mock 分支与真实分支**行为漂移** | 无人验证 |

> **结论**:D1/D2 落地后,「mock 全绿」**不构成**联调通过的证据。需要 DevOps 起真后端 + 前端跑一次冒烟,并至少人工确认 admin / merchant 页面拿到的是**真实数据**而非 mock。

### 6.2 其余无自动化覆盖的链路

| 链路 | 说明 |
|---|---|
| **真实 MySQL 行为** | 后端测试全跑 H2 `MODE=MySQL`。H2 不完全兼容 MySQL:`DATE_SUB` / `information_schema` / 索引与唯一键的实际执行计划 / 事务隔离级别差异**测不到** |
| **并发真实压测** | 现有并发测试用线程池模拟,**非真实压测**;MySQL 行锁行为与 H2 不同 |
| **支付网关** | `payment` 表已落库 + 原子扣库存 + 状态机,但**没有真实商户号与回调验签**。接微信/支付宝时的「网关下单 + 回调验签 + 幂等入账」整条链路**不存在**,也无法测 |
| **文件上传** | `upload.ts` 无 mock 分支,上传只能打真实后端 → e2e 覆盖不到 |
| **生产 profile 启动** | 缺 `JWT_SECRET` / `SPRING_PROFILES_ACTIVE=prod` 时是否 fail-fast,只有启动日志,无测试 |
| **数据库迁移脚本** | `sql/migrations/*.sql` 手工执行,**无自动化验证**;回滚脚本正确性无人测 |
| **CI 流水线** | 无 CI 配置(`.github/` 为未跟踪目录),**没有任何自动闸门** |

---

## 7. F2 闸门定义

F2(开发落地后)跑完整测试的**准入条件**:

1. ✅ ~~TASK-000-J 落地,后端测试网恢复~~ —— **已完成并复跑验证(163 全绿)**
2. ✅ 各 Agent 确认落盘完成,或走 `git archive HEAD` 式独立检出(**避开 §2 ENV-4 竞态**)
3. ⚠️ 前端运行时基线仍 **blocked(环境限制)**。若 F2 仍在受限 runner 上跑,前端部分**继续如实标 blocked**,并遵守 §2 ENV-2 的措辞纪律
4. 🔴 **联调/冒烟前必须确认服务是当前源码编译产物**(§2 ENV-3),否则测的是旧 class

**F2 判定口径**:

- **本次改动引入的红** → 必须修,归到对应 Agent
- **与 §1.1 基线 155 全绿对比新增的红** → 逐条分类
- **§4 矩阵里 ❌ 的项** → 本轮补测试,补出来的红按「存量遗留」记录排期,不阻塞批次 1
- **误判 / 预期行为**(如 AC-02.3)→ 明确写「当前行为正确」,**不算 Bug**
- 不确定的可疑行为 → 写进报告但标注「**待确认**」并附证据,**不直接算 Bug**

### 7.1 D2 排期对齐(避免重复排期)

总控裁定:审计报告 §2 假数据基线里「**需要新建表才能修**」的那几条,现在 database 的迁移**已经把表建好了**。

| 条目 | 状态 |
|---|---|
| 商家钱包余额 + 流水表 | 表已建 → **后端 D2 实现中,验收挂在本阶段(F2)** |
| 设置表(admin / merchant settings) | 表已建 → **后端 D2 实现中,验收挂在本阶段** |
| 评价审核列(`status`) | 表已建 → **后端 D2 实现中,验收挂在本阶段** |
| 商品状态列(`product.status`) | 表已建 → **后端 D2 实现中,验收挂在本阶段** |
| `shipping_address.is_default` | 表已建 → 随 D2 验收 |

> 🔒 标记的含义:这些用例**现在无法写**(表/端点尚未就绪),**不是被遗漏**。D2 落地后按 §5 的 P0/P1 清单启用,届时**重新核对 `src/test/resources/schema-h2.sql` 是否已同步**(README 明确警告:新增表不同步 H2,测试报表不存在)。

> ⚠️ **database Agent 正在写 `schema-h2.sql`**:F2 跑测试前务必等其落盘完成,否则会读到半截 schema(与 §2 ENV-4 同类竞态)。
