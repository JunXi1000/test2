# TASK-001-A 环境、构建与启动验证（DevOps Agent）

- **任务**：TASK-001-A / `task-2`（含容器独占锁）
- **执行者**：env-verifier（DevOps Agent，§九/§26.18）
- **执行时间**：2026-10-01 20:52 – 21:0x（容器内 CST）
- **工作目录**：`E:\OneDrive\Desktop\test2`（容器内 `/workspace`，bind mount `../:/workspace`）
- **git HEAD**：`f4df6ac53dfeaa5777a70e1e00bc8ed311bc1455`
- **结论摘要**：
  1. 环境与端口**正常**；就绪判据「收到真实 HTTP 响应」**被实证**（后端 `/` → 401 + JSON body）。
  2. **运行态后端是过期代码**（确定结论，证据链见 §3）：JVM 启动于 15:30:54，`target/classes` 于 20:23:21 被整体重编译，工作树 13 个新 Java 文件创建于 19:54–20:11，类路径无 devtools ⇒ 运行中的 Tomcat **不含**当前工作树 Phase 3 代码。
  3. **后端构建闸门 FAIL**：`mvn -B clean test` → `Tests run: 171, Failures: 11, Errors: 1, Skipped: 0`，全部集中在 `StorefrontPromoTest`(10F+1E) 与 `RequestShapeTest`(1F)。证据表明由**未提交改动**引起（§4.3）。
  4. **前端闸门 PASS**：两个 tsconfig project 的 `vue-tsc --noEmit` 均 0 错误；`vite build --mode production` 成功（28.75s）。
  5. **迁移缺口为确定结论**：entrypoint **确实**用 glob 导入 `sql/migrations/*.sql`（并非硬编码 V1…V5），但**批次标记 `.schema-imported` 短路整个导入块** ⇒ 全新卷会导入 V6~V11，**己有卷永久漏掉且 `restart` 不自愈**。
  6. 当前环境状态：**后端已按闸门要求停掉（1000 无响应）**，前端 5173 正常，DB 未改动（仍 23 表）；**容器锁在 env-verifier 手里**。

---

## 1. 环境矩阵（原始证据）

```powershell
> docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
NAMES       STATUS       PORTS                                                                                                                IMAGE
nexus-dev   Up 5 hours   0.0.0.0:1000->1000/tcp, [::]:1000->1000/tcp, 0.0.0.0:5173->5173/tcp, [::]:5173->5173/tcp, 127.0.0.1:3306->3306/tcp   ghcr.io/junxi1000/nexus-dev-env:1.0
```

| 项 | 值 | 证据 |
|---|---|---|
| 容器 | `nexus-dev`，唯一容器（`docker ps -a` 只此一条），镜像 `ghcr.io/junxi1000/nexus-dev-env:1.0` | `docker ps` |
| 端口 1000（后端） | `0.0.0.0:1000`（**裸映射，局域网可达**） | `docker ps` / 宿主机 `netstat -ano \| Select-String ':1000'` → `LISTENING 45352` |
| 端口 5173（前端） | `0.0.0.0:5173`（裸映射） | 同上 → `LISTENING 45352` |
| 端口 3306（MySQL） | `127.0.0.1:3306`（**仅回环**） | `docker ps` |
| 容器内代码来源 | bind mount `../:/workspace`（宿主工作树实时可见） | `docker/docker-compose.yml:85` |
| MySQL 库 | `template_v3`，`MYSQL_DATA_DIR=/var/lib/mysql`（命名卷 `mysql-data`） | `docker exec nexus-dev env \| sort` |
| Java / Maven | `/opt/java/openjdk`（JDK 17）、`/opt/maven` | 进程 cmdline |
| 测试用库 | H2（`mvn test` 不依赖 MySQL，与 STARTUP.md §5 一致） | `mvn -B clean test` 未连 MySQL 即跑完 |
| 宿主机 bash | **不可用**（`bash dev.sh status` → `WSL ... execvpe(/bin/bash) failed`），故宿主侧 `dev.sh`/`start.sh` 无法在本机执行；本文的就绪验证一律用 `curl.exe` 直打端口 | §6 说明 |

---

## 2. 就绪与版本核验（A-1）

### 2.1 HTTP 响应码（判据 = 收到真实 HTTP 响应）

