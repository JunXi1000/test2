# TASK-001-B0 · 真实链路验收方案与用例矩阵

> **产出人**:测试 Agent(`qa-acceptance`) · **任务**:TASK-001-B0(task-3) · **状态**:方案定稿,等待 Lead 放行执行 TASK-001-B(task-5)
> **锚点**:`git HEAD = f4df6ac` + 工作树 56 个未提交文件(Phase 3 半成品;运行态是否含这批代码由 TASK-001-A/C 判定)
> **本轮范围**:只做「跑通与验收 + 审查」,**不新增任何业务功能**;本 Agent **只报 Bug,不修 Bug**(§26.16)
> **写范围**:本文件 `docs/TASK-001/06a-TEST-PLAN.md`(执行阶段只写 `06-TEST-REPORT.md`,如需新增 `web/tests/*.spec.ts` 先向 Lead 申请)

---

## 0. 三句话给 Lead

1. **本方案的每一项期望值都已从代码读出,不是照文档抄**。§6「已知事实表」逐条标注了代码位置与行号:凡「🔴 占位」项,迁移应用后**仍然**是假数据 —— 期望值必须写成「与迁移前一致」,否则会把「未实现」误判成「本次引入的 Bug」(这正是 §7 要防的事)。
2. **`web/tests/*.spec.ts` 是 mock 模式,e2e 全绿与本任务零关系**。真实联调链路上唯一的自动化是**没有自动化**;B 阶段的所有 HTTP 证据都由本 Agent 用 `curl`/`docker exec -i mysql` 亲手取原始报文。
3. **已提前发现 3 条高危契约缺口(纯静态分析,执行阶段必复现)** —— 见 §9。它们不需要环境就能定位代码位置,但**结论等级必须等真实环境复现后才写进缺陷清单**:`C-04`(结算页优惠码不入账,前端展示额与实扣额系统性不等)、`C-05`(购物车/结算页折扣叠加口径)、`C-06`(`/payments/create` 的 `amount` 字段被后端忽略,篡改无效但**静默**)。

---

## 1. 验收目标与判定口径

### 1.1 三条验收问题(本轮的交付物只回答这三个)

| # | 问题 | 判定方式 | 交付位置 |
|---|---|---|---|
| Q1 | 当前工作树 + 完整 schema 组合起来,**站点能不能真的跑通**? | 买家主链路端到端实打 + 后台页面实打 | `06-TEST-REPORT.md` §2 |
| Q2 | `docs/MODULES.md` §2 的「看似实现、实为占位」清单,逐条到底是**真实数据 / 假数据 / 500 报错**? | 端点响应 vs DB 聚合交叉验证 + 响应体与种子常量比对 | `06-TEST-REPORT.md` §3 |
| Q3 | 授权、越权、边界异常这几条**资损/安全线**守住了没有? | 未登记端点 403 / 跨域角色 / 对象级越权 4xx / 边界输入 | `06-TEST-REPORT.md` §4 |

### 1.2 通用断言标准(沿用 TASK-000-F1 §4.4,本轮采纳为总纲)

> **返回体里任何业务字段的值,都必须能由数据库复算得出。**

| 响应形态 | 判定 |
|---|---|
| 值 == DB 聚合 / DB 行(误差 0.01 内) | ✅ **真实数据** |
| `0` / 空数组 / `null` /空串,**且 DB 侧确实为空** | ✅ **诚实的可接受结果**(不算 Bug) |
| `0` / 空数组 / `null`,但 **DB 侧非空** | 🔴 **Bug:静默失效** |
| 常量(`4.5`、`"Unknown"`、`"< 1 hour"`、`$0`、`+0%`),且 DB 无法复算 | 🔴 **Bug:硬编码假数据** |
| 任何 5xx | 🔴 **Bug:服务端错误**(除非用例本意就是触发未处理路径 → 仍需报,等级视影响) |

### 1.3 「存量遗留」与「本次引入」的区分(硬要求)

本轮运行态 = 工作树 56 个未提交文件 + V6~V11 迁移。**同一份代码的「未实现」不是本次引入的缺陷**。

| 分类 | 定义 | 在报告中的处置 |
|---|---|---|
| **本次引入** | 在 `git HEAD`(f4df6ac)上不存在、仅因本轮未提交改动/迁移而产生的失败 | 必须给 复现 + 代码位置 + 归属 Agent |
| **存量遗留** | 改动前就存在(§6 已知事实表里标 🔴/🟡 的占位与 no-op 属此类) | 记入清单,标 `存量`,**不作为「本轮阻断」**,但必须写清「本轮未修」 |
| **环境/非产品** | 服务未重启、库未迁移、构建非当前源码、端口占用 | **不算产品 Bug**,记入环境阻塞项并交 Lead |

> ⚠️ **迁移应用 ≠ 功能生效**:V6/V7/V8/V10 建的表与列,在 Java 侧**没有任何引用**(§6 已静态确认)。因此「迁移后钱包/设置/审核就真实了」是**错误预期**,执行时若按此预期断言,会产出至少 6 条误报。

---

## 2. 风险清单(执行前必须记住)

| # | 风险 | 证据 | 对执行的约束 |
|---|---|---|---|
| R1 | `web/tests/*.spec.ts` 一律 mock 模式 | `web/playwright.config.ts` 的 `storageState` 注入 `localStorage.RUNTIME_USE_MOCK='true'` | e2e 结果**只能**用于「前端自身行为回归」,不得作为联调证据 |
| R2 | `RUNTIME_USE_MOCK` 的 localStorage 覆盖**只在 dev 构建生效** | `web/src/config/env.ts`:`import.meta.env.DEV ? getRuntimeMockValue() : null` | 手工走浏览器必须走 **dev server(5173)**;若走 `vite preview`/`dist`,localStorage 里的残留 `RUNTIME_USE_MOCK='true'` **不被读取**,反而安全但结论不同 |
| R3 | dev server 下 localStorage 残留会静默切 mock | 同 R2 + `web/.env` 已是 `VITE_USE_MOCK=false` | 每次真实链路执行前**必须先清站点数据**;证据里附 `localStorage.getItem('RUNTIME_USE_MOCK')` 的取值截图/DOM 读取 |
| R4 | e2e 会往 `localhost:5173` 写 mock 残留 | Playwright `reuseExistingServer: !CI` | **先跑 e2e、后跑真实链路**;顺序颠倒会污染真实链路 |
| R5 | 运行态可能是过期代码 | Lead 侦察 F5(JVM ~15:31 启动 vs 源码 20:13–20:15) | B 阶段开工前必须复核 A2 的重启证据(新端点不再 404/500) |
| R6 | 库可能未迁移 | Lead 侦察 F3(仅 23 张表) | B 阶段开工前必须复核 A2 的 `show tables` 表数证据 |
| R7 | 前端多处 mock 数据是**硬编码常量**,真实模式下可能整块消失 | `merchantWallet.ts` / `merchantSettings.ts` / `adminDashboard.ts` / `adminSettings.ts` 的 `MOCK_*` | 后台页面「显示 0/空」要区分是**前端 mock 未生效**还是**后端返回 0**;证据必须是 Network 原始响应 |
| R8 | Windows + PowerShell 引号地狱 | Lead 已踩坑 | 一律**先写临时 `.sh` 文件再 `bash`**,MySQL 一律 `"..." | docker exec -i nexus-dev mysql ... -N`(stdin) |
| R9 | H2 与 MySQL 行为差异 | 后端测试全跑 H2 `MODE=MySQL` | H2 全绿不构成 MySQL 链路通过;反之 H2 红也需在 MySQL 上复核再定性 |

---

## 3. 环境契约与前置检查(执行阶段第 0 步)

### 3.1 环境契约

| 项 | 期望值 | 取证方式 |
|---|---|---|
| 容器 | `nexus-dev` Up,端口 1000/5173/3306 已发布 | `docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'` |
| 后端就绪 | `GET /` 收到 **HTTP 响应**(401 亦算就绪) | `curl -sS -o /dev/null -w '%{http_code}' http://localhost:1000/` |
| 前端就绪 | `GET /` → 200 | 同上,5173 |
| 代理 | 5173 的 `/api/x` → 1000 的 `/x`(rewrite 去前缀) | `curl -sS -i http://localhost:5173/api/products?page=1&limit=1` 与直连 `http://localhost:1000/products?...` 对比 |
| 数据库 | `template_v3`,迁移后表数 **> 23** | `"show tables;" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N | wc -l` |
| 账号 | `admin` / `user1` / `shop1`,密码均 `123456` | 三方各自 `POST /common/login` 拿 token |
| 运行态版本 | 含工作树 Phase 3 代码(A2 重启后) | `/products/{id}/bought-together`(工作树新增端点,HEAD 无)返回 200 而非 404 |

### 3.2 取 token 的标准姿势(所有 HTTP 用例的前置)

```bash
# 直连后端(不带 /api);type 取 USER / SHOP / ADMIN
curl -sS -X POST http://localhost:1000/common/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"user1","password":"123456","type":"USER"}'
# → {"code":200,"msg":"...","data":"<JWT>"}  ← data 就是裸 token 字符串
```

后续请求头:`-H "Authorization: Bearer $TOKEN"`。

### 3.3 证据目录约定(执行时创建,不入库)

