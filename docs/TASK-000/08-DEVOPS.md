# TASK-000-H 环境构建与部署验证（DevOps）

> 执行人：devops ｜ 时间：2026-10-01 19:58–20:09 ｜ 工作目录：`E:\OneDrive\Desktop\test2`
>
> **本报告的判定标准**：一律以「收到真实 HTTP 响应」为准，**不以「端口能连上」为准**（沿用
> `docs/STARTUP.md §3.4` 的做法）。凡未实测到的，一律写「未验证」，不填推测值。

---

## 1. 结论速览

| 项 | 结论 |
|---|---|
| 三个服务是否真的在跑 | ✅ 全部在跑，且返回真实业务响应（不是我启动的，是接手时 Docker 环境已在运行） |
| 三角色登录 | ✅ admin / user1 / shop1 全部签发真实 JWT |
| 跨域越权防护 | ✅ ADMIN 访问 `/merchant/**` → 403；SHOP 访问 `/admin/**` → 403 |
| 后端能否编译 | ✅ 能（主代码 153 文件 + 测试 23 文件全部编译通过） |
| 后端测试 | ⚠️ 163 个用例，**1 失败**（详见 `09-TEST-INFRA.md`） |
| 前端类型检查 | ✅ `vue-tsc` 0 error（主工程 + `tsconfig.test.json` 双双为 0） |
| 前端构建产物 | ❌ **未能验证** —— 被本会话沙箱阻断（`spawn EPERM`），非项目缺陷 |
| **管理端/商家端是否还在返回硬编码假数据** | ❌ **仍在返回** —— 本轮核心验收点**未通过**，详见 §6 |

---

## 2. 环境盘点（实测）

| 组件 | 可用性 | 版本 / 位置 |
|---|---|---|
| **JDK** | ✅ 可用 | Temurin **17.0.20.1**，与 `pom.xml` 的 `java.version=17` 匹配 |
| **Maven** | ✅ 可用（**但不在 PATH**） | **3.9.15**，藏在 `~/.m2/wrapper/dists/apache-maven-3.9.15/.../bin/mvn.cmd` |
| **Node** | ✅ 可用 | **v24.17.0** / npm **11.13.0** |
| **MySQL** | ✅ 可用 | **8.4.11-0ubuntu0.26.04.1**，经 `127.0.0.1:3306` 实测握手包确认 |
| **Docker CLI** | ⚠️ **本会话不可用** | `npipe` 权限被拒（见 §7），**但 Docker 环境实际在运行** |
| **Docker 容器** | ✅ 在运行 | MySQL 8.4.11 的 3306 已发布到回环，证明容器活着 |

> ⚠️ **Maven 不在 PATH**。任何自动化脚本若直接调 `mvn`，会得到 "command not found"。
> 要么用上面的绝对路径，要么先把它加进 PATH。这是「裸机路线」最容易踩的坑。

---

## 3. 采用路线：Docker（已在运行）+ 裸机（仅用于构建校验）

**为什么不是纯 Docker 路线**：本会话的沙箱禁止访问 Docker 的 `npipe`，我**无法**执行
`docker exec` / `docker compose`。而容器由用户先前启动，我**没有能力重启它**。

> 🔴 **由此得出一个关键约束**：正因为无法重启容器，**我刻意没有执行 `mvn clean`**。
> `docker-compose.yml:85` 是 `../:/workspace`，宿主机与容器**共用同一个 `target/`**；
> 在跑着的 JVM 上删 `target/` 是 `STARTUP.md §5` 明确警告的破坏性操作，
> 且一旦删掉我**无法重新拉起服务**。宁可绕路也不制造不可逆故障。

因此：
- **构建校验**：把 `src/` + `pom.xml` 复制到临时目录再编译（同时避开 §8 的竞态）
- **服务验证**：直接对已运行的容器打真实 HTTP

---

## 4. 构建校验结果

### 4.1 后端 `mvn -B clean package`

在**临时副本**（源码逐字一致）中执行，最终快照：

```
Compiling 153 source files to target\classes        ← 主代码通过
Compiling 23 source files to target\test-classes    ← 测试代码通过
```

✅ **编译通过**。过程中曾两次失败，但**两次都是竞态假象**，非稳定缺陷（见 §8）。

> Maven 在本会话需要两个额外参数才能跑通，属环境适配，不是项目问题：
> - `-Dmaven.repo.local=<临时目录>` —— 默认的用户级 `~/.m2/repository` 在沙箱内**只读**，
>   Maven 写 `_remote.repositories` 追踪文件会 `AccessDeniedException`。
> - 首次运行需联网补齐若干插件 POM（surefire 等）。

### 4.2 前端

| 命令 | 结果 |
|---|---|
| `npm install`（临时目录，`--ignore-scripts`） | ✅ 成功，added **383** packages |
| `vue-tsc --noEmit`（主工程） | ✅ **0 error**，exit 0 |
| `vue-tsc --noEmit -p tsconfig.test.json` | ✅ **0 error**，exit 0 |
| `vite build --mode production` | ❌ **`spawn EPERM`**，未能验证 |