```powershell
> curl.exe -s -o NUL -w '%{http_code}' --max-time 15 http://127.0.0.1:1000/
401
> curl.exe -s -o NUL -w '%{http_code}' --max-time 15 http://127.0.0.1:5173/
200
> curl.exe -s -o NUL -w '%{http_code}' --max-time 15 http://127.0.0.1:1000/actuator/health
401
> curl.exe -s -o NUL -w '%{http_code}' --max-time 15 http://127.0.0.1:1000/api/storefront/products
401
```

```text
> curl.exe -s -i --max-time 15 http://127.0.0.1:1000/ | Select-Object -First 25
HTTP/1.1 401
X-Request-Id: d609d55d
Vary: origin,access-control-request-method,access-control-request-headers,accept-encoding
Content-Type: application/json
Transfer-Encoding: chunked
Date: Thu, 01 Oct 2026 12:52:34 GMT

{"code":401,"msg":"未登录或登录已过期","data":"未登录或登录已过期"}
```

**判据符合 `docs/STARTUP.md` §3 / `docker/scripts/dev.sh:147-167`**：后端 `/` 未登记在授权表 → 默认拒绝 401；**401 即就绪**，不是故障。

> ⚠️ 注意：`/actuator/health`、`/api/storefront/products` 同样返回 **401**（默认拒绝先于路由），所以 **401 不能用来区分「端点存在」与「端点不存在」**。这对 A2 的「新端点是否生效」取证很关键 —— 必须用**需要登录/已登记**的路径或行为差异来复验，不能靠匿名探测。

### 2.2 「TCP 能连上 ≠ 就绪」的实证

按闸门要求停掉容器内 dev 后端后，同一端口仍由 Docker 代理监听，但**拿不到 HTTP 响应**：

```text
--- HTTP after kill ---
backend_http=000
backend no response (exit 7)
frontend_http=200
```

即：`curl` 退出码 7 / `http_code=000` = 未就绪；`401` = 已就绪。两种状态实测均出现，判据可操作。

### 2.3 运行中进程清单（停掉之前采集）

```text
     76      75 Thu Oct  1 15:28:45 2026    05:23:58  ...launcher.Launcher spring-boot:run
    485      76 Thu Oct  1 15:30:54 2026    05:21:49  /opt/java/openjdk/bin/java -XX:TieredStopAtLevel=1 -cp /workspace/src/main/resources:/workspace/src/main/resources:/workspace/target/classes:/root/.m2/... com.project.platform.ProjectManagement
   9920    9902 Thu Oct  1 19:25:55 2026    01:26:48  sh -c vite --host
   9921    9920 Thu Oct  1 19:25:55 2026    01:26:48  node /workspace/web/node_modules/.bin/vite --host
```

- 后端：Maven `spring-boot:run`（15:28:45）+ 应用 JVM（**15:30:54**，`-cp …/target/classes`）。Tomcat 工作目录 `/tmp/tomcat.1000.1626407938108602916` mtime `2026-10-01 15:31:44` 佐证启动时刻。
- 前端：`vite --host`（19:25:55），**由容器内手工拉起**（`/var/log/frontend.log` 不存在，说明不是 entrypoint `AUTO_START` 起的；`/var/log/backend.log` 存在则后端是 entrypoint 起的）。Vite dev server 按请求即时编译源码，见 §3.3。

---

## 3. 过期判定（A-2）：运行态**是否**包含当前工作树代码

### 3.1 证据链