```
/tmp/qa-b/            # 容器内
  tokens/{user1,shop1,admin}.txt
  resp/<CASE-ID>.json        # 原始响应体
  resp/<CASE-ID>.http        # curl -i 原始报文(含状态行与响应头)
  resp/<CASE-ID>.req         # 实际发出的请求(方法/路径/头/体)
  sql/<CASE-ID>.sql.out      # 对应 SQL 原始输出
```
> 报告里引用证据时,一律写 **用例 ID + 状态码 + 关键响应片段原文 + SQL 原文**,不写「符合预期」四个字收尾。

### 3.4 前置检查门(任一不过 → 不进入 B,先回 Lead)

| 门 | 条件 |
|---|---|
| G1 | 容器锁已由 Lead 明确移交,且 env-verifier 已停止所有 `docker exec` |
| G2 | A2 报告 `08b-MIGRATION-APPLY.md` 已存在,表数 > 23,重启后有就绪证据 |
| G3 | C(`07-CODE-REVIEW.md`)verdict ≠ fail(若 fail,A2 应转上报,不得先斩后奏) |
| G4 | 本机站点数据已清:`localStorage.removeItem('RUNTIME_USE_MOCK')` 已执行并留证 |
| G5 | `git status --short` 快照已存(证明 B 阶段未改任何业务文件) |

---

## 4. 验收矩阵(A 面:买家主链路,真实后端 + 关 mock)

> **列说明**:ID / 用例 / 输入 / 期望(带来源) / 证据形式 / 状态。
> **状态**列在 B0 一律为 `待执行`;B 阶段就地改写为 `PASS` / `FAIL(BUG-xx)` / `BLOCKED(原因)`。
> **期望来源**:`code` = 读源码得出,附 `文件:行`;`doc` = 文档声明(需代码交叉确认);`db` = DB 复算。

### 4.1 认证与会话(AUTH)

| ID | 用例 | 输入 | 期望(来源) | 证据 |
|---|---|---|---|---|
| AUTH-01 | 管理员登录 | `POST /common/login {username:"admin",password:"123456",type:"ADMIN"}` | 200;`data` 为非空 JWT 串;JWT payload 的 `currentUser.type == "ADMIN"`(`code`:CommonController L59) | 原始响应 + token 三段解码 |
| AUTH-02 | 买家登录 | 同上 `type:"USER"`,`user1` | 200;`type=USER`,`id=1`(`db`:schema.sql L248) | 同上 |
| AUTH-03 | 商家登录 | 同上 `type:"SHOP"`,`shop1` | 200;`type=SHOP` | 同上 |
| AUTH-04 | 错误密码 | `user1` + `wrong` | **409**;`msg`/`data` 含具体原因(`code`:CustomException 默认 `CONFLICT`;`http.ts` 折算 `data`) | 原始响应(状态行 + body 原文) |
| AUTH-05 | 不存在用户 | `nosuchuser` + 任意密码 | 409(不得 500、不得 200) | 同上 |
| AUTH-06 | 注册买家 | `PUT /common/register {type:USER,username:<新邮箱>,password,nickname,email}` | 200;`user` 表新增 1 行,`status=启用`;密码为 BCrypt 哈希(**不得**明文) | 响应 + `select id,username,status,password from user order by id desc limit 1` |
| AUTH-07 | 注册商家 | `PUT /common/register {type:SHOP,username,nickname,name,aptitudeImgs}` | 200;`shop` 表新增 1 行(`code`:auth.ts 的 SHOP 分支带 `name`/`aptitudeImgs`) | 响应 + `select * from shop order by id desc limit 1` |
| AUTH-08 | 重复用户名注册 | 用已存在 `user1` 再注册 | 拒绝(409 系列),**不得**产生第二行 | 响应 + `select count(*) from user where username='user1'` |
| AUTH-09 | 登录态取当前用户 | `GET /common/currentUser` + Bearer | 200;`type`/`id` 与登录一致;`avatarUrl` 字段名与 `auth.ts userFromBackendDto` 对齐 | 原始响应 |
| AUTH-10 | 改密码后旧密码失效 | `POST /common/updatePassword` → 旧密码登录 / 新密码登录 | 旧密码 409,新密码 200 | 两次登录原始响应 |
| AUTH-11 | 找回密码链路 | `POST /common/sendResetCode {type,tel}` → `POST /common/retrievePassword {type,tel,code,password}` | 已知缺口:前端发 `email` 语义、后端按 `tel` 处理(`docs/MODULES.md` §3.4) | 请求体 + 响应 + `user` 表密码哈希变化 |
| AUTH-12 | 未登录访问受保护端点 | `GET /common/currentUser` 无 token | **401**;响应体为 `{code:401,msg:...,data:...}` JSON(**不得**空 body)(`code`:LoginInterceptor L~76) | `curl -i` 原始报文 |
| AUTH-13 | 畸形 JSON | `POST /common/login` body = `{` | **400**「请求体格式不正确」(`code`:GlobalExceptionHandler handleNotReadable) | 原始报文 |
| AUTH-14 | 方法不支持 | `GET /common/login` | **405**(`code`:handleMethodNotSupported) | 原始报文 |

### 4.2 商品与搜索(STF)

| ID | 用例 | 输入 | 期望(来源) | 证据 |
|---|---|---|---|---|
| STF-01 | 商品列表 | `GET /products?page=1&limit=20` | 200;非空数组;每项 `price`/`stock` 与 `product` 表一致 | 响应 + `select id,name,price,stock from product` |
| STF-02 | 商品详情 | `GET /products/1` | 200;`price=99.00`,`stock=50`(`db`:schema.sql L262) | 同上 |
| STF-03 | 不存在商品 | `GET /products/999999` | 4xx(404 或 409/200 空),**不得 500** | 原始报文 |
| STF-04 | 类型不匹配 | `GET /products/abc` | **400**「参数 id 类型不正确」(`code`:handleTypeMismatch) | 原始报文 |
| STF-05 | 分类计数真实性 | `GET /products/category-counts` | **每一项 == `select count(*) from product where product_type_id=?`**;首项 `All` == `count(*)`。**含 0 件的分类也要出现**(`code`:StorefrontProductController L86 起) | 响应 + 逐分类 SQL |
| STF-06 | 推荐位 | `GET /products/recommend/6` | 200;≤6 项;不得 500(注:个性化权重依赖 `product_collect`/`product_browsing_history`,库空时应**退化为热门**,不得报错)(`code`:product.ts 注释 + MODULES §2) | 原始响应 + `select count(*) from product_collect` |
| STF-07 | 销量榜 | `GET /products/sales-top/5` | 200;按 `sales_volume` 倒序;值 == DB | 响应 + `select id,name,sales_volume from product order by sales_volume desc limit 5` |
| STF-08 | 相关推荐(工作树新增) | `GET /products/1/related?limit=6` | 200(此端点**仅存在于工作树**,可用于判定运行态是否含 Phase 3 代码) | 原始报文 |
| STF-09 | 搭配购买(工作树新增) | `GET /products/1/bought-together?limit=3` | 200;≤3 项 | 原始报文 |
| STF-10 | 完整穿搭(工作树新增) | `GET /products/1/complete-the-look?limit=3` | 200;不同分类优先 | 原始报文 |
| STF-11 | 搜索建议 | `GET /search/suggestions?q=耳` | 200;`keywords`/`products` 结构符合 `SearchSuggestions`(`code`:search.ts) | 原始响应 |
| STF-12 | 趋势(是否仍硬编码) | `GET /search/trending` | 判定三类之一:①真实(与商品名/分类可对应)②硬编码数组 ③空列表。**硬编码关键词(Phone/Laptop/…)即 Bug** | 响应 + `select name from product order by sales_volume desc` |
| STF-13 | 搜索分面 | `POST /search {q,page,limit}` | `facets.categories` 计数 == 关键字命中的 DB 分布;`priceRanges` 桶边界 0/50/200/500/1000/∞;`ratings` 为「及以上」累计口径;`relatedSearches` **同一查询两次调用结果相同**(`doc` backend-api.md §1.2) | 响应 + 两次调用对比 + SQL |
| STF-14 | 分面口径:只应用关键字 | 先 `POST /search {q:X}` 记 categories,再 `POST /search {q:X,category:C}` | 第二次的 `facets.categories` **与第一次相同**(不受已选分类影响)——不同即 Bug(`doc` 同上口径约定) | 两次响应对比 |
| STF-15 | 分类筛选生效 | `POST /search {q:"", category:刻意错误值}` vs `category` 正确值 | 两次结果**必须不同**;相同 = 参数静默失效 | 两次响应对比 |
| STF-16 | 公开店铺 profile | `GET /merchants/1/profile` | `stats.totalProducts` == `select count(*) from product where shop_id=1`;`featuredProducts` 与 DB 可对应;`location`/`responseTime`/`policies` 若为常量 `"Unknown"`/`"< 1 hour"` → 记 Bug(存量) | 响应 + SQL |
| STF-17 | 店铺不存在 | `GET /merchants/999999/profile` | **404**(`doc` backend-api.md §1.9) | 原始报文 |
| STF-18 | 店铺商品 | `GET /merchants/1/products?page=1` | 200;`items` 属 shop_id=1;`categories` 为该店真实分类 | 响应 + SQL |
| STF-19 | 店铺内筛选生效 | `GET /merchants/1/products?q=<商品名片段>` vs 不传 | 两次结果不同 | 两次响应对比 |

### 4.3 购物车(CART)