> ⚠️ **脚本名更正**：`web/package.json` **没有 `build` 脚本**。
> 正确的是 **`build-prod`**（= `vite build --mode production`）。
> 任何写着「跑 `npm run build`」的指令都会得到 `Missing script: build`。

---

## 5. 服务可用性（真实 HTTP 证据）

| 服务 | 地址 | 实测结果 |
|---|---|---|
| 后端 | `http://127.0.0.1:1000` | **`GET /` → HTTP 401** `{code:401,msg:"未登录或登录已过期"}` —— 默认拒绝即就绪 |
| 前端 | `http://127.0.0.1:5173` | **`GET /` → HTTP 200**，返回真实 Vite HTML（含 `/@vite/client` 注入） |
| MySQL | `127.0.0.1:3306` | TCP 握手返回 **`8.4.11-0ubuntu0.26.04.1`** |

**Vite 代理链路验证**（前端 → 代理 → 后端 → MySQL 全链路）：

```
POST http://127.0.0.1:5173/api/common/login  {"username":"admin","password":"123456","type":"ADMIN"}
  → {"code":200,"msg":"操作成功","data":"<449 字符 JWT>"}
```

✅ 代理 `/api` → `:1000` 正常，去前缀 rewrite 正常，整条链路通到数据库。

**三角色登录**（`type` 字段必填，取值 `ADMIN|USER|SHOP`）：

| 角色 | 账号 | 结果 |
|---|---|---|
| 管理员 | `admin` / `123456` | ✅ `code=200`，JWT 449 字符 |
| 买家 | `user1` / `123456` | ✅ `code=200`，JWT 388 字符 |
| 商家 | `shop1` / `123456` | ✅ `code=200`，JWT 340 字符 |

**授权隔离**（`config/AuthzRules` 默认拒绝确实生效）：

```
ADMIN token → GET /merchant/dashboard/stats → {"code":403,"msg":"无权限访问该接口"}
SHOP  token → GET /admin/dashboard/stats     → {"code":403,"msg":"无权限访问该接口"}
```

---

## 6. 🔴 核心验收点：管理端 / 商家端**仍在返回硬编码假数据**

这是本轮的核心验收点，**结论：不通过**。源码与线上响应双向取证。

### 6.1 仍然硬编码的端点

| 端点 | 实测响应 | 源码位置 |
|---|---|---|
| `GET /admin/dashboard/stats` | `Total Revenue="$0"`, `Active Users="0"`, `Sales="0"`, `Active Now="0"` | `AdminApiController.java:37-45` |
| `GET /merchant/dashboard/stats` | `Total Sales="$0"`, `Orders="0"`, `Products="0"`, `Conversion Rate="0%"` | `MerchantApiController.java:40-47` |
| `GET /admin/dashboard/revenue-chart` | `[]`（恒空） | `AdminApiController.java:63-66` |

两处源码都自带 `⚠️ 占位数据` 注释，与 `docs/MODULES.md §2` 一致 —— 属**已知未完成项**，
归属 **TASK-000-D（后端）**，不是本轮引入的缺陷。

### 6.2 已确认是**真实数据**的端点（对照组）

证明「假数据」不是全站现象，而是集中在上面 3 个仪表盘接口：

| 端点 | 实测响应（节选） |
|---|---|
| `GET /admin/dashboard/recent-users` | `user/user@test.com`、`体验用户二/user2@test.com`、`测试用户/test@example.com` |
| `GET /admin/users` | 真实用户列表（id / role / email / status） |
| `GET /admin/merchants` | `一号数码旗舰店`（revenue 0）、`二号潮流服饰店` |
| `GET /admin/products` | `智能运动手表 ¥199`、`简约纯棉T恤 ¥149` |
| `GET /admin/settings` | `{commissionRate:5.0, siteName:"Nexus Market", maintenanceMode:false}` |
| `GET /merchant/products` | shop1 的 `简约纯棉T恤`，`stock:30, salesVolume:5` |
| `GET /merchant/settings` | `{storeName:"一号数码旗舰店", email:"shop@test.com"}` |
| `GET /common/currentUser`（user1） | `{id:1, username:"user1", balance:1000.00}` |
| `GET /coupons` | `OFFICE10`、`AUDIO15` 等真实券 |

### 6.3 🐛 附带发现：`/products/category-counts` 返回全 0（疑似缺陷）

```
GET /products/category-counts
→ {"All":0,"数码产品":0,"服装":0}
```

**同一时刻 `/admin/products` 明确返回了 3 件真实商品**（含「数码产品」「服装」两个分类）。
分类计数却全为 0，与事实矛盾。

排查：`StorefrontProductController.java:86-89` → `AnalyticsServiceImpl.categoryCounts():211-226`。
该方法用 `analyticsMapper.countProducts(null)` 与 `countByProductType(null,null)` 聚合。
**计数与列表走的不是同一条查询**，列表能出、计数为 0，说明聚合侧的条件（如 `status` /
`product_status` 过滤、JOIN 条件、schema 同步）有问题。