| # | 事实 | 原始证据 |
|---|---|---|
| E1 | 应用 JVM（PID 485）启动于 **2026-10-01 15:30:54**，`etime 05:21:49`，单进程连续运行 | `ps -o pid,ppid,lstart,etime,cmd -p 485` |
| E2 | 该 JVM 类路径指向 **`/workspace/target/classes`** | `/proc`-visible cmdline（见 §2.3） |
| E3 | Maven 在该次启动时编译了 **140** 个源文件 | `/var/log/backend.log` 首 30 行：`Compiling 140 source files with javac [debug release 17] to target/classes`（该段输出即 15:28 那次构建） |
| E4 | `target/classes` 下 **161 个 .class 全部** mtime = `2026-10-01 20:23`，`find … -printf '%TH:%TM' \| uniq -c` → `161 2026-10-01 20:23`（整体重编译，发生在 JVM 启动**之后** 4h53m） | `find target/classes -name '*.class' -printf … \| sort \| uniq -c` |
| E5 | 工作树 `src/main/java` 最新改动 `2026-10-01 20:15:42`（`ProductOrderServiceImpl.java`）；16 个已跟踪文件改动于 19:58–20:15 | `find src/main/java -name '*.java' -printf … \| sort -r \| head -20` + `git status` |
| E6 | **13 个新增（未跟踪）Java 文件**创建于 19:54–20:11：`AnalyticsMapper/AnalyticsService/AnalyticsServiceImpl` + `vo/{CategoryCountVO,PriceBucketCountVO,PriceRangeCountVO,RatingCountVO,RevenuePointVO,SearchFacetsVO,ShopPublicStatsVO,ShopRatingVO,ShopRevenueVO,StatVO}` | `git status --porcelain -- src/main/java`（`??`） |
| E7 | 工作树源文件数 **153**，HEAD 跟踪数 **140**（差 13 = E6） | `git ls-tree -r --name-only HEAD -- src/main/java \| Measure-Object` |
| E8 | 应用类路径**不含** `spring-boot-devtools`（无热重启） | `tr ':' '\n' < /proc/485/cmdline \| grep -ci devtools` → `0` |

### 3.2 结论（确定）

> **运行中的后端 JVM 不包含当前工作树代码，运行态 = 过期（Phase 2 / HEAD 附近）代码。**

推理是封闭的：E1+E8 说明该 JVM 的类只会在 **15:30** 那次启动时装载一次（无 devtools/无热重载）；E4 说明磁盘上的字节码在 **20:23** 才被整体替换成"含当前源码"的版本；E5/E6/E7 说明当前工作树有 16 处改动 + 13 个新文件晚于 15:30。因此 20:23 编译出来的 `AnalyticsService`、`StorefrontDashboardController`… **不可能**存在于 15:30 启动的 JVM 里。

即：**"跑着的站点" ≠ "工作树代码"**。任何基于当前运行态的端到端验收（尤其本次新增的仪表盘/搜索/结算聚合端点）在重启前都不可信。

> 方法学限制（如实记录）：JVM 已按闸门要求被 kill，未能用「新端点行为差异」做行为级对照；本判定基于 mtime 链 + 无 devtools + 编译源文件数差（140 vs 153），对"运行态是否含当前代码"是充分且确定的。行为级复验由 **A2 重启后**完成（Lead 已指定用 `StorefrontDashboardController` / `StorefrontSearchController` / `AdminApiController` / `MerchantApiController` 等**确实改了实现**的聚合端点取证）。

### 3.3 前端不存在过期问题（对照）

Vite dev server 按请求从磁盘编译，实测它服务的是**未提交的当前版本**：

```text
> curl.exe -s http://127.0.0.1:5173/src/pages/merchant/Wallet.vue
http_status=200  bytes=1079
MATCH: state/ErrorState.vue  -> Vite is serving the UNCOMMITTED (current) version
MATCH: useAsyncTask
> git show HEAD:web/src/pages/merchant/Wallet.vue   → HEAD does NOT have state/ErrorState.vue import
```

`web/src/pages/merchant/Wallet.vue` 的新增 import（`@/components/ui/state/ErrorState.vue`）只存在于工作树版本，Vite 返回的转换产物里有它 ⇒ **前端运行态 = 当前工作树（无需重启）**。

---

## 4. 后端构建闸门（A-3）

### 4.1 跑前先停 dev 后端（`maven-clean-plugin` 需要）

```powershell
> Get-Content "$env:TEMP\dsh-env-verify\kill.sh" -Raw | docker exec -i nexus-dev bash
=== date before kill ===
Thu Oct  1 08:54:16 PM CST 2026
=== pkill spring-boot:run ===
pkill1_rc=0
=== pkill ProjectManagement ===
pkill2_rc=0
=== remaining java/vite processes ===
   9920 ... sh -c vite --host
   9921 ... node /workspace/web/node_modules/.bin/vite --host
=== HTTP after kill ===
backend_http=000
```

（`pkill` 用 `[s]pring-boot:run` / `[P]rojectManagement` 中括号写法避免自匹配，同 STARTUP.md §5。）