| ID | 用例 | 输入 | 期望(来源) | 证据 |
|---|---|---|---|---|
| CART-01 | 加购 | `POST /shoppingCart/add {productId:1,quantity:2}`(user1) | 200;`shopping_cart` 新增/合并 1 行(user_id=1,product_id=1,quantity=2) | 响应 + `select * from shopping_cart where user_id=1` |
| CART-02 | 重复加购合并 | 再次 `add {productId:1,quantity:3}` | **同一行**数量 = 5 或被后端明确合并,不得出现两行 | SQL 行数与 quantity |
| CART-03 | 拉取购物车 | `GET /shoppingCart/page?pageNum=1&pageSize=100` | 200;`list` 仅含 user_id=1 的行,含 `productName`/`productPrice`/`productMainImg`(`code`:cart.ts `ShoppingCartRow`) | 响应 + SQL |
| CART-04 | 改数量 | `PUT /shoppingCart/update {id:<rowId>,quantity:7}` | 200;DB quantity=7 | SQL |
| CART-05 | 批量删除 | `DELETE /shoppingCart/delBatch` body=`[<rowId>]` | 200;该行消失 | SQL |
| CART-06 | **未登记端点默认拒绝** | `GET /shoppingCart/list`、`GET /shoppingCart/selectById/1`、`POST /shoppingCart/createOrder` | 三者对 user1 **均 403**(`code`:AuthzRules L74-77 刻意未登记) | 三条原始报文 |
| CART-07 | 对象级越权:改他人行 | user2 登录,`PUT /shoppingCart/update {id:<user1的rowId>,quantity:99}` | 4xx 或**不改动** user1 的行;若 200 且改动 → Blocker | 请求 + user1 行的 SQL 前后对比 |
| CART-08 | 对象级越权:删他人行 | user2 `DELETE /shoppingCart/delBatch` = `[<user1 rowId>]` | user1 的行**仍存在** | SQL 前后 |
| CART-09 | 匿名访问 | 无 token `GET /shoppingCart/page` | 401 | 原始报文 |

### 4.4 结算金额诚信(PAY)-**资损线,最高优先级**

| ID | 用例 | 输入 | 期望(来源) | 证据 |
|---|---|---|---|---|
| PAY-01 | 服务端按 DB 价重算 | `POST /checkout/summary {items:[{productId:1,quantity:2}]}` | `subtotal == 99.00*2 == 198.00`;`total == subtotal - discount`;响应**不含** `shipping`/`tax`(`code`:StorefrontCheckoutController L107-114) | 响应 + `select price from product where id=1` |
| PAY-02 | **篡改 price 被忽略** | 同 PAY-01,但 body 加 `items[0].price=0.01`(甚至 `price:-999`) | `subtotal` **仍为 198.00**;不因前端值变化。判定:被丢弃(静默纠正)或 400,**任一皆可接受**;若 subtotal 变成 0.02 → Blocker | 响应 + 请求体原文 |
| PAY-03 | 篡改 total/amount 被忽略 | body 顶层加 `total:0.01`,`amount:0.01` | `total` 仍按 DB 重算 | 同上 |
| PAY-04 | 空 items | `{items:[]}` / `{}` | **400**「结算商品不能为空」(`code`:L75-77) | 原始报文 |
| PAY-05 | 数量 0 / 负数 | `quantity:0` / `-3` | **400**「结算商品参数不合法」(`code`:L83-85) | 原始报文 |
| PAY-06 | 数量缺失 | 只给 `productId` | **400**(不得静默按 0 → 0 元结算) | 原始报文 |
| PAY-07 | 商品不存在 | `productId:999999` | **404**「商品不存在或已下架」(`code`:L87-89) | 原始报文 |
| PAY-08 | 兼容 `id` 回落 | `items:[{id:1,quantity:1}]`(无 productId) | 200,`subtotal=99.00`(`code`:resolveProductId) | 响应 |
| PAY-09 | 结算 == 实扣(无券) | PAY-01 的 `total` → `POST /payments/create` 同 items | `create` 返回的 `amount` **严格等于** summary 的 `total`;且 `select sum(total_money) from product_order where order_no=?` 相等 | 三次数值并列 |
| PAY-10 | 优惠码校验(DB 真实券) | 先 `POST /coupons/WELCOME10 领取` 语义:`GET /coupons` 取 id → `POST /coupons/{id}/claim`;再 `POST /checkout/promo {code:"WELCOME10",subtotal:198}` | 200;`discount == min(198*10%,20) == 19.80`(`db`:coupon 种子 + CouponService.applyByCode) | 响应 + `select * from coupon where code='WELCOME10'` + `user_coupon` |
| PAY-11 | 未领取的券 | 用未领取用户 `POST /checkout/promo {code:"SAVE20",subtotal:150}` | **400**(未领取)(`code`:Controller L148 注释) | 原始报文 |
| PAY-12 | 未达门槛 | 已领 `SAVE20`(min_order=100),`subtotal=50` | **409**(沿用既有错误码)(`code`:L130 注释) | 原始报文 |
| PAY-13 | 不存在/下架券码 | `{code:"SAVE10",subtotal:100}` | **400**「优惠码无效」;**不得**回退到硬编码 `SAVE10`/`VIP15`(`code`:L146-147 已删除兜底) | 原始报文 |
| PAY-14 | 空 code / 空 subtotal | `{subtotal:100}` / `{code:"X"}` | **均 400**(不得 NPE→500)(`code`:L138-144) | 两条原始报文 |
| PAY-15 | 匿名 promo | 无 token `POST /checkout/promo` | **400**(白名单路径但匿名必 400)(`code`:L123-126) | 原始报文 |
| PAY-16 | **summary 带 code 时与实扣一致** | `POST /checkout/summary {items:[...], code:"WELCOME10"}` | `total == subtotal - 19.80`;随后 `POST /payments/create` **同 code** 的 `amount` 与之相等(`code`:CheckoutSummaryDTO.code + createStorefrontOrder) | 三数值并列 |
| PAY-17 | **前端是否真的传 code**(契约缺口复现) | 静态:读 `web/src/composables/usePaymentFlow.ts` L126-141 与 `web/src/api/modules/checkout.ts calculateOrderSummary` | `createPaymentIntent` payload **不含 `code`**;`calculateOrderSummary` 也不传 code → 手工用前端走一遍「用券结算」,断言实际扣款 > 页面显示 | 源码行号 + 页面显示额截图 + `payment.amount` SQL |
| PAY-18 | 折扣叠加口径 | 页面同时有 `summary.discount` 与 `promoDiscount` 时,读 `useOrderSummary` 的 `prePointsTotal` | `subtotal - summary.discount - promoDiscount` 与后端 `subtotal - discount` 口径是否一致 → 不一致即展示/入账错位 | 源码行号 + 页面数字 + DB |

### 4.5 支付与订单状态机(ORD)