> 这**不在**我获授权的写范围内（禁止改 `src/main/java`），已上报总控，建议归入 TASK-000-D 或
> TASK-000-F 复核。优先级：**Major**（会让前端分类栏恒显 0，用户侧可见）。

### 6.4 其他空数据（非缺陷，种子库本就为空）

`/admin/orders`、`/admin/reviews`、`/merchant/orders`、`/merchant/wallet/transactions`
均返回空列表 —— 种子数据里没有任何订单，**如实为空是正确的**。
`/merchant/dashboard/low-stock` 为空也合理：shop1 商品 `stock=30`，未触及 `≤5` 阈值。

---

## 7. 本会话的环境限制（非项目缺陷，供总控判断）

| 限制 | 表现 | 影响 |
|---|---|---|
| **Docker CLI 不可用** | `permission denied ... npipe:////./pipe/dockerDesktopLinuxEngine` | 无法 `docker exec` / 重启容器 / 重建镜像 |
| **子目录不可写** | `web/`、`src/`、`docs/`、`docker/` 在 pwsh 下 mkdir 即「访问被拒绝」 | 无法 `cd web && npm install`；文件工具写入不受影响 |
| **piped-stdio spawn 被拒** | `esbuild → spawn EPERM` | vite build / vitest / Playwright 三者全灭 |
| **用户级 `~/.m2` 只读** | `_remote.repositories → AccessDeniedException` | Maven 需 `-Dmaven.repo.local=<可写目录>` |

> 这些是**本会话沙箱策略**，不是项目配置问题。已在 §4 逐项给出可复现的绕行方式。

---

## 8. 🔴 给全队的警告：共享工作区的编译竞态会伪装成「缺陷」

`STARTUP.md §5` 只警告了「跑测试前要先停 dev 后端」，但**没有**警告**编译期**的同类风险。
本轮我实测到它，并且它**两次**伪装成真实缺陷：

| 时刻 | 捕获到的错误 | 真实性质 |
|---|---|---|
| T0 | `StorefrontSearchController.java` 找不到 `TRENDING_LIMIT` / `analyticsService` | 竞态。数分钟后同一文件里这两个符号都在 |
| T1 | `StorefrontMerchantController.java:132` 找不到 `productTypeService` | 竞态。数分钟后同文件已正常编译 |
| T2 | **`AnalyticsMapper.xml:151` SAXParseException**（`元素内容必须由格式正确的字符数据或标记组成`） | 竞态。该行当时是裸 `<`，现已是 `&lt;` |

**T2 尤其阴险**：它导致 **163 个测试里 147 个 ERROR**，报错却指向
`ApplicationContext failure threshold exceeded`，与 XML 毫无字面关联 ——
排查成本极高。**这一条与 QA 报告的现象完全同源**。

**标准做法（我全程采用，已建议推广）**：
```bash
# 复制到独立目录再编译，避免读到别人正在写入的半截文件
cp -r src pom.xml <临时目录>/ && cd <临时目录> && mvn -B clean test
```

---

## 9. 服务状态交接

🔴 **三个服务仍处于运行状态，我未停止它们。**

- 启动者：**用户先前启动的 Docker 环境**（不是我）
- 停止者：**无人**
- 当前状态：`:1000` → 401、`:5173` → 200、`:3306` → MySQL 8.4.11 握手正常
- 需要停的话请用 `stop.bat`（或 `dev.bat down`，数据保留）

⚠️ **重要提醒**：容器里跑的是**较早编译的 class**。§6.1 的假数据结论基于**当前线上代码**，
但**它不代表当前 `src/` 编译产物** —— 事实上 §8 证明 `src/` 曾一度编译不过。
**重启容器前请先确认当前源码能编译**，否则容器会起不来。

---

## 10. 需要总控决策 / 需要用户操作的事项

1. **【用户】若要在本机装前端正式依赖**：`web/node_modules` 为空且我无写权限。
   请在普通（非沙箱）终端执行 `cd web && npm install`。
2. **【用户】前端运行时绿灯**：vitest(184) / Playwright(193) / vite build 需要不受限环境跑一次。
3. **【总控→TASK-000-D】** `/admin/dashboard/stats`、`/merchant/dashboard/stats`、
   `/admin/dashboard/revenue-chart` 三处硬编码占位数据仍未替换。
4. **【总控→TASK-000-D/F】** `/products/category-counts` 全 0 但商品确实存在（§6.3）。
5. **【总控】** `npm run build` 在本项目**不存在**，正确脚本是 `build-prod`；
   若有文档/脚本写错了，建议一并修正。
6. **【总控】** 建议把 §8 的「复制到独立目录再编译」写进 `DEVELOPMENT.md` ——
   当前只有「跑测试前先停后端」一条，少了编译期这条同样致命的。