### 4.2 构建与测试

```bash
docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'
```

```text
=== START mvn -B clean test ===
Thu Oct  1 08:54:27 PM CST 2026
...
[INFO] --- clean:3.3.2:clean (default-clean) @ template_v3 ---
[INFO] Deleting /workspace/target
[INFO] --- compiler:3.11.0:compile (default-compile) @ template_v3 ---
[INFO] Compiling 153 source files with javac [debug release 17] to target/classes
[INFO] --- compiler:3.11.0:testCompile (default-testCompile) @ template_v3 ---
[INFO] Compiling 24 source files with javac [debug release 17] to target/test-classes
...
=== END mvn -B clean test rc=1 ===
Thu Oct  1 08:58:13 PM CST 2026
```

- **`clean` 成功**（`Deleting /workspace/target`）—— 先停后端是有效前置，未出现 `Failed to delete /workspace/target`。
- 编译：主源码 **153** 个（= 当前工作树，印证 E7）、测试源码 **24** 个；编译期**无错误**。
- 用时约 **3m46s**（20:54:27 → 20:58:13），容器内预热 Maven 仓库有效。

### 4.3 测试结果

```text
[ERROR] Tests run: 171, Failures: 11, Errors: 1, Skipped: 0
[ERROR] Failed to execute goal org.apache.maven.plugins:maven-surefire-plugin:3.1.2:test (default-test) on project template_v3: There are test failures.
```

| 指标 | 值 |
|---|---|
| 测试总数 | **171** |
| 失败（Assertion） | **11** |
| 错误（Exception） | **1** |
| 跳过 | 0 |
| 闸门结论 | **FAIL（`rc=1`，阻断）** |
| 失败测试类 | `StorefrontPromoTest`（11 个用例中 10F+1E）、`RequestShapeTest`（9 个用例中 1F） |

失败用例全名（surefire 原文）：

```text
[ERROR] Failures:
[ERROR]   RequestShapeTest.summaryInvalidItemStillConflict:79 Status expected:<409> but was:<400>
[ERROR]   StorefrontPromoTest.belowMinOrderRejected:96 Status expected:<409> but was:<400>
[ERROR]   StorefrontPromoTest.disabledCouponIsIgnored:123->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.expiredCouponIsIgnored:113->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.fixedCouponAtExactMinOrder:85->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.legacyFallbackCodeStillWorks:131->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.percentCouponBelowCap:55->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.percentCouponCappedByMaxDiscount:62->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.percentCouponRoundsHalfUpToCents:69->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.unknownCodeYieldsZero:137->discountOf:153 Status expected:<200> but was:<400>
[ERROR]   StorefrontPromoTest.unknownCouponTypeYieldsZero:104->discountOf:153 Status expected:<200> but was:<400>
[ERROR] Errors:
[ERROR]   StorefrontPromoTest.fixedCoupon:76->dataOf:165 » JSON offset 1, character 请, line 1, column 1, fastjson-version 2.0.53 请先登录后再使用优惠码
```

失败响应体（surefire 原文）：

```text
Request URI = /checkout/promo     Headers = [Authorization:"Bearer "]   Body = {"subtotal":"100","code":"SAVE20"}
Status = 400   Body = {"code":400,"msg":"请先登录后再使用优惠码"}
---
Request URI = /checkout/summary   Status = 400   Body = {"code":400,"msg":"结算商品参数不合法"}
```

### 4.4 归属判定：**存量失败 or 本次引入？**（供 code-reviewer / QA 使用）

**判定：由未提交改动引起（"本次引入"），不是存量失败。** 三重证据：