| ID | 用例 | 输入 | 期望(来源) | 证据 |
|---|---|---|---|---|
| ORD-01 | 下单落库 | `POST /payments/create {items:[{productId:1,quantity:2}],channel:"card",shipping:{...}}` | 200;返回 `paymentId==orderId==orderNo`;`clientSecret == null`;`product_order` 生成 N 行共享同一 `order_no`;`payment` 表 1 行 `status=待支付`;`product.stock` **原子扣减 2** | 响应 + 三条 SQL(`product_order`/`payment`/`product.stock`) |
| ORD-02 | 库存不足 | 先 `quantity` > 当前 stock | 4xx 明确报错;库存**不变**(不得回滚一半);不得 500 | 原始报文 + `stock` 前后 |
| ORD-03 | 余额不足(balance 渠道) | `channel:"balance"` 且 userId 余额 < amount | 4xx;不得生成已支付订单 | 原始报文 + `user.balance` |
| ORD-04 | 确认支付 | `POST /payments/confirm {paymentId:<orderNo>}` | 200;`status=succeeded`;`payment.status=已支付`,`paid_at` 非空,`transaction_id` 形如 `TXN-<orderNo>`(`doc` §1.8) | 响应 + `select * from payment where order_no=?` |
| ORD-05 | **重复 confirm 幂等** | 同 ORD-04 连打 3 次 | 每次都 200 `succeeded`;**余额/库存/订单行不再变化**(`payment` 仍单行,`paid_at` 不变) | 3 次响应 + 前后 SQL 全字段对比 |
| ORD-06 | confirm 不存在的单 | `{paymentId:"NOSUCH"}` | 4xx 明确报错(不得 200 succeeded) | 原始报文 |
| ORD-07 | 3DS 回调幂等 | `POST /payments/complete-action {paymentId:<orderNo>,transactionId:"t"}` 二次 | 同 ORD-05;`paymentId` 优先回落顺序与 confirm 相反(`doc` §1.8) | 响应 + SQL |
| ORD-08 | 订单列表分组 | `GET /orders` | 200;按 `order_no` 分组;`totalMoney`/`quantity` 与 DB 行聚合一致;`status` 为中文状态机值 | 响应 + SQL 聚合 |
| ORD-09 | 最近订单 | `GET /orders/recent` | 200;≤N 条,按时间倒序 | 响应 |
| ORD-10 | 订单归属隔离 | `user2` 的 `GET /orders` | **不含** user1 的 order_no | 响应 + user1 的 order_no 清单 |
| ORD-11 | 越权取消他人订单 | `user2` `POST /orders/{user1的orderNo}/cancel` | **4xx**;user1 订单状态不变(`code`:cancelByOrderNo 的 AccessGuard) | 原始报文 + SQL |
| ORD-12 | 用户取消(待支付) | user1 取消自己的待支付单 | 200;订单行 `已取消`;`stock` **回补**;`payment.status=已取消`(无退款) | SQL 前后 |
| ORD-13 | 用户取消(已支付/card) | 取消已支付 card 单 | 200;行 `已取消`;`stock` 回补;`payment.status=已退款`;**`user.balance` 不得增加** | SQL 前后(**重点断言余额不变**) |
| ORD-14 | 用户取消(balance) | 用 `channel:"balance"` 付款后取消 | `user.balance` **按 `total_money` 回补一次**;二次取消不再回补 | SQL 前后 |
| ORD-15 | 取消幂等 | 同单连取消 3 次 | 库存只回补一次;余额只回补一次;不报 500 | 3 次响应 + SQL |
| ORD-16 | 不存在订单取消 | `POST /orders/NOSUCH/cancel` | **404**「订单不存在」(`code`:L302) | 原始报文 |
| ORD-17 | **30min 超时自动取消** | 造数:`update product_order set status='待支付', create_time=now()-interval 40 minute where order_no='<seed>'`,并记录 stock;等待 `OrderTimeoutTask`(60s 一轮) | 轮次内自动:行 `已取消`、`payment.status=已超时`、`stock` 回补;失败需连续观察到 ≥2 个调度周期 | `select ...` 定时前后对比 + 容器日志 `docker logs` 中 task 行为 |
| ORD-18 | 超时任务不误伤未超时单 | 同时存在 `create_time=now()` 的待支付单 | 该单在观察窗口内**保持待支付**,库存不变 | SQL |
| ORD-19 | 买家仪表盘 | `GET /dashboard/stats` | 200;各项可由 `product_order`(user_id=1)聚合复算;`Pending` 口径用减法推导需核(`doc`/TASK-000 §4.5) | 响应 + SQL |
| ORD-20 | 商家状态机合法链路 | `shop1` `PUT /merchant/orders/{id}/status {status:"processing"}` | 200;DB 行状态 `待发货` | 响应 + SQL |
| ORD-21 | 商家状态机非法跃迁 | `待支付` 单直接 `{status:"delivered"}` | **400**,`msg` 带当前状态与允许目标(`doc` §1.11) | 原始报文 |
| ORD-22 | 商家越权改他店订单 | `shop2` 改 `shop1` 的订单 | **403/404**;且**不泄露**目标订单当前状态(归属校验先于状态机)(`doc` §1.11 执行顺序) | 原始报文 + SQL 未变 |
| ORD-23 | 商家订单详情越权 | `shop2` `GET /merchant/orders/{shop1的id}` | 403/404 | 原始报文 |

### 4.6 地址 / 优惠券 / 退换货 / 到货订阅 / 账户(EXT)

| ID | 用例 | 输入 | 期望(来源) | 证据 |
|---|---|---|---|---|
| EXT-01 | 地址列表 | `GET /addresses`(user1) | 200;仅 user_id=1 的行;**字段名与 `Address` 接口一致**(`isDefault` 等) | 响应 + SQL |
| EXT-02 | 新建地址 | `POST /addresses {...}` | 200;DB 新增行 | SQL |
| EXT-03 | 更新地址 | `PUT /addresses/{id}` | 200;DB 字段变化 | SQL |
| EXT-04 | 删除地址 | `DELETE /addresses/{id}` | 200;DB 行消失 | SQL |
| EXT-05 | **默认地址 no-op** | `PUT /addresses/{id}/default` | 判定:①200 且 `is_default` 未变 = **存量占位**(`code`:StorefrontAddressController L56-60 no-op);②500 = Bug;③真实置位 = 已实现(V10 加了列但 Java 未引用 → 预期①) | 原始报文 + `select id,is_default from shipping_address` 前后 |
| EXT-06 | 地址越权 | user2 `PUT /addresses/{user1的id}` / `DELETE` | 4xx 或 user1 行不变 | 原始报文 + SQL |
| EXT-07 | 可领券池 | `GET /coupons` | 200;与 `select * from coupon where status='enabled' and expires_at>now()` 可对应 | 响应 + SQL |
| EXT-08 | 领券 | `POST /coupons/{id}/claim` | 200;`user_coupon` 新增行 | SQL |
| EXT-09 | 重复领券 | 同券再领 | **409**(已领取) | 原始报文 + `user_coupon` 行数不变 |
| EXT-10 | 已领完的券 | 造数 `claimed >= total` | 409 | 原始报文 |
| EXT-11 | 我的券 | `GET /coupons/my-coupons` | 200;含 `isUsed`/`claimedAt`/`expiresAt` | 响应 + SQL |
| EXT-12 | 券核销**真的发生** | 用已领券走 PAY-16 下单 | `user_coupon` 该行被标记已用;**同券二次下单 4xx**(条件 UPDATE 抢占)(`code`:CouponService.redeem) | 响应 + `user_coupon` SQL |
| EXT-13 | 退换货列表/提交 | `GET /returns` → `POST /returns {orderId,productTitle,...,refundAmount}` | 200;`return_request` 落库,`status=pending` | 响应 + SQL |
| EXT-14 | 到货订阅增/查/删 | `POST /stock-alerts` → `GET /stock-alerts/mine` → `DELETE /stock-alerts/{productId}` | 三步各 200;DB 行增/查/删;重复订阅=删旧建新(`doc` §1.13) | 响应 + SQL |
| EXT-15 | 账户资料读写 | `GET /account/profile` → `POST /account/profile {...}` | 200;`user` 表字段变化;`balance` 与 DB 一致 | 响应 + SQL |
| EXT-16 | 通知偏好 upsert | `GET /account/notifications`(无记录默认值) → `POST` → 再 `GET` | 200;`user_notification_pref` upsert 落库 | 响应 + SQL |
| EXT-17 | 通知按角色投递 | admin/shop1/user1 各 `GET /notifications` | 200;各自只看到 `role` 匹配 + 定向的;`read-all` 后未读数归零 | 三条响应 + SQL |
| EXT-18 | 文件上传 | `POST /file/upload`(multipart, 图片) | 200;返回可访问文件名;`GET /file/{name}` 免登录可下载;非图片扩展名 GET 需登录(`code`:LoginInterceptor PUBLIC_IMAGE_EXTENSIONS) | 原始报文 + 落盘文件 |
| EXT-19 | 上传超限 | 上传 > 10MB | **413**(`code`:handleMaxUploadSizeExceeded) | 原始报文 |
| EXT-20 | 聊天会话/发消息/已读 | `GET /chat/conversations` → `POST /chat/messages` → `PUT /chat/conversations/{id}/read` | 三步 200;`conversation`/`message` 落库 | 响应 + SQL |
| EXT-21 | 聊天越权 | user2 读 user1 的 conversation 消息 | 4xx 或空集(**不得**返回他人消息) | 原始报文 + 对比 user1 的真实消息 |

---

## 5. 验收矩阵(B 面:后台真实化逐条判定)

> 这一节是 Q2 的全部。**每条都必须给「真实 / 假数据 / 报错」三选一 + DB 交叉验证**。
> 判定基准取自 §6 已知事实表(**迁移应用后仍成立**)。

### 5.1 管理端(ADM)