1. **失败用例所在测试文件未被改动**（`git status --porcelain -- src/test/java/.../StorefrontPromoTest.java .../RequestShapeTest.java` 输出为空 ⇒ 与 HEAD 一致，属基线测试）。测试侧不存在"改测试造成失败"。
2. **`请先登录后再使用优惠码` 在 HEAD 中不存在**：`git show HEAD:src/main/java/.../service/impl/CouponServiceImpl.java | Select-String '请先登录'` → **无输出**；工作树版本把它加在 `CouponServiceImpl.java:114-116`（`applyByCode` 的 `userId == null` 前置拒绝）与 `:162-164`（`redeem`）。该前置拒绝使**匿名**调用 `/checkout/promo` 一律 400，而基线测试的 helper 明确按匿名设计：`StorefrontPromoTest.java:151` 注释「POST /checkout/promo（白名单端点，**不需要 token**）」、`:159` `post("/checkout/promo", "", …)`（空 token）。⇒ 11 个用例被新守卫打成 400。
3. **`结算商品参数不合法` 的错误码被改**：`git show HEAD:.../StorefrontCheckoutController.java` `:56` 为 `throw new CustomException("结算商品参数不合法");`，而单参构造器落 **409**（`CustomException.java:21 this.httpStatus = HttpStatus.CONFLICT`）；工作树 `:84` 改成 `new CustomException(HttpStatus.BAD_REQUEST, "结算商品参数不合法")` ⇒ **409 → 400**，与 `RequestShapeTest:79` 的 `expected:<409>` 冲突。且工作树 `CheckoutSummaryDTO.java:15` 的注释还写着"均为 **409**"，**代码与自己的注释已经不一致**。

> 方法学限制（如实记录）：**未**跑 HEAD 基线（需要 stash / worktree，会改动他人正在编辑的工作树，非本闸门授权范围）。上述为「测试未改 + 断言相关代码在 diff 中新增/变更」的强证据组合，**建议 code-reviewer（task-1）把它列入 must_fix 并给最终裁定**。
>
> 另：失败原因与 DB/schema **无关**（全部在 MockMvc + H2 层被新守卫拦下），因此**应用 V6~V11 迁移不会修好这 12 个失败**。不要指望 A2 之后 `mvn test` 变绿。

### 4.5 交叉核对 TASK-000 基线

`docs/TASK-000/09-TEST-INFRA.md:117` 记录的历史基线为 `Tests run: 163, Failures: 1, Errors: 0`，唯一失败 `MerchantOrderOwnershipTest.shopCanChangeOwnOrderStatus:119`（当时的定性是"过期测试"）。**本次该用例已通过**（`MerchantOrderOwnershipTest` → `Tests run: 14, Failures: 0`），即 TASK-000 的已知失败已修复；当前 12 个失败是**另一批**、集中在优惠码/结算契约上。

全绿测试类（节选，surefire 原文）：`AuthzRegistrationGateTest 2/0/0`、`AuthzRulesTest 6/0/0`、`RequestIdFilterTest 4/0/0`、`AddressControllerTest 6/0/0`、`AdminApiControllerTest 10/0/0`、`AuthControllerTest 6/0/0`、`AuthFlowTest 12/0/0`、`AuthorizationBaselineTest 14/0/0`、`ChatControllerTest 10/0/0`、`ErrorModelTest 19/0/0`、`MerchantApiControllerTest 8/0/0`、`MerchantOrderOwnershipTest 14/0/0`、`OrderCancelCharacterizationTest 8/0/0`、`OrderControllerTest 3/0/0`、`ProductControllerTest 6/0/0`、`SecurityControllerTest 6/0/0`、`ShoppingCartCharacterizationTest 6/0/0`、`StorefrontPaymentControllerTest 2/0/0`、`OrderCancelConcurrencyTest 2/0/0`、`ResetCodeStoreTest 6/0/0`、`TemplateApplicationTests 1/0/0`。

---

## 5. 前端闸门（A-4）

脚本名勘误：`web/package.json` **没有 `build` 脚本**（只有 `build-prod` = `vite build --mode production`、`prod` = `vite --mode production`、`typecheck` = 两个 project 连跑）。本次按等价口径执行 `npx vue-tsc --noEmit`、`npx vue-tsc --noEmit -p tsconfig.test.json`、`npm run build-prod`。

```text
=== FRONTEND GATE START ===
Thu Oct  1 08:58:54 PM CST 2026
--- 1) npx vue-tsc --noEmit (src project) ---
vue_tsc_rc=0
0 /tmp/fe-tsc.log
--- 2) npx vue-tsc --noEmit -p tsconfig.test.json (tests project) ---
vue_tsc_test_rc=0
0 /tmp/fe-tsc-test.log
--- 3) npm run build-prod (= vite build --mode production; note: no 'build' script exists) ---
build_prod_rc=0
dist/assets/... (39 chunks) ...
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 28.75s
=== FRONTEND GATE END ===
Thu Oct  1 08:59:41 PM CST 2026
```