| ID | 端点 | 期望(来源) | 交叉验证 SQL | 判定类别 |
|---|---|---|---|---|
| ADM-01 | `GET /admin/dashboard/stats` | 4 卡片由 `AnalyticsService.adminDashboardStats()` 真实聚合:Revenue=累计已支付金额,Active Users=启用用户数,Sales=已支付订单行数,Active Now=近 24h 下单去重用户(`doc` §1.10;`code`:AdminApiController L45) | `select sum(total_money) from product_order where status in ('待发货','待收货','已完成')`;`select count(*) from user where status='启用'`;`select count(*) from product_order where status in (...)`;`select count(distinct user_id) ... and create_time>now()-interval 24 hour` | 真实(需 4 项逐一复算) |
| ADM-02 | `GET /admin/dashboard/revenue-chart?days=7` | 按自然日聚合,无订单日期补 0,`days` 收敛 1~31;`days=999` 应被收敛到 31 | `select date(create_time), sum(total_money) ... group by date(create_time)` | 真实 |
| ADM-03 | `GET /admin/dashboard/recent-users` | `user` 表前 5 条(`code`:L50) | `select nickname,email,create_time from user limit 5` | 真实 |
| ADM-04 | `GET /admin/users?role=all` / `role=user` / 缺省 | 三者都应返回 `user` 表全量;`role=admin`/`role=merchant` → **空集**(刻意,防跨表 id 误删) | `select count(*) from user` | 真实(空集是**设计**不是 Bug) |
| ADM-05 | `GET /admin/users?q=` 生效 | 两种不同 q → 结果不同 | — | 过滤器 |
| ADM-06 | `POST /admin/users/{id}/toggle-status` | 200;`user.status` 在 `启用`/`禁用` 间翻转 | `select id,status from user where id=?` | 真实 |
| ADM-07 | `PUT /admin/users/{id}` / `reset-password` / `DELETE` | 200;DB 同步变化(删除用**新建的测试用户**,不要删种子) | 对应 SQL | 真实 |
| ADM-08 | `GET /admin/merchants` 的 `revenue` | == 该店已支付累计(`code`:analyticsService.revenueByShop()) | `select shop_id,sum(total_money) from product_order where status in ('待发货','待收货','已完成') group by shop_id` | 真实(此前恒 0) |
| ADM-09 | `GET /admin/merchants?status=` 生效 | 两种不同 status → 结果不同 | — | 过滤器 |
| ADM-10 | `POST /admin/merchants/{id}/approve|reject` | 200;`shop.status` 变化 | SQL | 真实 |
| ADM-11 | `GET /admin/products?q=` | `q` 真实下推 SQL;返回含 `description`(= `product.intro`) | SQL 对比 | 真实 |
| ADM-12 | `GET /admin/products?status=` | 判定:迁移后 `product.status` 列存在,但 `Product` 实体无该字段 → ①`active` 返回全部 ②`draft/archived` 返回空集。**若 `hidden`/`draft` 返回全部 → 参数静默失效 = Bug** | `select id,name,status from product` | 半真实/静默(以实测定性) |
| ADM-13 | `DELETE /admin/products/{id}/ban` | 判定是否仍 `setStock(0)` 充当下架;若是,则**买家前台仍可见** —— 用 `GET /products/{id}` 与 `GET /products` 双向验证 | `select id,stock,status from product where id=?` | 已知语义缺口(`doc` §1.10) |
| ADM-14 | `GET /admin/orders?q=` | `q` 真实下推(订单号/商品名/收货人/电话) | SQL | 真实 |
| ADM-15 | `POST /admin/orders/{id}/cancel` | 200;订单与库存/退款按取消规则处理 | SQL | 真实 |
| ADM-16 | `GET /admin/reviews?q=` | `q` 真实下推(id/商品/用户/内容) | SQL | 真实 |
| ADM-17 | `GET /admin/reviews?status=` | 判定:迁移后 `review_status` 列有默认 `visible`,但 `updateReviewStatus` 仍 no-op → `status=visible` 有数据、`status=hidden` **恒空**;**若表里有 hidden 行而响应为空 → Bug** | `select review_status,count(*) from product_order_evaluate group by review_status` | 半真实(存量 no-op) |
| ADM-18 | **`PUT /admin/reviews/{id}` 是否仍 no-op** | 判定三步:①响应 200 ②`select review_status from product_order_evaluate where id=?` 是否变化 ③再 `GET /admin/reviews?status=hidden` 是否能看到它。**响应 200 但 DB 不变 = 假成功 = Bug**(存量) | 三步对比 | 期望=假成功 |
| ADM-19 | `DELETE /admin/reviews/{id}` | 200;行消失 | SQL | 真实 |
| ADM-20 | `GET /admin/settings` | 判定返回的 `siteName` 是否仍是常量 `"Nexus Market"` | `show tables like 'admin_setting'` + `select * from admin_setting` | 期望=硬编码(存量) |
| ADM-21 | **`PUT /admin/settings` 是否仍 no-op** | 改 `siteName` → 200 → 再 `GET` 是否变化 → `admin_setting` 表是否被写。**200 但无持久化 = 假成功 = Bug**(存量) | 三步 + `select * from admin_setting` | 期望=假成功 |
| ADM-22 | 越权:非 ADMIN 访问 `/admin/**` | user1 / shop1 / 匿名 → **403 / 403 / 401** | — | 授权 |
| ADM-23 | 越权:shop1 读写他家数据 | 见 ORD-22/23 | — | 授权 |

### 5.2 商家端(MER)

| ID | 端点 | 期望(来源) | 交叉验证 SQL | 判定类别 |
|---|---|---|---|---|
| MER-01 | `GET /merchant/dashboard/stats` | 4 卡片真实:Total Sales=本店已支付金额,Orders=本店已支付行数,Products=本店在售数,Conversion Rate=已支付/全部×100;`Products` 的 change 固定 `+0%` 是**刻意**(存量指标无历史快照) | 按 `shop_id=1` 聚合 4 条 SQL | 真实(勿把 `+0%` 报成 Bug) |
| MER-02 | `shopId` 只来自 token | 请求带 `?shopId=2` 或 body 里塞 `shopId:2` | 结果**仍为 shop1 数据**;不得因参数变化 | 两次响应对比 |
| MER-03 | `GET /merchant/dashboard/low-stock` | 真实:本店 `stock<=5` 的商品 | `select id,name,stock from product where shop_id=1 and stock<=5` | 真实 |
| MER-04 | `GET /merchant/products?q=` | `q` 生效(两种值结果不同) | SQL | 真实 |
| MER-05 | `GET /merchant/products?status=` | 判定:`active`/`all` → 全部;`draft`/`archived` → 空集。若 `draft` 返回全部 = 静默失效 | `select id,name from product where shop_id=1` | 半真实 |
| MER-06 | 商品 CRUD | 创建/更新/删除各 200 + DB 同步;创建时 `shop_id` **强制取自 token**(body 里传 `shopId:2` 应被覆盖) | SQL + 响应里 `shopId` | 真实(**越权重点**) |
| MER-07 | 改/删他家商品 | `shop2` `PUT/DELETE /merchant/products/{shop1的id}` | **403/404**,且 shop1 商品不变(`code`:AccessGuard.checkOwner) | 授权 |
| MER-08 | `GET /merchant/orders?status=&q=` | 两者均真实下推;`q` 命中订单号/商品名/收货人/电话 | SQL | 真实 |
| MER-09 | `GET /merchant/orders/{id}` | 归属校验;他家 id → 403/404 | 对比 shop1 响应 | 授权 |
| MER-10 | `PUT /merchant/orders/{id}/status` | 见 ORD-20/21/22 | SQL | 真实 |
| MER-11 | `shipped` 是否记录快递单号 | 判定 `tracking_number` 是否仍写 `""`/未写(`doc` §1.11 已知缺口) | `select tracking_number from product_order where id=?` | 期望=不记录(存量) |
| MER-12 | `GET /merchant/wallet` | 判定:代码仍 `balance=0,pending=0,currency="USD"`(**迁移建了表但 Java 无引用**) | `show tables like 'merchant_wallet'` + `select * from merchant_wallet` | 期望=恒 0(存量占位) |
| MER-13 | `GET /merchant/wallet/transactions` | 判定:`Collections.emptyList()` | `select * from merchant_wallet_transaction` | 期望=空(存量) |
| MER-14 | **`POST /merchant/wallet/withdraw`** | 判定:①返回 200 ②`merchant_wallet.balance` 是否变化 ③流水表是否新增。**200 但什么都没发生 = 假成功**(存量,资损语义高风险) | 三步 + 两张表 SQL | 期望=no-op |
| MER-15 | `GET /merchant/settings` | 判定逐字段:`storeName`/`description`/`logo`/`email` **真实(读 shop 表)**;`location` 常量 `"Unknown"`、`responseTime` 常量 `"< 1 hour"`、`policies` 空串、`notifications` 常量 → **后者为硬编码**(`code`:MerchantApiController L283) | `select name,nickname,avatar_url,email from shop where id=1` | 半真实 |
| MER-16 | **`PUT /merchant/settings` 是否 no-op** | 改 `storeName` → 200 → 再 `GET` → `shop` 表是否变化。**200 且无变化 = 假成功**(存量) | 三步 + SQL | 期望=假成功 |
| MER-17 | 越权:MER 端点对 user/admin | user1 → 403;admin → 403;匿名 → 401 | — | 授权 |

### 5.3 前端真实化(浏览器,关 mock)(FE)