| 闸门 | 结果 | 错误数 | 是否阻断 |
|---|---|---|---|
| `npx vue-tsc --noEmit`（`src/**`，strict + noUnusedLocals/Parameters） | **PASS** (`rc=0`) | **0** | 否 |
| `npx vue-tsc --noEmit -p tsconfig.test.json`（`tests/**`） | **PASS** (`rc=0`) | **0** | 否 |
| `npm run build-prod` 生产构建 | **PASS** (`rc=0`, 28.75s, 产出 `web/dist/*`) | **0** | 否 |
| Rollup chunk > 500 kB 警告（`vendor-echarts` 462.88 kB、`ui-element-plus` 788.42 kB） | WARN | — | **不阻断**（既有体型问题，非本次引入；仅提示 code-split） |

**结论：前端构建闸门全绿，未提交的 `web/` 改动本身不阻断构建。**

---

## 6. 入口脚本迁移缺口（A-5）：确定结论

### 6.1 事实

1. `docker/entrypoint.sh` **不是**硬编码 V1…V5，它用 glob 导入整个迁移目录：

```bash
# entrypoint.sh:140-148
for base in \
  /workspace/sql/schema.sql \
  /workspace/sql/chat.sql \
  /workspace/sql/migration-2026-08-08-phase1.sql; do
  [ -f "$base" ] && import_sql "$base"
done
for f in /workspace/sql/migrations/*.sql; do     # ← 覆盖 V1…V11（rollback/ 是子目录，globs 不命中）
  [ -f "$f" ] && import_sql "$f"
done
```

2. **但整个导入块被一个批次标记短路**：

```bash
# entrypoint.sh:103-105
MARKER="${DATA_DIR}/.schema-imported"   # 整批完成标记(写了它就不再扫)
if [ ! -f "${MARKER}" ] && [ -d /workspace/sql ]; then
```

3. 容器内现网证据：

```text
-rw-r--r-- 1 root root 0 Sep 27 18:21 .schema-imported      ← 批次标记存在，且早于 V6~V11 的创建时间
ls: cannot access '/var/lib/mysql/.imported/': No such file or directory   ← 连 per-file 标记目录都没建过
```

（V6~V11 文件 mtime：`V6 20:08:46`、`V7 19:57:44`、`V8 19:58:41`、`V9 19:59:08`、`V10 20:05:30`、`V11 20:12:50`，全部 **晚于** 标记的 `Sep 27 18:21`。）

### 6.2 结论（两句话，必须分开说）

> **(a) 全新卷（`dev.sh reset` 或首次 clone）上 `bash start.sh`：不会漏 V6~V11。** 入口是 glob，会把 `sql/migrations/*.sql` 全导（V1…V11）。
> **(b) 已有卷（本项目现状）：会永久漏掉 V6~V11，且 `docker restart` / `dev.sh restart` 不自愈。** `.schema-imported` 已存在 ⇒ 第 105 行条件为假 ⇒ 导入块整体跳过，**新加入的迁移文件永远不会被发现**。这不是"重试失败的脚本"场景（那是 `.imported/` 的 per-file 机制），而是"整批导入被永久禁用"。

### 6.3 文档漂移（原始文档缺陷，建议 Lead 派单）

| 文档 | 原文 | 与实测不符 |
|---|---|---|
| `docs/STARTUP.md` §3（第 78 行） | 导入 `sql/migrations/**V1…V5**`（共 23 张表） | 入口实际是 glob，全新卷会导到 V11；"V1…V5"是过期描述（写于 V6 出现之前） |
| `docs/STARTUP.md` §8.1（第 198 行） | 手动导 `sql/migrations/V1…V5` | 同上；且手工路径下若漏 V6~V11，Phase 3 端点必然 500/表不存在 |
| `docs/STARTUP.md` §9（第 244 行） | "已有的库不会被自动升级…新增迁移（V4/V5 等）需手工执行" | **方向正确但归因不准**：真正原因是"批次标记短路"，不是"按文件记完成度，成功的脚本跳过"（后者只影响失败的脚本重试） |

**"全新 `start.sh` 是否会永久漏掉 V6~V11"的答案：取决于卷** —— 新卷不会，现网这种已初始化过的卷会。修复建议（**属 docker/，本轮禁改，待 Lead 裁决**）：把批次标记改成"按文件标记 + 每次启动扫目录"（即去掉第 105 行的 `MARKER` 短路，只保留 `.imported/` per-file 幂等），或增加一个显式的 `V*.sql` 版本登记表。

### 6.4 现网库状态（迁移前置事实，供 A2）

```text
> "select count(*) from information_schema.tables where table_schema='template_v3';" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N
23
> "show tables;" → admin, advertising, conversation, coupon, message, notification, payment, product,
  product_browsing_history, product_collect, product_order, product_order_evaluate, product_type,
  return_request, shipping_address, shop, shop_collect, shopping_cart, slideshow, stock_alert,
  user, user_coupon, user_notification_pref          （= Phase 1 基线 23 表）
> 目标对象存在性：merchant_wallet / platform_setting / product_review / review_moderation_log → 全部**不存在**
                   （`product`、`shipping_address` 存在，属基线表）
> `show tables like '%migration%'` → 空（**无 Flyway 式版本登记表**）
```

`sql/migrations/rollback/` 下 V2~V11 回滚脚本**齐全**（V6/V7/V8/V9/V10/V11 均存在，mtime 19:57–20:13），破坏性评估与可回滚性由 A2 逐条给出。

---

## 7. 当前环境状态与容器锁（重要）

执行完 A 的闸门后，环境处于**已知、可复现的中间状态**：

| 组件 | 状态 | 说明 |
|---|---|---|
| 容器 `nexus-dev` | Up（未重启） | 入口脚本不会再跑导入（标记短路） |
| 后端 :1000 | **已停（无响应，http_code=000）** | A-3 闸门要求先停后端；`target/` 已被 `clean` 重建为**当前工作树**字节码（20:58，161 类） |
| 前端 :5173 | **正常 200** | Vite 仍在跑，服务当前工作树源码 |
| MySQL :3306 / 库 | **未改动**，仍 **23** 表 | 本轮 A 未执行任何 DDL/DML |
| `target/` | 当前工作树编译产物（20:58） | A2 重启后端后将首次装载 Phase 3 代码 |
| 容器独占锁 | **在 env-verifier 手里** | 其他人（qa 等）在 A2 完成前不得 `docker exec` / 重启 / 构建 |

---

## 8. 阻塞项与风险（上报 Lead）

| # | 等级 | 事项 | 证据 | 建议归属 |
|---|---|---|---|---|
| B1 | **Blocker** | 运行态后端为过期代码，任何"验收"在重启前无效 | §3 | 本 Agent（A2 重启） |
| B2 | **Blocker** | 现网库缺 V6~V11 六迁移（23 表），Phase 3 依赖它们的端点必然失败 | §6.4 | 本 Agent（A2 应用） |
| B3 | **Blocker** | 后端闸门 FAIL：171 测试中 12 个失败，证据指向未提交改动引入（优惠码强制登录 + 结算 409→400） | §4.3/§4.4 | code-reviewer（task-1）裁定 must_fix，QA 复验 |
| B4 | Major | `/checkout/promo` 白名单允许匿名，但 `CouponServiceImpl:114` 又拒绝匿名 ⇒ 该端点对匿名用户"可访问但永远 400"，设计自相矛盾；且测试注释仍称其"不需要 token" | §4.4(2) | 后端（未实现/契约） |
| B5 | Major | `StorefrontCheckoutController:84` 用 `BAD_REQUEST`(400)，而 `CheckoutSummaryDTO:15` 注释与既有契约均为 409 —— 代码与注释、代码与基线测试三方不一致 | §4.4(3) | 后端 |
| B6 | Major | 已有卷永久漏迁移，`restart` 不自愈；`docs/STARTUP.md` §3/§8.1 的"V1…V5"已过期 | §6.2/§6.3 | docker/ + docs（本轮禁改，待批准） |
| B7 | Minor | `web/package.json` 无 `build` 脚本（任务书写的是 `npm run build`），实际脚本为 `build-prod`；文档/指令口径需统一 | §5 | 文档/Lead |
| B8 | Minor | 宿主机无 `bash`（WSL 缺 `/bin/bash`），`dev.sh`/`start.sh` 在 Windows 侧不可执行；就绪验证须走 `curl.exe` 或 `dev.bat`/`dev.ps1` | §1 | 文档/环境 |