| ID | 页面 | 输入 | 期望 | 证据 |
|---|---|---|---|---|
| FE-01 | 首页 | 打开 5173,清 mock 残留 | Network 里 `/api/products?...` → 200 且**响应体是真实商品(无线蓝牙耳机/简约纯棉T恤/智能运动手表)**,非 mock 商品名 | 截图 + Network 原始响应 |
| FE-02 | 首页分类栏 | 同上 | 分类计数与 `category-counts` 响应一致;**不得**全 0(全 0 = `StorefrontProductController` 占位未修 → Bug) | 截图 + 响应 |
| FE-03 | 商品详情 | `/products/1` | 详情/价格为真实 DB 值;`/products/1/related` 等新端点 200(**不得 403/500**) | 截图 + Network |
| FE-04 | 搜索页 | 搜索关键字 | 结果/分面/相关搜索来自 `/api/search`;`trending` 与 `/api/search/trending` 一致 | 截图 + Network |
| FE-05 | 加购→购物车 | user1 登录后加购 | Network 里出现 `/api/shoppingCart/add`;**刷新后购物车仍在**(证明落库,而非 localStorage) | 截图 + SQL |
| FE-06 | 结算页服务端摘要 | 进结算页 | Network `/api/checkout/summary` 200,页面 `subtotal` == 响应值 | 截图 + 响应 |
| FE-07 | 结算页用券 | 输入 `WELCOME10` | `/api/checkout/promo` 200;页面总额下降 | 截图 + 响应 |
| FE-08 | **用券后实扣 vs 显示** | 完成支付,查 `payment.amount` | 判定是否相等;不等 = `C-04` 复现(应 >= 页面显示) | 截图(页面应付)+ `select amount from payment where order_no=?` |
| FE-09 | 支付成功页 | 支付完成 | 跳 `/thank-you?orderId=<orderNo>`;`orderId` 为**真实 orderNo**(非 mock 的 `ORD-xxxx`) | 截图 + URL |
| FE-10 | 我的订单 | `/orders` | 列表来自 `/api/orders`;新订单状态与 DB 一致 | 截图 + SQL |
| FE-11 | 订单取消 | 取消按钮 | `/api/orders/{orderNo}/cancel` 200;列表状态变 Cancelled;DB 同步 | 截图 + SQL |
| FE-12 | 管理端仪表盘 | admin 登录 `/admin` | 4 卡片数字与 `/api/admin/dashboard/stats` 一致;**不得**是 `$45,231.89` 等 mock 常量 | 截图 + 响应 + SQL |
| FE-13 | 管理端收入图 | `/admin` | 有真实数据点/或空数组;ECharts 轴连续 | 截图 + 响应 |
| FE-14 | 管理端设置 | `/admin/settings` | 保存后刷新是否保留;判定是否 no-op | 截图 + `admin_setting` SQL |
| FE-15 | 管理端评论 | `/admin/reviews` | 列表真实;切 `status=hidden` 是否为空 | 截图 + SQL |
| FE-16 | 商家仪表盘 | shop1 `/merchant` | 卡片真实;不得 mock 常量 `$12,450.00` | 截图 + 响应 + SQL |
| FE-17 | 商家钱包 | `/merchant/wallet` | 判定:余额 0 且提现后仍 0(**无任何变化**) = 页面在骗用户 | 截图 + SQL |
| FE-18 | 商家设置 | `/merchant/settings` | 保存后刷新是否保留 | 截图 + SQL |
| FE-19 | 公开店铺页 | `/store/1`(或实际路由) | `stats`/`featuredProducts` 与 `/api/merchants/1/profile` 一致;`location` 是否显示 `Unknown` | 截图 + 响应 |
| FE-20 | 401 会话失效 | 手工把 localStorage token 改成无效值 → 触发任一请求 | **401 → 清会话 → 跳对应登录页并带 `?redirect=`**;不得死循环(`code`:http.ts L39-61) | 截图/Network + URL |
| FE-21 | 未登记端点静默 403 | 触发一个未登记路径(如页面调用 `/shoppingCart/list`) | 403;页面应显示错误态而**非**静默空列表 | Network + 截图 |

---

## 6. 已知事实表(执行时的「预期基准」,全部来自代码,非文档)

> **用法**:B 阶段每条判定先查本表。表里标 🔴 的,「返回假数据」是**已知存量**,不是本次引入;表里标 🟢 而实测假/报错,才是**真 Bug**。

| # | 端点/位置 | 代码事实 | 迁移 V6~V11 是否改变它 | 标记 |
|---|---|---|---|---|
| K1 | `GET /admin/settings`、`PUT` | `AdminApiController` L429/L439:GET 硬编码,PUT no-op(无入参) | ❌ `admin_setting` 表已建但 **Java 0 引用**(全仓 `grep admin_setting` = 0 命中) | 🔴 存量占位 |
| K2 | `PUT /admin/reviews/{id}` | L414:`updateReviewStatus(id)`,**已去掉入参** → 无论传什么都 200 | ❌ `review_status` 列已建,但代码不读不写(仅注释提到) | 🔴 存量 no-op |
| K3 | `GET /merchant/wallet`、`/transactions`、`POST /withdraw` | L259/L268/L273:恒 `balance=0,pending=0`;空列表;no-op | ❌ `merchant_wallet` 表/流水表 **Java 0 引用** | 🔴 存量占位 |
| K4 | `GET/PUT /merchant/settings` | L283 起:storeName/description/logo/email 读 `shop` 表(真实);`location="Unknown"`、`responseTime="< 1 hour"`、`policies={""}`、`notifications` 常量;PUT no-op(无入参) | ❌ `merchant_setting` 表已建、Java 仅在注释里提到 | 🟡 半真实 + 🔴 PUT no-op |
| K5 | `PUT /addresses/{id}/default` | `StorefrontAddressController` L56-60:no-op | ❌ `shipping_address.is_default` 列已建,但 `isDefault`/`is_default` 全仓 0 命中 | 🔴 存量 no-op |
| K6 | `GET /merchant/dashboard/stats` | L71 → `analyticsService.merchantDashboardStats(currentShopId())` | ✅ 真实(与迁移无关) | 🟢 真实 |
| K7 | `GET /admin/dashboard/stats`、`/revenue-chart` | L45/L71 → `analyticsService` | ✅ 真实 | 🟢 真实 |
| K8 | `GET /merchants/{id}/profile` | `StorefrontMerchantController` L54:stats/featured 真实;`location`/`responseTime`/`policies` 需 `merchant_setting` → 未落地前**如实空串** | ❌ merchant_setting 未接 | 🟡 部分真实 |
| K9 | `GET /admin/products?status=` | `Product` 实体**无 `status` 字段**(全仓 `Product.java` 无 status);L267 列表不过滤 stock | ❌ V10 加了列,实体仍未映射 | 🟡 只有 `active` 一档 |
| K10 | `DELETE /admin/products/{id}/ban` | L305:`setStock(0)` 充当下架,而列表不过滤 stock | ❌ V10 的 `status` 列未被使用 | 🟡 语义缺口(被封商品仍前台可见) |
| K11 | 遗留 CRUD 前缀 | `AuthzRules` L92-103:14 个前缀**刻意无规则** → 已登录 403 / 匿名 401。控制器已物理删除,所以正常应是 403/401 而非 404 | — | 🟢 设计如此 |
| K12 | `/shoppingCart/list`、`selectById/{id}`、`createOrder` | `AuthzRules` L74-77 只登记 4 个端点;这 3 个**控制器仍在**但未登记 → 403 | — | 🟢 设计如此 |
| K13 | `/products/{id}/related`、`/{id}/bought-together`、`/{id}/complete-the-look` | `StorefrontProductController` L110/L147/L170 存在;`/products/**` 在 `SpringMvcConfig` 白名单 | — | 🟢 真实(**同时是「运行态是否含工作树代码」的探针**;`docs/backend-api.md` 未登记这三个 → 文档漂移) |
| K14 | `GET /search/trending`、`POST /search` 的 facets | `docs/backend-api.md` §1.2 称已真实化;源文档 `MODULES.md` §2 称硬编码 —— **两处文档冲突**,以实测为准 | — | ⚠️ 需实测定性 |
| K15 | 商家状态机 | `MerchantApiController` L~24:`ALLOWED_TRANSITIONS` 表存在,非法跳转 400 | ✅ | 🟢 真实 |
| K16 | 取消/退款 | `ProductOrderServiceImpl.cancelRows`:条件 UPDATE 抢占;`balance` 渠道才 `topUp`,`card` 只改支付单状态 | ✅ | 🟢 真实 |
| K17 | 30min 超时 | `OrderTimeoutTask`:`@Scheduled(fixedDelay=60_000)`,`TIMEOUT_MINUTES=30`,批量 200 | ✅ | 🟢 真实 |
| K18 | 结算金额 | `StorefrontCheckoutController` L90:一律 `product.getPrice()*qty`;无 code 时 `discount=0` | ✅ | 🟢 真实 |
| K19 | 结算响应字段 | 只回 `subtotal`/`discount`/`discountCode`/`total`;**无 `shipping`/`tax`** | ✅ | 🟢 真实(前端 TS 里这两个字段已标可选) |
| K20 | 未知 JSON 字段 | `StorefrontCheckoutDTO`/`CheckoutSummaryDTO` **无 `price`/`amount` 字段** → Jackson 默认忽略未知字段(无 `FAIL_ON_UNKNOWN_PROPERTIES`) | ✅ | 🟢 篡改无效(静默丢弃) |

---

## 7. 缺陷报告规范

### 7.1 单条缺陷的必填字段

```markdown
### BUG-<编号> · <一句话标题>
- **等级**:Blocker / Major / Minor / Info(判定见 §7.2)
- **归属**:存量遗留 / 本次未提交改动引入 / 环境或非产品
- **模块与端点**:<METHOD> <path>(+ 前端页面/文件:行,若有)
- **环境快照**:容器状态 / 后端就绪码 / 库表数 / 运行态判定(是否含工作树代码) / mock 开关实测值
- **复现步骤**:1) ... 2) ... 3) ...(精确到可粘贴的 curl 与 SQL)
- **预期**(必须给来源:`code 文件:行` / `db` / `doc 文件§`)
- **实际**:状态码 + 响应体原文(截取关键片段,不转述)
- **原始证据**:
  - 请求:`<原始 curl 命令或 .http 片段>`
  - 响应:`<HTTP 状态行 + body 原文>`
  - DB:`<SQL 原文 + 输出原文>`
  - 前端(若适用):Network 截图文件名 / 控制台报错原文
- **影响范围**:哪些角色/页面/资金链路受影响;是否有资损或越权面
- **可能原因**(可选但必须标注「推测」):指向 `文件:行`
- **修复建议**(只写建议,不改代码):最小修法 + 是否需 schema/迁移配合 + 回归影响面
- **回归方式**:修复后如何 5 分钟内复验(具体命令)
```

### 7.2 等级判定(以「影响」而非「好修」定级)

| 等级 | 判定标准 | 本轮示例 |
|---|---|---|
| **Blocker** | ①资损(多扣/少扣/凭空加钱/重复退款)②越权可读写他人数据 ③主链路不可用(下单/支付/取消走不通)④5xx 打断主链路 | 越权改他人订单且生效;重复取消重复退款;`/payments/create` 500 |
| **Major** | ①端点**假成功**(200 但什么都没发生)且用户可见后果 ②展示额 vs 实扣额系统性不等 ③授权缺口(应 403 却 200)④静默失效导致功能完全不可用 | `PUT /admin/settings` no-op;用券后展示≠实扣;`/merchant/wallet/withdraw` 假成功 |
| **Minor** | 交互/文案/契约字段名不一致/文档漂移;有替代路径 | `docs/backend-api.md` 缺 3 个新端点;错误文案笼统 |
| **Info** | 观察项、待确认、设计如此但值得记录 | `role=admin` 返回空集是刻意设计;`Conversion Rate` 的 `+0%` 是如实 |

> **纪律**:「不确定」必须写 `待确认` 并附证据,**不得**直接计为 Bug(沿用 TASK-000-F1 §7 口径,防止把设计当缺陷)。

### 7.3 报告结构(`06-TEST-REPORT.md` 必须包含)

1. 环境快照与准入(§3 的 5 道门逐条结论)
2. 用例结果总表:**总数 / PASS / FAIL / BLOCKED / 未覆盖**,并给一张按模块的通过率表
3. **主链路端到端叙事**:一条真实订单从加购到取消的完整证据链(order_no 贯穿),含每一步状态码与 SQL
4. 后台真实化逐条判定表:每条 `真实 / 假数据 / 报错` + DB 交叉验证**原文**
5. 授权与安全结果矩阵(§8 的表,逐格填状态码)
6. 边界与异常结果
7. 缺陷清单(按 §7.1 格式,按等级排序)
8. **存量失败与本次引入的区分**:对齐 A(`mvn clean test`)与 §6 基准;列「mock 模式 Playwright 结果」但明确标注**它不是联调证据**
9. 未覆盖项与原因(blocked 的逐条给阻塞原因)
10. 结论:能否作为可验收基线 + 下一阶段建议(只建议,不实施)

---

## 8. 授权与安全结果矩阵(逐格填 HTTP 状态码)

**期望值来源**:`AuthzRules`(默认拒绝)+ `SpringMvcConfig`(白名单)。空格在 B 阶段填。

| 端点 | 匿名 | USER | SHOP | ADMIN | 期望来源 |
|---|---|---|---|---|---|
| `POST /common/login` | 200 | 200 | 200 | 200 | 白名单 |
| `PUT /common/register` | 200 | 200 | 200 | 200 | 白名单 |
| `GET /common/currentUser` | **401** | 200 | 200 | 200 | AuthzRules ALL_ROLES |
| `POST /common/resetPassword` | 401 | **403** | **403** | 200 | AuthzRules 仅 ADMIN |
| `GET /products`、`/products/{id}` | 200 | 200 | 200 | 200 | 白名单 |
| `POST /search`、`GET /search/trending` | 200 | 200 | 200 | 200 | 白名单 |
| `GET /merchants/{id}/profile` | 200 | 200 | 200 | 200 | 白名单 |
| `POST /checkout/summary`、`/checkout/promo` | 200 / **400**(promo 匿名必 400) | 200 | 200 | 200 | 白名单 + 应用层校验 |
| `POST /payments/create` | **401** | 200 | **403** | **403** | AuthzRules USER |
| `GET /orders` | 401 | 200 | **403** | **403** | AuthzRules USER |
| `GET /shoppingCart/page` | 401 | 200 | **403** | **403** | AuthzRules USER |
| `GET /shoppingCart/list` | **401** | **403** | **403** | **403** | 刻意未登记 |
| `GET /merchant/dashboard/stats` | 401 | **403** | 200 | **403** | AuthzRules SHOP |
| `GET /admin/dashboard/stats` | 401 | **403** | **403** | 200 | AuthzRules ADMIN |
| `GET /chat/conversations` | 401 | 200 | 200 | **403** | AuthzRules USER/SHOP |
| `GET /notifications` | 401 | 200 | 200 | 200 | ALL_ROLES |
| `GET /file/{name}.jpg` | 200 | 200 | 200 | 200 | 图片 GET 放行 |
| `GET /file/{name}.pdf` | **401** | 200 | 200 | 200 | 仅图片扩展名放行 |
| `GET /product/list`(已删前缀) | **401** | **403** | **403** | **403** | 默认拒绝 |
| `GET /admin-accounts/list` | **401** | **403** | **403** | **403** | 默认拒绝(验证路径段匹配不误命中 `/admin`) |
| `GET /productOrderEvaluate/list` | **401** | **403** | **403** | **403** | 默认拒绝(验证不误命中 `/productOrder`) |
| `GET /nosuchpath` | **401** | **403** | **403** | **403** | 未知路径不暴露存在性 |

### 8.1 token 专项

| ID | 用例 | 输入 | 期望 | 证据 |
|---|---|---|---|---|
| SEC-01 | 无 token | 任一受保护端点 | 401 + JSON body | 原始报文 |
| SEC-02 | 格式错误的 token | `Authorization: Bearer abc` | 401「token 无效」 | 原始报文 |
| SEC-03 | 签名被篡改 | 改 JWT 第三段一位 | 401 | 原始报文 |
| SEC-04 | payload 被篡改(提权) | 把 payload 的 `type` 改成 `ADMIN`,签名不变 | **401**(签名校验失败);**绝不能**以 ADMIN 身份通过 | 原始报文 + 后续 `GET /admin/users` 仍 401 |
| SEC-05 | **过期 token** | 用当前 `JWT_SECRET` 造一个 `exp` 已过的 JWT | **401**;前端 `http.ts` 清会话并跳登录带 `?redirect=`;不得死循环 | 原始报文 + FE-20 截图 |
| SEC-06 | 无 `type` 的 token | payload 去掉 `type` | 403/401(不得放行) | 原始报文 |
| SEC-07 | header 与 query 混用 | 用 `?token=` 传 token | 401(后端**不读** query token;仅 header `token`/`Authorization`) | 原始报文 |

### 8.2 注入与畸形输入

| ID | 用例 | 输入 | 期望 |
|---|---|---|---|
| SEC-10 | SQL 注入(查询串) | `q=' OR '1'='1`、`q=%' UNION SELECT` 在 `/admin/users`、`/products`、`/search` | 正常 200 且**不返回全表/不报 SQL 错**;无 500 |
| SEC-11 | 路径注入 | `/products/1;DROP TABLE product` | 400(类型不匹配)/404;**绝不能** 500 且表仍在(用 `show tables` 复核) |
| SEC-12 | 超长输入 | 用户名/备注/地址/评价内容 10000 字符 | 400 或安全截断,**不得 500**;DB 列不被截断损坏 |
| SEC-13 | 畸形 JSON | `{` / `[]` / `"str"` 作为 body | 400 |
| SEC-14 | 超大 body | 5MB JSON | 4xx(413/400),不得 500 |

---

## 9. 静态分析已定位的契约缺口(执行阶段必须复现取原始证据)

> **这些在 B0 阶段只作为「已知疑点」记录**;等级与最终结论**必须在真实环境复现后**才写入缺陷清单。
> 每条都给「代码位置 + 最小复现 + 判据」。

| ID | 缺口 | 代码位置 | 最小复现 | 判据(算 Bug 的条件) |
|---|---|---|---|---|
| **C-01** | 前端**从不传 `code`** 给 `/payments/create`,而后端只在收到 code 时才核销优惠 | `web/src/composables/usePaymentFlow.ts` L126-141(payload 无 `code`);`createStorefrontOrder` L190 依赖 `dto.getCode()` | 关 mock 走一遍「用券结算」,记录页面应付,再 `select amount from payment where order_no=?` | 若 `amount > 页面显示额` → Major(展示/实扣系统性不等);同时 `user_coupon` 该券**永远不被核销** |
| **C-02** | `calculateOrderSummary` 不传 `code`(该函数签名只有 `items`/`zip`),而后端 `CheckoutSummaryDTO` **已支持** `code` | `web/src/api/modules/checkout.ts` L51-65:`calculateOrderSummary` 的签名与唯一真实请求 `post('/checkout/summary', { items, zip })`(L64)都不含 code;`CheckoutSummaryDTO.code`(后端已加) | 页面输入券码后看 `/api/checkout/summary` 请求体:只有 `{items, zip}` | 请求体无 `code` → 服务端 `summary.discount` 恒 0;页面折扣只来自另一个 `/checkout/promo` 调用 → 两套口径,`summary` 与券折扣无法在服务端合成 |
| **C-03** | 前端把 `summary.discount` 与 `promoDiscount` **相加**后再用,但后端 summary 的 discount 已是「券后」值 | `useOrderSummary.prePointsTotal`;`Checkout.vue` L247 `summary.discount + promoDiscount` | 同时存在阶梯/券折扣时读页面数字 | 若两处折扣来源重叠 → 页面总额低于后端实扣额(Major) |
| **C-04** | `amount` 字段被发送但后端 DTO 无该字段 → 静默丢弃 | `StorefrontCheckoutDTO`(无 amount/price);`ui 前端` payment.ts payload 带 `amount`/`currency` | PAY-02/PAY-03 | 「被忽略」是**正确**结果(不算 Bug),但**无任何提示**属 Info:契约里应删字段或加 `@JsonIgnoreProperties` 明确化 |
| **C-05** | 积分抵扣纯前端(localStorage),后端不参与 | `useOrderSummary` + `stores/loyalty`;`finalizeOrder` L300-303 | 用积分下单,查后端是否有积分字段/表 | 后端无积分记录 → 积分可无限用:Info/Major(取决于是否算本产品承诺功能) |
| **C-06** | `docs/backend-api.md` 未登记 `/products/{id}/related`、`/{id}/bought-together`、`/{id}/complete-the-look` | `StorefrontProductController` L110/L147/L170 | `grep related docs/backend-api.md` = 0 命中 | 文档漂移 → Minor |
| **C-07** | `MODULES.md` §2 与 `backend-api.md` 对同一批端点结论相反(trending/facets/category-counts/dashboard) | MODULES §2 vs backend-api §1.2/§1.10/§1.11 | 逐条实测 | 以实测为准,冲突本身记 Minor(文档不一致) |
| **C-08** | 工作树的 V6~V11 建了表/列,但 Java 侧零引用 → 迁移"生效"但不"改变行为" | §6 K1/K3/K4/K5/K9/K10 | 迁移后逐条打端点 | 若有人在验收里断言"迁移后钱包真实了" → 误报;本方案 §6 已防 |
| **C-09** | `/orders` 的 `subtotal`/`shippingFee`/`tax`/`discount` 在映射里被写死 | `web/src/api/modules/orders.ts` `mapStorefrontOrder` | 看订单详情页的金额明细行 | 页面显示的运费/税/折扣恒 0 或等于总额 → 展示不诚信(Minor/Major) |
| **C-10** | `docs/STARTUP.md` 称 entrypoint 只导入 V1~V5 | `docker/entrypoint.sh`(由 env-verifier 复核) | 读脚本 | 全新 `start.sh` 永久漏 V6~V11 → Major(部署缺口,交 Lead 决策) |