**未做/受限项（如实声明）**：① 未跑 HEAD 基线对照（会改工作树，超出授权）；② 未执行宿主 `dev.sh status`（无 bash）；③ 未做行为级"新端点生效"验证（后端已按闸门停掉，且匿名探测 401 不可区分端点存在性）—— 三者均转由 A2 或 code-reviewer/QA 承担。

---

## 9. 下一任务（A2）的输入清单

A2（`task-4`，blocked_by `task-2` + `task-1`）开工前即可用的结论：

1. 库现状 23 表、无版本登记表、V6~V11 未应用；rollback V6~V11 齐全。
2. entrypoint 不会自动应用（标记短路），**必须手工按 utf8mb4 逐条执行**：`"…" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3`（PowerShell 下 stdin 最稳）。
3. 重启后端时 `target/` 已是当前工作树字节码（A 的 `clean` 已重建）；仍应按 STARTUP.md §5 先 `pkill` 再 `mvn spring-boot:run`。
4. **断言"迁移成功 ≠ 端点变真实"**（Lead 已核实：`platform_setting`/`merchant_wallet`/`is_default`/`review_status` 在 Java 侧引用数为 0 或仅注释）⇒ A2 需产出「迁移新增对象 ↔ Java 引用位置/引用数」对照表，并明确哪些端点仍是假数据/no-op。
5. 就绪判据沿用「收到 HTTP 响应」（401/403/404 均算）；**新端点生效**的取证请用确实改了实现的聚合端点（`StorefrontDashboardController`、`StorefrontSearchController` trending/facets、`StorefrontProductController` related/bought-together/complete-the-look、`AdminApiController`/`MerchantApiController` 统计），并优先用"需登录 + 与 DB 交叉核对"的方式。
6. `mvn -B clean test` 的 12 个失败**与迁移无关**，A2 复跑应得到同样结果（除非期间有人改了代码/测试）。

---

## 10. 附：本次使用的原始命令清单

```powershell
# 环境
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
netstat -ano | Select-String ':1000|:5173|:3306'
docker exec nexus-dev env | Select-String 'MYSQL|AUTO_START|SPRING'
docker exec nexus-dev ls -la /var/lib/mysql

# 就绪
curl.exe -s -o NUL -w '%{http_code}' http://127.0.0.1:1000/
curl.exe -s -i http://127.0.0.1:1000/

# 过期判定
docker exec nexus-dev bash -lc "ps -eo pid,ppid,lstart,etime,cmd | grep -E 'java|vite'"
docker exec nexus-dev bash -lc "find target/classes -name '*.class' -printf '%TY-%Tm-%Td %TH:%TM\n' | sort | uniq -c"
docker exec nexus-dev bash -lc "find src/main/java -name '*.java' -printf '%TY-%Tm-%Td %TH:%TM:%TS  %p\n' | sort -r | head -20"
docker exec nexus-dev bash -lc "tr ':' '\n' < /proc/485/cmdline | grep -ci devtools"

# 闸门
docker exec nexus-dev bash -lc 'pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"'
docker exec nexus-dev bash -lc 'cd /workspace && mvn -B clean test'
docker exec nexus-dev bash -lc 'cd /workspace/web && npx vue-tsc --noEmit && npx vue-tsc --noEmit -p tsconfig.test.json && npm run build-prod'

# DB（stdin 传 SQL，避开 PowerShell 嵌套引号）
"show tables;" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N
"select count(*) from information_schema.tables where table_schema='template_v3';" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N
```

> 说明：容器内执行较长的多行脚本时，本 Agent 统一采用「宿主临时文件 + LF 行尾 + `Get-Content -Raw | docker exec -i nexus-dev bash`」，并用 `> /tmp/xxx.log 2>&1` 留原始日志（`/tmp/mvn-test.log`、`/tmp/fe-tsc.log`、`/tmp/fe-tsc-test.log`、`/tmp/fe-build.log`）。**注意 CRLF 会被 bash 当成命令的一部分**（实测 `wc -l\r`、`tail path\r` 报错），写脚本必须归一化为 LF。