---

## 10. 边界与异常用例(汇总视图)

| ID | 场景 | 期望 | 归属矩阵行 |
|---|---|---|---|
| EX-01 | 结算 `items` 空 / 缺 | 400 | PAY-04 |
| EX-02 | 结算 `quantity` = 0 / 负 / 缺 | 400 | PAY-05/06 |
| EX-03 | 结算 `productId` 不存在 | 404 | PAY-07 |
| EX-04 | 结算传篡改 `price` / `amount` / `total` | 服务端重算,前端值无效 | PAY-02/03 |
| EX-05 | 下单 `quantity` > `stock` | 4xx,库存不变 | ORD-02 |
| EX-06 | `balance` 渠道余额不足 | 4xx,无已支付订单 | ORD-03 |
| EX-07 | `confirm` 重复 3 次 | 幂等,不重复扣款 | ORD-05 |
| EX-08 | `complete-action` 重复 3 次 | 幂等 | ORD-07 |
| EX-09 | 取消重复 3 次 | 库存/余额只回补一次 | ORD-15 |
| EX-10 | 30min 未支付超时 | 自动取消 + 回补库存 + 支付单已超时 | ORD-17/18 |
| EX-11 | 最终态订单再改状态 | 400 | ORD-21 |
| EX-12 | 金额 0 / 负 的券折扣封顶 | `total >= 0`,折扣 ≤ subtotal | PAY-01/16 |
| EX-13 | 并发下单同商品(可选) | 不超卖:成功数 ≤ 库存;`stock >= 0` | 新增(条件允许时做) |
| EX-14 | 空库场景 | 各仪表盘/列表返回 0/空,**不得** NPE/500 | 依赖目标库非空 → 用 `where 1=0` 类查询替代验证口径;真空白库场景标 `未覆盖` |
| EX-15 | 超长输入 | 400 或安全截断,不得 500 | SEC-12 |
| EX-16 | SQL 注入 | 参数化,无 500 | SEC-10/11 |

---

## 11. 现有测试基线与「存量失败 vs 本次引入」

### 11.1 基线(执行时逐条复核,不引用未复核数字)

| 项 | 基线来源 | 期望 | 本轮命令 |
|---|---|---|---|
| 后端 `mvn -B clean test` | TASK-000-F1 §1.1;A(`08-ENVIRONMENT.md`)须复跑 | **155 全绿 / 0 存量失败**(TASK-000-J 后为 163 / 22 类) | `docker exec nexus-dev bash -lc 'cd /workspace && pkill -f "[s]pring-boot:run"; pkill -f "[P]rojectManagement"; mvn -B clean test'` |
| 前端 `vue-tsc --noEmit` | TASK-000-F1 §1.2 | **0 error**(两个 project:src + tests) | `npm run typecheck`(容器内 `web/`) |
| Playwright e2e | TASK-000-F1 §1.2;存量 `7 spec / 193 test` | **运行时未知**,本轮首次取真值 | `npm run test:e2e`(容器内 `web/`;**必须先于真实链路执行**,且**其结果不是联调证据**) |
| Vitest 单测 | 存量 `13 spec / 184 test` | 运行时未知 | `npm run test:unit` |
| 构建 | A 的 `mvn -B clean test` + `npm run build` | 见 `08-ENVIRONMENT.md` | 引用 A 的原始输出并标注是否复跑 |

### 11.2 分类口径

| 情形 | 处置 |
|---|---|
| 失败用例在 §6 基准表里已是 🔴 占位 | 记 **存量遗留**,不阻断 |
| 失败用例在 `git HEAD` 独立检出上同样失败 | 记 **存量遗留**,附 A 的对拍证据 |
| 失败用例只在当前工作树上失败 | 记 **本次引入**,必须给归属与最小修法建议 |
| 后端 H2 红而 MySQL 绿(或反之) | 记 `待确认` + 注明 H2/MySQL 差异(R9),不直接定性 |
| 环境原因(未重启/未迁移/clone 竞态) | 记 **环境阻塞**,不算产品 Bug |

> ⚠️ TASK-000-F1 §2 ENV-1 记载过「139/147 集体 ERROR」的两个独立根因(Mapper XML 裸 `<` / Mockito inline mock maker 无法自附加)。若本轮再现**大面积 ERROR**,先按这两条排查再定性:
> 1. `src/main/resources/mapper/*.xml` 是否良构(裸 `<` 应为 `&lt;`);
> 2. `src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker` 是否存在且为 `mock-maker-subclass`。

---

## 12. 执行顺序与容器锁纪律

```
[Lead 移交锁] → G1..G5 前置门 → 建证据目录 + 环境契约(§3.1)
   ↓
① 后端测试基线:mvn -B clean test(必须先停容器内 dev 后端,否则 clean 删不掉被占用的 target/)
   ↓
② 前端基线:typecheck → test:unit → test:e2e(mock 模式;此步会污染 5173 的 localStorage)
   ↓
③ 清 mock 残留 + 重启/确认 dev server 与后端为同一批代码
   ↓
④ HTTP 层:A 面矩阵(§4)+ B 面后台(§5)+ 授权矩阵(§8)+ 边界(§10)    —— 全部 curl + mysql 原始证据
   ↓
⑤ 浏览器层:FE 用例(§5.3)—— 只做 HTTP 覆盖不到的(页面渲染、Network、401 跳转、页面显示额 vs 实扣)
   ↓
⑥ 汇总:区分存量/本次引入 → 写 06-TEST-REPORT.md → §26.7 结构化返回 Lead
   ↓
[锁交回 Lead]
```

**硬约束**:
- 只报 Bug 不修 Bug;不得修改 `src/main/java`、`web/src`、`sql/`、`docker/`。
- 默认只写 `docs/TASK-001/06-TEST-REPORT.md`;要新增 `web/tests/*.spec.ts` **先向 Lead 申请**。
- 进容器前后各留一次 `git status --short` 快照,证明 B 期间无业务文件被改。
- 每条证据必须可复现:报告里的 curl 命令必须原样可从 `/tmp/qa-b/` 复跑。

---

## 13. 结论与放行请求

**B0 交付物**:本文件 `docs/TASK-001/06a-TEST-PLAN.md`。

| 项 | 状态 |
|---|---|
| 验收矩阵(模块 × 用例 × 预期 × 证据形式) | ✅ §4(买家/商品/搜索/购物车/结算/支付/订单/扩展)、§5(管理端/商家端/前端) |
| 主链路用例 | ✅ §4.1–4.5,含金额由服务端重算与篡改 price 用例(PAY-02/03) |
| 后台用例 | ✅ §5,对照 §6 已知事实表逐条标注「真实/占位」期望 |
| 授权安全用例 | ✅ §8(含未登记 403 / 角色不跨域 / 对象级越权 / token 过期 401) |
| 边界异常用例 | ✅ §10(库存不足、金额 0/负、重复 confirm 幂等、30min 超时) |
| 缺陷报告规范 | ✅ §7(Bug/复现/预期/实际/影响/可能原因/修复建议/归属/等级/证据 + 分级标准) |
| 基线对齐口径 | ✅ §11(存量失败 vs 本次引入的判定表) |
| 静态已定位疑点 | ✅ §9(10 条,含代码位置与最小复现,结论待实测) |

**放行请求**:请 Lead 在 TASK-001-A2 完成后,明确通知「环境就绪、容器锁移交 qa-acceptance」并附 `08b-MIGRATION-APPLY.md` 的表数/重启证据。收到放行后我按 §12 顺序执行,产出 `docs/TASK-001/06-TEST-REPORT.md`。

**等待期间不做的事**:不碰容器、不改任何业务文件、不提前断言 §9 中任何一条的等级(避免在未迁移的库上产出伪缺陷)。
