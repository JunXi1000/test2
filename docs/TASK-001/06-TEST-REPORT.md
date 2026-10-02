# TASK-001-B · 真实后端端到端验收报告与缺陷清单

> **产出人**:测试 Agent(`qa-acceptance`) · **任务**:TASK-001-B(task-5) · **锚点**:`HEAD=f4df6ac` + 工作树 56 个未提交文件
> **执行时点**:2026-10-01 21:10–21:25(容器内) · **容器锁**:由 Lead 于本轮移交本 Agent,报告完成后已交回
> **只报 Bug 不修 Bug(§26.16)**:本轮**未修改** `src/main/java`、`web/src`、`sql/`、`docker/`,任何文件。所有数据变更均通过 API 端点产生(注册/加购/下单/支付/取消),**无任何直连 SQL 写库、无 DDL、无迁移**(与 Lead 授权边界一致)。
> **原始证据**:282 个 HTTP 原始报文(`-i` 含状态行/响应头/响应体)与全部 SQL 输出落于容器 `/tmp/qa-b/resp|out`;本报告逐条引用其原文。本仓库内留存的取证脚本见 `docs/TASK-001/_b-evidence/`。

---

## 0. 给 Lead 的三句话

1. **主链路能跑通,但有一个功能性 Blocker**:`/checkout/promo` 与 `/checkout/summary?code=` 对**任何**请求(含合法登录态)**恒返回 400「请先登录后再使用优惠码」**,原因是这两个白名单路径不经 `LoginInterceptor`,`CurrentUserThreadLocal` 为空 → `CouponServiceImpl:114-115` 判定 userId==null。**同一张券经 `/payments/create` 可以正常核销**(实测 198→178.20,`user_coupon` 置 used),证明券逻辑本身是好的,坏的只是这两个入口 → **优惠券在真实链路上完全不可用**。
2. **购物车页金额与服务端实扣不一致**:当前真实购物车(5×99 + 1×199 = 694.00),`Cart.vue` 显示 **689.52**(自加运费/税/前端满减),而 `/checkout/summary` 与服务端实扣均为 **694.00** → **页面少显示 4.48,下单时按 694.00 扣**。这与本批改动「后端删掉运费/税、结算页已对齐、**购物车漏改**」一致(Lead 已定性)。
3. **平台/商家营收环比是错的**:库中近 30 天已支付 ¥99.00、前 30 天 ¥0.00,但 `Total Revenue.change` 显示 `+0.0%`(应为 +100% 或 N/A)。根因经源码+SQL 双向确认:`AnalyticsMapper.xml:13-21` 的 `paidOrderFilter` 只有 `create_time >= #{since}` **没有上界**,`previousStart` 窗口是 `recentStart` 窗口的**超集** → 分子分母相等 → 恒 0(有更早营收时甚至会变负)。**Lead 独立复核的这条属实。**

**其余结论**:授权与对象级越权**全部守住**(21 条矩阵仅 6 条 DIFF,且 6 条全是用例构造问题,详见 §5);token 安全守住(过期/篡改签名/提权/无 type 全部 401-403);并发不超卖、并发 confirm/取消幂等**均通过**;**后台仍有 4 处 200 假成功**(商家设置/提现、管理端设置、账户通知偏好)。

---

## 1. 环境快照与准入门

| 门 | 证据(原始) | 结论 |
|---|---|---|
| G1 容器锁 | Lead 明确移交;执行期无其他成员 `docker exec` | ✅ |
| G2 就绪 | `docker ps` → `nexus-dev Up 6 hours 0.0.0.0:1000->1000, 0.0.0.0:5173->5173, 127.0.0.1:3306->3306`;`curl -o /dev/null -w %{http_code} http://localhost:1000/` → **401**(就绪判据:收到真实 HTTP 响应);`http://localhost:5173/` → **200** | ✅ |
| G3 代理链路 | `http://localhost:5173/api/products?page=1&limit=1` → **200**;直连 `http://localhost:1000/products?page=1&limit=1` → **200**(rewrite 去 `/api` 正确) | ✅ |
| G4 库状态 | `select count(*) from information_schema.tables where table_schema='template_v3'` → **23**(**V6~V11 未应用,与本轮 Lead 裁决一致**) | ✅ 已记录为环境约束 |
| G5 运行态含工作树代码 | `/products/1/related` → **200**(该端点仅存在于工作树,HEAD 无);JVM `lstart = Thu Oct 1 21:03:44 2026`;**源码 mtime `2026-10-01 20:14:49`** → 运行态 = 当前工作树 | ✅ |
| G6 无业务文件改动 | 本 Agent 只写 `docs/TASK-001/06-TEST-REPORT.md` 与 `_b-evidence/`(取证脚本),见 §10 | ✅ |

**未按 Lead 要求复跑的三项(引用 A 结论,原因已注明)**:

| 项 | A 阶段结论(引用) | 未复跑原因 |
|---|---|---|
| `mvn -B clean test` | 171 run / 11 failures / 1 error(`StorefrontPromoTest` 10F+1E、`RequestShapeTest` 1F) | 复跑需先 `pkill` 后端,会毁掉本轮唯一可用的真实环境(Lead 明确禁止) |
| `vue-tsc` / `build-prod` | src 与 test 两 project 各 0 错误;`build-prod` rc=0 | 已有实证,不重复消耗 |
| Playwright e2e(mock 模式) | 存量 7 spec / 193 test,**运行时未知** | 见 §7:已尝试,结果如实标注 |

**关键环境事实(必须写进任何结论)**:`src/test/resources/schema-h2.sql` **已含** V6~V11 的表/列/索引,而真实 MySQL 库**没有** ⇒ **`mvn test` 全绿不能证明真实库就绪**;反之,真实库的缺失项也不会让 H2 报错。本报告的「真实/假数据」判定**只以 MySQL 实测 + API 原始响应为准**。

---

## 2. 用例结果总表

| 面 | 用例数 | PASS | FAIL(缺陷) | BLOCKED/未覆盖 | 说明 |
|---|---|---|---|---|---|
| A 认证与会话(AUTH) | 13 | 13 | 0 | 0 | 登录/注册/改密外均已实测;见 §3.1 |
| B 商品与搜索(STF) | 16 | 14 | 1(B-11) | 1(商品评价子系统无数据) | STF-05/07/13/14/18 等**真实** |
| C 购物车(CART) | 9 | 8 | 1(B-2) | 0 | 未登记端点 403 全中 |
| D 结算金额诚信(PAY) | 15 | 12 | 1(B-1) | 2(券核销二期) | 篡改 price **被服务端忽略** |
| E 支付与订单(ORD) | 18 | 17 | 1(B-3) | 1(超时任务窗口) | 幂等/回补/越权**全中** |
| F 买家扩展(EXT) | 17 | 14 | 1(B-6) | 2(默认地址无列/B-5) | 退换货/到货订阅/通知**落库真实** |
| G 管理端(ADM) | 19 | 15 | 2(B-3/B-5) | 2(评价无数据、封禁需测) | 仪表盘/收入图/用户/商家**真实** |
| H 商家端(MER) | 15 | 11 | 3(B-4/B-5/B-8) | 1(快递单号) | 仪表盘/归属校验**真实** |
| I 授权与安全(SEC) | 21×4 格 + 10 | 全部符合预期 | 0 | 0 | 见 §5、§6 |
| J 边界与并发(EX) | 16 | 13 | 0 | 3(超时/余额充值/空库) | 不超卖 + 幂等**通过** |
| K 前端浏览器(FE) | 21 | — | — | **本轮未执行**(见 §7) | 全部以 HTTP 层等价用例替代取证 |

**总计**:HTTP 层实测 **181** 个用例点(PASS 130 / FAIL 10 / BLOCKED&未覆盖 41),取原始证据 **282** 份 HTTP 报文。**无 5xx 出现在预期路径上**(唯一一次 500 是我自己的脚本缺陷造成的空 ID 请求,见 §9 附录)。

---

## 3. 买家主链路端到端(真实订单证据链)

**贯穿单号**:`NO202610012112228995`(下单→支付→幂等→取消→库存回补 全链路同号)

| 步骤 | 请求 | HTTP | 原始响应(节选原文) | DB 交叉验证 |
|---|---|---|---|---|
| 注册 | `PUT /common/register {type:USER,username:qa_b_...,password:123456,nickname:QA验收用户,email:...}` | **200** | `{"code":200,"msg":"操作成功","data":null}` | `user` 新增 1 行:`5 qa_b_1790860342 QA验收用户 qa_b_1790860342@test.com 启用 $2a$10$…`(BCrypt,**非明文**) |
| 重复注册 | 同 username 再注册 | **409** | `{"code":409,"msg":"用户名已存在","data":"用户名已存在"}` | `select count(*) from user where username='…'` → **1** |
| 登录 | `POST /common/login {username,password,type:USER}` | **200** | `{"code":200,"msg":"操作成功","data":"<JWT 393 chars>"}`(**JWT 在 `data` 字符串,不是 `token` 字段**) | — |
| 错误密码 | `password=wrong` | **409** | `{"code":409,"msg":"用户名或密码错误","data":"用户名或密码错误"}` | — |
| 浏览 | `GET /products/1` | 200 | `price:99.00, stock:50, name:无线蓝牙耳机` | `select id,price,stock from product where id=1` → `1 99.00 50` |
| 加购 | `POST /shoppingCart/add {productId:1,quantity:2}` | 200 | `{"code":200,…}` | `shopping_cart` 行:`6 1 1 5`(见 §3.1 说明) |
| 结算 | `POST /checkout/summary {items:[{productId:1,quantity:2}]}` | 200 | `{"subtotal":198.0,"discount":0,"discountCode":null,"total":198.0}` | `99.00 × 2 = 198.00` ✅ |
| 下单 | `POST /payments/create {items,channel:card,shipping}` | 200 | `{"amount":198.0,"orderId":"NO202610012112228995","paymentId":"NO202610012112228995","clientSecret":null}` | `product_order`:1 行 `198.00 待支付`;`payment`:1 行 `198.00 card 待支付`;`stock 50→48`(原子扣减) |
| 支付 | `POST /payments/confirm {paymentId:NO…28995}` | 200 | `{"status":"succeeded","orderId":"NO202610012112228995"}` | `payment.status=已支付`,`transaction_no=TXN-NO202610012112228995`,`paid_time=2026-10-01 21:12:23`;订单行 → `待发货` |
| 幂等×2 | 同请求再打 2 次 | 200 / 200 | 同上 | `payment` 行数仍 1,`transaction_no`/`paid_time` 不变;订单未重复;余额未变 |
| 查单 | `GET /orders`(新用户) | 200 | `[{orderNo:"NO…28995",status:"待发货",totalMoney:198.0,quantity:2,consigneeName:"QA User",items:[…]}]` | 与 DB 一致 |
| 越权取消 | `POST /orders/NO…28995/cancel`(**user2**) | **403** | `{"code":403,"msg":"无权操作该订单","data":"无权操作该订单"}` | 目标单仍 `待发货`(未变) |
| 本人取消 | 同上(**本人**) | 200 | `{"code":200,…}` | 行 → `已取消`;`payment.status=已退款`;**`stock 47→49`(回补 2)**;**余额不变**(card 渠道不回余额) |
| 取消幂等×2 | 再取消 2 次 | 200 / 200 | 同上 | `stock` 仍 **49**(只回补一次);余额仍 0.00 |

### 3.1 期间的旁证(直接回答 B-3/B-4)

**(a) 服务端按 DB 价重算,篡改无效(PAY-02/ORD-01b)**

```
REQ  POST /checkout/summary  {"items":[{"productId":1,"quantity":2,"price":0.01}],"total":0.02,"amount":0.02}
RESP HTTP/1.1 200  {"code":200,"msg":"操作成功","data":{"total":198.00,"discountCode":null,"subtotal":198.00,"discount":0}}
REQ  POST /payments/create   {"items":[{"productId":1,"quantity":1,"price":0.01}],"amount":0.01,"currency":"USD",...}
RESP HTTP/1.1 200  {"code":200,"msg":"操作成功","data":{"amount":99.00,"orderId":"NO202610012112222337",...}}
DB   product_order → NO202610012112222337  1  1  99.00  待支付
```
→ 前端传的 `price`/`total`/`amount` **被静默忽略**(DTO 无这些字段,Jackson 丢未知字段),金额一律按 `product.price × quantity` 重算。**这条是好的**;契约上属「未声明的容忍字段」(Info,见 B-12)。

**(b) 结算 == 实扣 == DB 行(AC-04)**:`summary.total = 198.00` → `payments/create.amount = 198.00` → `Σ product_order.total_money = 198.00`。✅

**(c) 购物车页价 ≠ 结算/实扣(B-4,缺陷)**
```
真实 cart: shopping_cart 行 6(产品1×5 @99) + 5(产品3×1 @199)  → subtotal = 694.00
Cart.vue 口径 (源码常量 FREE_SHIPPING_THRESHOLD=200, SHIPPING_FEE=12, TAX_RATE=0.08, TIERS=[100→10,200→30,300→60]):
   shipping=0(>=200 免邮)  tax=55.52  tieredDiscount=60
   → 页面 total = 689.52
POST /checkout/summary  → {"subtotal":694.0,"discount":0,"total":694.0}     ← 无 shipping/tax 字段
POST /payments/create   → {"amount":694.0,"orderId":"NO202610012117249012"}
DB payment.amount = 694.00 ; DB Σ product_order.total_money = 694.00
差异: 页面 689.52 vs 实扣 694.00 = -4.48(用户被少显示 4.48)
```

**(d) 优惠券入口恒 400(B-1,Blocker)** — 同一用户、同一券、同一 token:

| 端点 | 请求 | 结果 |
|---|---|---|
| `POST /checkout/promo` | `{"code":"WELCOME10","subtotal":198}` + `Authorization: Bearer <有效 JWT>` | **HTTP 400** `{"code":400,"msg":"请先登录后再使用优惠码"}` |
| `POST /checkout/summary` | `{"items":[{"productId":1,"quantity":2}],"code":"WELCOME10"}` + 同一 token | **HTTP 400** 同消息 |
| `POST /payments/create` | `{"items":[{"productId":1,"quantity":2}],"code":"WELCOME10",...}` + 同一 token | **HTTP 200** `{"amount":178.20,...}` → `user_coupon.status: unused → used`;同一张券再用 → **400「该优惠券已使用」**;未领取的 SAVE20 → **400「您未领取该优惠券」** |

DB 佐证:`user_coupon` → `1 5 1 used`;`payment.amount = 178.20`(= 198 − 198×10%,cap 20);`Σ product_order.total_money = 178.20`。**券逻辑正确,入口不可用。**

---

## 4. 后台真实化逐条判定表(真实 / 假数据 / 报错)

> 判定标准:`值 == DB 聚合` → 真实;`常量且 DB 无法复算` → 假数据;`5xx` → 报错。

### 4.1 管理端

| 端点 | 实测值 | DB 交叉验证 | 判定 |
|---|---|---|---|
| `GET /admin/dashboard/stats` | `Total Revenue $99.00 / Active Users 5 / Sales 1 / Active Now 1`,`change=+0.0%/+100%/+100%/+0` | 已支付 `sum=99.00`,`count=1`,`count(*) user where status='启用'=5`,`count(distinct user_id) 近24h=1` | **value 真实**;`Total Revenue.change` **错误**(见 B-3,应 +100%/N/A) |
| `GET /admin/dashboard/revenue-chart?days=7` | `09-25..10-01` 逐日,仅 `2026-10-01 = 99.0`,其余 0 | `select date(create_time),sum(...) group by 1` → 仅 `2026-10-01 99.00` | ✅ 真实(补 0 正确);`days=999` 收敛为 31 点 ✅ |
| `GET /admin/dashboard/recent-users` | 5 行 `user/体验用户二/测试用户/QA×2` | `select nickname,email,create_time from user order by id limit 5` **逐字一致** | ✅ 真实 |
| `GET /admin/users?role=all\|user\|缺省` | 各 5 行(= user 表全量) | `count(*)=5` | ✅ 真实 |
| `GET /admin/users?role=admin` | `[]` | `admin` 表另存,刻意空集 | ✅ **设计如此,不得报 Bug**(文档已说明防跨表 id 误删) |
| `GET /admin/users?q=` | `q=qa_b`→2 行;`q=zzz_nomatch`→0 行 | — | ✅ 过滤器生效 |
| `GET /admin/merchants` | 2 行,`revenue: 0` | 已支付按店聚合为空(0 笔) | ✅ 真实(0 是诚实值) |
| `GET /admin/merchants?status=pending` / `active` | `[]` / 2 行 | `shop.status` 两行均 `启用` | ✅ 过滤器生效 |
| `GET /admin/products?q=` | `q=耳机`(percent-encoded)→ 1 行「无线蓝牙耳机」,含 `description` | `product.intro` | ✅ 真实 |
| `GET /admin/products?status=active` / `draft` | 3 行 / **0 行** | **库中 `product.status` 列不存在**(`information_schema` 计数 0) | 🟡 **部分真实**:`draft` 空集是如实(无该列),但 `active` 恒等于全表 → 见 B-8(Minor) |
| `GET /admin/orders?q=` | `q=ZZUNIQUENAME`→1(`ORD-4`);`q=xyz不存在`→0;无 q→4 | 4 行订单,收货人可区分 | ✅ 过滤器真实生效 |
| `GET /admin/reviews` / `?status=visible\|hidden` | 全 `[]` | `product_order_evaluate` 共 **0 行**(种子无评价) | ⚠️ **无法判定**:表为空 → 三条评论用例 **BLOCKED** |
| `PUT /admin/reviews/{id}` | `PUT /admin/reviews/1`(不存在)→ **200 成功** | 表空,无行可验 | ⚠️ BLOCKED(但「不存在的 id 返回 200」本身可疑,见 B-16 未确认项) |
| `GET /admin/settings` | `{"siteName":"Nexus Market","maintenanceMode":false,"allowRegistrations":true,"commissionRate":5.0}` | `admin_setting` 表**不存在** | 🔴 **硬编码假数据**(B-5) |
| `PUT /admin/settings` `{"siteName":"QA-PROBE-SITE"}` → 再 GET | 200 / 再 GET 仍 `"Nexus Market"` | 表不存在,无任何写入 | 🔴 **200 假成功**(B-5) |

### 4.2 商家端

| 端点 | 实测值 | DB 交叉验证 | 判定 |
|---|---|---|---|
| `GET /merchant/dashboard/stats` | `Total Sales $99.00 / Orders 1 / Products 3 / Conversion Rate 16.7%`,change `+0.0%/+100%/+0%/+100.0%` | shop1 已支付 `sum=99.00,count=1`;全单 6;商品 3 → `1/6=16.7%` | **value 真实**;`Total Sales.change=+0.0%` 同上错误(B-3);`Products +0%` 是**刻意**(文档已说明) |
| `GET /merchant/dashboard/stats?shopId=2` | 与不带参**完全一致**(shop1 数据),`Products 3` | — | ✅ **shopId 只取自 token,参数无效但不泄露** |
| `GET /merchant/dashboard/low-stock` | `[]` | 本店无 `stock<=5` | ✅ 真实 |
| `GET /merchant/products?status=active/draft` | 3 / 0 | 本店 3 个商品 | 🟡 同 ADM(B-8) |
| `POST /merchant/products` body 带 `shopId:2` | 200,返回 `"shopId":1` | DB `4 QA探针商品 12.34 7 1` | ✅ **归属强制取自 token** |
| `PUT /merchant/products/4`(**shop2**) | **403** `无权操作该商品` | DB 未变 | ✅ 对象级越权守住 |
| `GET /merchant/settings` | `storeName/description/logo/email` 真实(读 `shop`);`location:"Unknown"`、`responseTime:"< 1 hour"`、`policies:{shipping:"",returns:""}`、`notifications:{email:true,push:false,sms:true}` | `shop1 → 一号数码旗舰店 / 店长一号 / shop@test.com` | 🟡 半真实(后者 4 项常量) |
| `PUT /merchant/settings` `{"storeName":"QA-PROBE-STORE"}` → 再 GET | 200 / 再 GET 仍 `一号数码旗舰店` | `shop` 表未变 | 🔴 **200 假成功**(B-4) |
| `GET /merchant/wallet` | `{"balance":0,"pending":0,"currency":"USD"}` | `merchant_wallet` 表**不存在** | 🔴 **硬编码假数据**(B-5) |
| `GET /merchant/wallet/transactions` | `[]` | 流水表不存在 | 🔴 恒空(B-5) |
| `POST /merchant/wallet/withdraw {"amount":100}` → 再 GET | 200 / 钱包仍 `balance:0`,无流水 | 无表,无任何写入 | 🔴 **200 假成功,提现请求被静默吞掉**(B-5) |
| `GET /merchant/orders` / `GET /merchant/orders/{id}`(shop2 取 shop1 id=2) | 200 列表 / **403** | 订单 2 未变 | ✅ |
| `PUT /merchant/orders/2/status {status:shipped}`(**shop2**) | **403** `无权操作该订单` | 订单 2 仍 `待支付` | ✅ **归属校验先于状态机**(与文档一致) |

### 4.3 店铺公开页 / 买家仪表盘

| 端点 | 实测值 | DB 交叉验证 | 判定 |
|---|---|---|---|
| `GET /merchants/1/profile` | `stats:{totalProducts:2, totalSales:16, rating:0, totalReviews:0, satisfactionRate:0, followers:0}`,`featuredProducts` 2 项,`location`/`responseTime`/`policies` 空/空 | `count(product where shop_id=1)=2`;`Σ sales_volume=11+5=16`(top3 11+5) | ✅ **真实**(rating 0 因无评价,符合「无评价必须 0」) |
| `GET /merchants/999999/profile` | **404** `{"code":404,"msg":"店铺不存在"}` | — | ✅ |
| `GET /merchants/1/products` | `total:2, categories:["All","数码产品","服装"]` | 与该店真实分类一致 | ✅ 真实 |
| `GET /dashboard/stats`(买家) | `Total Orders 3 / In Transit 0 / Pending 1 / Completed 0` | 该用户 `已取消 2 / 待支付 1` | ✅ 真实(3=总,1=Pending) |
| `GET /orders` / `/orders/recent` | 只含本人 2 单;user1 列表 **0 单** | `user_id=1` 无订单 | ✅ **归属隔离守住** |

### 4.4 账户 / 地址 / 退换货 / 到货订阅 / 通知

| 用例 | 实测 | DB 交叉验证 | 判定 |
|---|---|---|---|
| `GET /addresses`(新用户→空) | `[]` → POST 后 `[{id:2,name:QA,…}]` | `shipping_address: 2 5 QA 测试路9号` | ✅ 新建真实 |
| `POST /addresses` 响应体 | `{"id":2,"name":"QA","tel":null,"address":…}` | — | ⚠️ **响应缺 `isDefault`/`type`/`city`/`zip` 字段**(前端 `Address` 接口要求)→ Minor(B-11) |
| `PUT /addresses/2/default` | **200** | `shipping_address.is_default` 列**不存在**,无任何变化 | 🔴 **200 假成功**(B-9) |
| `DELETE /addresses/1`(**新用户删 user1 的地址**) | **403** `无权操作该收货地址` | 地址 1 仍在 | ✅ 对象级越权守住 |
| `GET /returns` → `POST /returns` | `[]` → `{"id":"1",…,"status":"pending","refundAmount":198.0}` | `return_request: 1 5 NO…28995 pending 198.00` | ✅ **真实落库** |
| `POST /stock-alerts` → `GET /mine` → `DELETE /2` | 200 / 1 项 / 200 | `stock_alert` 增 `1 5 2 q@q.q` → 删后 `0` | ✅ **真实** |
| `GET /account/profile` | `{"firstName":"QA验收用户","lastName":"","phone":null,"avatar":null,"email":"…"}` | `user.nickname/email` | 🟡 与前端 `AccountProfile` 期望字段集不同(Minor,B-11) |
| `GET /account/notifications` | `{"emailOrder":true,"emailPromo":false,"smsOrder":true}` | `user_notification_pref` 列 = `email_order/email_promo/sms_order` | ✅ 读取真实 |
| `POST /account/notifications {"email":true,"push":false,"sms":true}`(前端形状) | **200** | 表**未变化**,返回值也未变 | 🔴 **200 假成功 + 静默吞掉**(B-6) |
| `POST /account/notifications {"emailOrder":false,"emailPromo":true,"smsOrder":false}`(后端形状) | 200 | 表变为 `0/1/0`,GET 同步 | ✅ 后端形状真实 |
| `GET /notifications`(user/shop/admin) | 各 200,各 1 条 | 种子按 role 广播 3 条 | ✅ 真实 |

---

## 5. 授权与安全结果矩阵

**期望值来源**:`AuthzRules`(默认拒绝)+ `SpringMvcConfig.excludePathPatterns`(白名单)。

| 端点 | 期望(匿名/USER/SHOP/ADMIN) | 实测 | 结论 |
|---|---|---|---|
| `GET /products` | 200/200/200/200 | 200/200/200/200 | ✅ |
| `GET /merchants/1/profile` | 200×4 | 200×4 | ✅ |
| `GET /common/currentUser` | 401/200/200/200 | **401/200/200/200** | ✅ |
| `GET /orders` | 401/200/403/403 | **401/200/403/403** | ✅ |
| `GET /shoppingCart/page` | 401/200/403/403 | **401/200/403/403** | ✅ |
| `GET /shoppingCart/list`、`/selectById/1` | 401/403/403/403 | **401/403/403/403** | ✅ 刻意未登记 |
| `GET /merchant/dashboard/stats` | 401/403/200/403 | **401/403/200/403** | ✅ |
| `GET /admin/dashboard/stats` | 401/403/403/200 | **401/403/403/200** | ✅ |
| `GET /chat/conversations` | 401/200/200/403 | **401/200/200/403** | ✅ |
| `GET /notifications` | 401/200/200/200 | **401/200/200/200** | ✅ |
| `GET /product/list`(已删前缀) | 401/403/403/403 | **401/403/403/403** | ✅ 默认拒绝 |
| `GET /admin-accounts/list` | 401/403/403/403 | **401/403/403/403** | ✅ **路径段匹配不误命中 `/admin`** |
| `GET /productOrderEvaluate/list` | 401/403/403/403 | **401/403/403/403** | ✅ **不误命中 `/productOrder`** |
| `GET /nosuchpath-xyz` | 401/403/403/403 | **401/403/403/403** | ✅ 不暴露存在性 |
| `POST /common/login`、`POST /search` | 白名单 | **400 ×4** | ⚠️ **用例构造问题**:无 body 的 POST 被 `@RequestBody` 拒 → 与授权无关,非缺陷 |
| `POST /common/resetPassword`、`POST /payments/create` | 见矩阵 | ADMIN → **400**、USER → **400** | ⚠️ 同上(无 body)。**鉴权层已在 body 解析前放行**(401/403 正确) |
| `GET /file/x.jpg` / `x.pdf` | 200×4 / 401+200×3 | **404 ×4** / **401/404/404/404** | ⚠️ **文件不存在**导致 404;`x.pdf` 匿名 401 证明「仅图片扩展名放行」**生效** |

**结论:21 条授权矩阵中 15 条逐格精确命中;6 条 DIFF 全部由「空 body」或「文件不存在」造成,无一例授权缺口。零越权。**

### 5.1 token 专项(SEC)

| 用例 | 输入 | 实测 | 结论 |
|---|---|---|---|
| 无 token | `/common/currentUser` | **401** `{"code":401,"msg":"未登录或登录已过期"}` | ✅ |
| 格式错误 | `Bearer abc` | **401** `token无效，请求被拦截` | ✅ |
| 签名被篡改 | 第三段改一位 | **401** 同上 | ✅ |
| payload 提权 + 原签名 | `type:ADMIN` | **401**(签名失配) | ✅ |
| **过期 token** | 用容器 `JWT_SECRET` 现造 `exp = now-60s`(自检:重签真实 token 签名**匹配**) | **401** 同上 | ✅ **过期路径确实返回 401** |
| **过期 1 天** | 同上 | **401** | ✅ |
| 无 `type`(签名有效) | 自造 | **403** `无权限访问该接口`;/admin 同 | ✅ fail-closed |
| query 传 token | `?token=<有效>` | **401**(后端只读 header) | ✅ |
| 伪造 `type:ADMIN`(签名有效) | 自造(已有密钥) | 200 返回 ADMIN 数据 | ℹ️ **预期**:持有密钥即可签发;说明**密钥泄露=完全失守**(见 B-17 建议) |

---

## 6. 边界与并发(EX)

| 用例 | 输入 | 实测 | 结论 |
|---|---|---|---|
| 空 items | `{"items":[]}` / `{}` | **400** `结算商品不能为空` | ✅ |
| quantity=0 / -3 / 缺 | 三种 | **400** `结算商品参数不合法` | ✅ |
| 商品不存在 | `productId:999999` | **404** `商品不存在或已下架` | ✅ |
| 兼容 `id` 回落 | `{"id":1,"quantity":1}` | **200** `subtotal:99.0` | ✅ |
| 库存不足 | product3 库存 20,下单 25 | **409** `库存不足`;`stock 20→20`;无订单产生 | ✅ |
| balance 余额不足 | 用户余额 0,`channel:balance` 下单 99 → confirm | 下单 200(建待支付);confirm **409** `余额不足`;`balance` 仍 0.00;`payment` 未变 | ✅ **不凭空加钱** |
| `confirm` 不存在的单 | `paymentId:NOSUCH-ORD` | **404** `支付单不存在` | ✅ |
| **并发下单不超卖** | 8 线程 × 3 件,库存 20 | 6×200 + 1×409 + 1×**400(我方脚本临时文件竞态,见 §9)**;`stock 20→2`;成功件数 18 ≤ 20;**`stock ≥ 0`** | ✅ **不超卖** |
| **并发 confirm 幂等** | 6 线程同一支付单 | 6×200;`payment` 单行 `已支付`;`transaction_no` 唯一;订单行 1;库存只扣一次 | ✅ |
| **并发取消幂等** | 5 线程同单 | 5×200;`stock 26→28`(**只回补一次**);`payment=已退款` | ✅ |
| 不存在订单取消 | `POST /orders/NOSUCH/cancel` | **404** `订单不存在` | ✅ |
| 30min 未支付超时 | 库中无 `create_time > 30min` 的待支付单(最早订单 21:12,任务周期 60s,需 30min 窗口) | **BLOCKED**:制造该前置需直接 `UPDATE` 时间戳,超出授权边界(禁止直连 SQL 写库) | ⚠️ **能力确认**:`OrderTimeoutTask` 存在且 `create_time >= 21:03:44` 之前无单 → 调度器已运行但无可观察效果;**代码级确认**(`TIMEOUT_MINUTES=30`,`fixedDelay=60_000`,`selectPendingBefore`) | 
| 余额渠道退款回补 | 需要 `balance > 0` 的用户;`PUT /admin/users/{id} {"balance":500}` **不生效**(实测 balance 仍 0.00,`User` 实体无 balance 绑定) | **BLOCKED** | ⚠️ 已覆盖「余额不足」负路径;正路径(扣款+回补)未验证 |
| SQL 注入 | `q=' OR '1'='1` 等 | 未单独构造(过滤器已用真实关键字验证,MyBatis `#{}` 参数化) | ⚠️ 部分未覆盖 |
| 超长输入 / 5MB body | — | **未覆盖**(时间/预算取舍) | ⚠️ |

---

## 7. 前端与测试基线

| 项 | 结果 | 说明 |
|---|---|---|
| `mvn -B clean test` | **引用 A:171 run / 11 failures / 1 error** | 未复跑(会毁掉真实环境)。失败项 `StorefrontPromoTest` 10F+1E、`RequestShapeTest` 1F。**注意**:`StorefrontPromoTest` 失败与本报告 **B-1** 同域(券),H2 侧该测试的失败**可能**与真实链路 400 同源或不同源 → 建议 code-reviewer/Lead 交叉核对 |
| `vue-tsc` / `build-prod` | **引用 A:0 error / rc=0** | 未复跑 |
| Playwright e2e(mock) | **已跑:`140 passed (2.1m)`,exit 0**(容器内 `cd /workspace/web && npx --no-install playwright test --reporter=line`,Playwright 1.62.1) | 存量 7 spec 中实际执行 140 例(注:TASK-000-F1 记载的 193 例为更早期数字,当前树为 140)。**全部运行在 mock 模式**,因此**它证明的是「前端自身行为在 mock 下未回归」,不是联调通过**;`webServer` 复用了容器内已在跑的 :5173 |
| 前端真实化(FE-01..21) | **未执行浏览器自动化** | 容器内无 headless 浏览器可用性的确定性证据;所有 FE 用例已用**等价的 HTTP 层用例**取证(响应体 + DB),浏览器独有项(页面渲染、401 跳转、`localStorage` 残留)列为**未覆盖** |
| `RUNTIME_USE_MOCK` 残留风险 | 静态确认:`web/src/config/env.ts` 的 `runtimeMock` **仅在 `import.meta.env.DEV` 生效**;`web/.env` 已是 `VITE_USE_MOCK=false`;`web/playwright.config.ts` 的 `storageState` 会注入 `RUNTIME_USE_MOCK='true'` | **若先跑 e2e 再手工验收同一浏览器会静默切 mock** — 本轮全走 curl,不受影响 |

---

## 8. 缺陷清单

> 分级标准:Blocker=资损/越权/主链路不可用/5xx;Major=200 假成功且用户可见后果、展示与实扣系统性不等、授权缺口;Minor=契约/文档/交互;Info=观察项。
> 「归属」按 Lead 三层归因:「本次未提交改动引入」/「本批后端契约先行、前端待接(未完成项,非回归)」/「存量缺陷」。

---

### B-1 · 优惠券在真实链路上完全不可用:`/checkout/promo` 与 `/checkout/summary?code=` 对合法登录态恒 400

- **等级**:**Blocker**(功能完全不可用,占位/破损的 P0 用户功能)
- **归属**:**本次未提交改动引入(回归)** —— `StorefrontCheckoutController` 的 `code` 支持与 `CouponServiceImpl` 的登录校验为本批新增;但根因(`/checkout/**` 在白名单里、`LoginInterceptor` 不跑)是既有配置与新增校验的**组合失效**
- **影响范围**:买家结算页「优惠码」功能 100% 不可用;`/coupons`、`/coupons/my-coupons`、`/coupons/:id/claim` 均正常,唯独**兑换入口**死掉;服务端 `CouponService` 逻辑本身正常(见证据),因此**风险集中在两个入口**
- **复现步骤**:
  1. `TOKEN=$(curl -sS -X POST http://localhost:1000/common/login -H 'Content-Type: application/json' -d '{"username":"user1","password":"123456","type":"USER"}' | python3 -c 'import json,sys;print(json.load(sys.stdin)["data"])')`
  2. 领券:`curl -sS -X POST http://localhost:1000/coupons/1/claim -H "Authorization: Bearer $TOKEN"` → 200
  3. `curl -sS -i -X POST http://localhost:1000/checkout/promo -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"code":"WELCOME10","subtotal":198}'`
  4. `curl -sS -i -X POST http://localhost:1000/checkout/summary -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"items":[{"productId":1,"quantity":2}],"code":"WELCOME10"}'`
  5. 对照:`curl -sS -X POST http://localhost:1000/payments/create -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"items":[{"productId":1,"quantity":2}],"code":"WELCOME10","channel":"card","shipping":{"name":"x","tel":"1","address":"a","city":"b"}}'`
- **预期**(来源 `code`):步骤 3 应 200 并返回 `discount=19.80`,`title=New User Discount`;步骤 4 应 200 且 `total=178.20`(`StorefrontCheckoutController.java:133-158`、`:97-107`)
- **实际**(原始报文):
  ```
  HTTP/1.1 400
  {"code":400,"msg":"请先登录后再使用优惠码","data":"请先登录后再使用优惠码"}
  ```
  步骤 5 却成功:`HTTP/1.1 200 {"code":200,"msg":"操作成功","data":{"amount":178.20,"orderId":"NO202610012117449725","paymentId":"NO202610012117449725","clientSecret":null}}`,且 DB `user_coupon.status: unused → used`;同券再用 → 400「该优惠券已使用」;未领券 → 400「您未领取该优惠券」
- **DB 证据**:`select uc.id,uc.user_id,uc.coupon_id,uc.status,c.code from user_coupon uc join coupon c on c.id=uc.coupon_id` → `1 | 5 | 1 | used | WELCOME10`;`select order_no,amount from payment` → `NO202610012117449725 | 178.20`
- **可能原因**(已定位,非推测):
  - `config/SpringMvcConfig.java` 将 `/checkout/summary`、`/checkout/promo` 列入 `excludePathPatterns` → `LoginInterceptor` **不执行** → `CurrentUserThreadLocal` 不被填充;
  - `StorefrontCheckoutController.java:165-168` 的 `currentUserId()` 从该 ThreadLocal 取值 → **恒 null**;
  - `CouponServiceImpl.java:114-115` 在 `userId == null` 时抛 400「请先登录后再使用优惠码」。
  - 反证:`/payments/create` **不在**白名单 → 拦截器填充用户 → 券核销成功。
- **修复建议**(只建议):两个入口都需要在**白名单路径上显式解析 Bearer token**(例如给 `LoginInterceptor` 增加「可选鉴权」模式:白名单路径仍解析 token 填充 ThreadLocal,但不强制 401;或在这两个 controller 方法内解析 `Authorization`)。**不要**把这两个端点从白名单移除 —— 会破坏未登录访客的结算预览。修复后需回归 `StorefrontPromoTest`(A 阶段 10F+1E)。
- **回归方式**:重跑上述 5 步,期望步骤 3 返回 `discount:19.80`、步骤 4 返回 `total:178.20`,且 `user_coupon` 在步骤 5 后置 used。
- **关联**:§3.1(d);本批前端 `checkout.ts`/`usePaymentFlow.ts` 均**不发送** `code`(Lead 已定性为「后端契约先行、前端待接」),故**即使修好 B-1,前端页面仍不会用到券** —— 两件事需一起排期。

---

### B-2 · 购物车页金额低于实际扣款(少显示 4.48):`Cart.vue` 仍在自算运费/税/前端满减

- **等级**:**Blocker**(资损线:展示额 < 实扣额,用户按页面金额决策)
- **归属**:**本次未提交改动引入(回归)** —— 本批把运费/税从前端结算页与后端契约中移除,但**漏改 `Cart.vue`**(Lead 已定此归属)
- **影响范围**:所有登录买家的购物车页;差异随小计与满减档变化(本例 -4.48;小计 < 200 时还会多算 $12 运费,方向上可正可负,均属展示不实)
- **复现步骤**:
  1. user1 加购:产品 1 ×5(@99)、产品 3 ×1(@199) → `shopping_cart` 两行
  2. 打开购物车页(5173)读页面总额;或按 `Cart.vue:22/31/32/35-36/58-61` 常量复算
  3. `curl -sS -X POST http://localhost:1000/checkout/summary -H 'Content-Type: application/json' -d '{"items":[{"productId":1,"quantity":5},{"productId":3,"quantity":1}]}'`
  4. 下单:`POST /payments/create` 同 items + `cartItemIds`
  5. 查 `select amount from payment where order_no='<返回的 orderNo>'`
- **预期**:购物车页总额应等于服务端 `summary.total`(结算页已是此口径,后端契约 `StorefrontCheckoutController.java:107-114` 只回 `subtotal/discount/discountCode/total`)
- **实际**:
  ```
  Cart.vue 口径: shipping=0(≥200 免邮) tax=55.52 tieredDiscount=60 → total = 689.52
  POST /checkout/summary → {"subtotal":694.0,"discount":0,"discountCode":null,"total":694.0}
  POST /payments/create  → {"amount":694.0,...}   orderNo=NO202610012117249012
  DB payment.amount = 694.00 ; DB Σ product_order.total_money = 694.00
  差异 = 689.52 − 694.00 = −4.48
  ```
- **原始证据**:`POST /checkout/summary` 响应体(见上);`POST /payments/create` 响应体;SQL `select amount,channel,status from payment where order_no='NO202610012117249012'` → `694.00 card 待支付`;`select sum(total_money) from product_order where order_no='NO202610012117249012'` → `694.00`
- **可能原因**:`web/src/pages/Cart.vue:12`(`getTieredDiscount`)、`:22`(`TAX_RATE=0.08`)、`:31`(运费)、`:58-61`(`subtotal + shipping + tax − discount − tieredDiscount`)仍在用本批已被移除的口径;`checkout.ts` 的 `DISCOUNT_TIERS`/`getTieredDiscount` 仍在导出并被引用。
- **修复建议**:`Cart.vue` 改为与结算页同源 —— 调 `/checkout/summary` 取服务端 `subtotal/discount/total`,删除运费/税/前端满减的展示行(与后端契约一致)。回归:`Cart.vue` 相关 e2e(mock 下 `getTieredDiscount` 仍被 `checkout.spec.ts` 覆盖,注意别把 mock 断言一起删)。
- **回归方式**:购物车页总额 == `/checkout/summary.total` == `payment.amount`。

---

### B-3 · 平台/商家营收环比恒 0(或负):`paidOrderFilter` 时间窗缺上界

- **等级**:**Major**(运营指标错误;不涉资损,但对外报表不可信)
- **归属**:**本次未提交改动引入** —— `AnalyticsMapper.xml` / `AnalyticsServiceImpl.java` 为本批新增(Lead 已独立复核 82-84 行属实)
- **影响范围**:`/admin/dashboard/stats` 的 `Total Revenue.change`;`/merchant/dashboard/stats` 的 `Total Sales.change`;**value 本身正确**,仅 change 错
- **复现步骤**:
  1. 令库中存在近 30 天已支付、前 30 天为 0 的样本(本环境:1 笔 99.00,`create_time=2026-10-01 21:15:16`)
  2. `curl -sS -H "Authorization: Bearer $ADMIN" http://localhost:1000/admin/dashboard/stats`
  3. `curl -sS -H "Authorization: Bearer $ADMIN" http://localhost:1000/admin/dashboard/revenue-chart?days=7`
- **预期**:`Total Revenue.change` = `(99.00 − 0.00) / 0.00` 无定义 → 应显示 `+100%`(若把 0 视为基数 0 则应为 `N/A`/`—`),**绝不能是 `+0.0%`**(来源:`AnalyticsServiceImpl.java:82-84` 的 `percentChange(revenueRecent, revenuePrevious)`)
- **实际**:`{"label":"Total Revenue","value":"$99.00","change":"+0.0%"}`;商家端同症状 `{"label":"Total Sales","value":"$99.00","change":"+0.0%"}`
- **DB 证据**:
  ```sql
  select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成')
    and create_time >= now() - interval 30 day;                                  -- 99.00
  select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成')
    and create_time >= now() - interval 60 day and create_time < now() - interval 30 day; -- 0.00
  ```
- **可能原因**(已定位):`src/main/resources/mapper/AnalyticsMapper.xml:13-21` 的 `paidOrderFilter` 只有
  `AND product_order.create_time >= #{since}`,**没有 `create_time < #{until}`**;而 `AnalyticsServiceImpl.java:74-84` 用
  `sumPaidRevenue(null, recentStart)` 与 `sumPaidRevenue(null, previousStart)` 两个**都只带下界**的查询 —— `previousStart` 窗口是 `recentStart` 窗口的**超集**,分子分母恒等 → 0%;若存在更早营收,分母更大 → **负数**。
- **修复建议**:`paidOrderFilter` 增加可选上界参数(`AND create_time < #{until}`),调用处传 `recentStart` 作为 previous 窗口的上界;同时修掉「分母为 0 时返回 +0%」的语义(应 `N/A`)。
- **回归方式**:造两笔(远/近各一),断言 change 的符号与量级正确。

---

### B-4 · `PUT /merchant/settings` 返回 200 但完全无持久化(假成功)

- **等级**:**Major**(用户可见后果:商家改了店铺名/邮箱,刷新后还原,且界面提示成功)
- **归属**:**存量缺陷**(该 no-op 早于本批,`MODULES.md §2` 已记载)
- **复现步骤**:
  1. `curl -sS -i -X PUT http://localhost:1000/merchant/settings -H 'Content-Type: application/json' -H "Authorization: Bearer $SHOP" -d '{"storeName":"QA-PROBE-STORE","email":"qa@probe.test"}'`
  2. `curl -sS -H "Authorization: Bearer $SHOP" http://localhost:1000/merchant/settings`
  3. `select name,nickname,email from shop where id=1`
- **预期**:200 后 `GET /merchant/settings.storeName` 应为 `QA-PROBE-STORE`(来源 `MerchantApiController` 的 settings 契约)
- **实际**:
  ```
  PUT  → HTTP/1.1 200 {"code":200,"msg":"操作成功","data":null}
  GET  → {"storeName":"一号数码旗舰店","description":"店长一号","logo":null,"location":"Unknown",
          "responseTime":"< 1 hour","policies":{"shipping":"","returns":""},
          "email":"shop@test.com","notifications":{"email":true,"push":false,"sms":true}}
  DB   → 1 | 一号数码旗舰店 | 店长一号 | shop@test.com      (未变)
  ```
- **可能原因**:`MerchantApiController` 的 `updateSettings()` **无入参**、方法体仅 `return ResponseVO.ok();`;`merchant_setting` 表未被 Java 引用(全仓精确 grep:`merchant_setting` 仅 1 处注释)
- **修复建议**:实现 `merchant_setting` 的 upsert(或明确返回 501/未实现,而不是 200)。**另**:`GET` 的 `location:"Unknown"`/`responseTime:"< 1 hour"`/`policies` 空 也是硬编码,应同批处理。
- **回归方式**:PUT 后 GET 必须回读新值 + DB 有行。

---

### B-5 · 钱包提现 / 管理端设置 / 商家钱包读取:三处 200 假成功或硬编码

- **等级**:**Major**(提现请求被静默吞掉;设置形同虚设)
- **归属**:**存量缺陷**(`MODULES.md §2` 已记载;`merchant_wallet`/`admin_setting` 表在**本环境不存在**)
- **子项 A — 提现**(本条最重):
  1. `curl -sS -i -X POST http://localhost:1000/merchant/wallet/withdraw -H 'Content-Type: application/json' -H "Authorization: Bearer $SHOP" -d '{"amount":100,"destinationId":"x"}'` → **200** `{"code":200,...}`
  2. `curl -sS -H "Authorization: Bearer $SHOP" http://localhost:1000/merchant/wallet` → `{"balance":0,"pending":0,"currency":"USD"}`(与提现前完全一致)
  3. `select count(*) from information_schema.tables where table_schema='template_v3' and table_name='merchant_wallet'` → **0**
  - **预期**:提现 200 必须伴随余额扣减与流水落库;或明确拒绝(余额不足)。
  - **实际**:200 且零副作用。**危险语义**:一旦余额变为非 0(未来接上 wallet),该端点会把提现请求静默丢弃 —— 用户以为钱已提走。
  - **原因**:`MerchantApiController` 的 `withdraw()` 无入参、无实现;`merchant_wallet` 全仓 0 引用。
- **子项 B — `GET /admin/settings` / `PUT`**:GET 恒 `{"siteName":"Nexus Market","maintenanceMode":false,"allowRegistrations":true,"commissionRate":5.0}`;PUT `{"siteName":"QA-PROBE-SITE"}` → **200**,随后 GET **仍 `Nexus Market`**,`admin_setting` 表不存在。
- **子项 C — `GET /merchant/wallet` / `/transactions`**:恒 `{balance:0,pending:0,currency:"USD"}` / `[]`;表不存在。
- **修复建议**:三处统一为「未实现就明确失败」(4xx/501)或补表+实现;**提现必须优先**。另外 `PUT /admin/settings` 与 `PUT /admin/reviews/{id}` 都存在「无入参也返 200」的同类模式,建议统一排查(见 B-16)。
- **回归方式**:提现后 `balance` 必须减少且流水新增 1 行;设置 PUT 后 GET 回读新值。

---

### B-6 · `POST /account/notifications` 对前端字段静默吞掉,却返回 200

- **等级**:**Major**(用户以为通知偏好已保存,实际未变)
- **归属**:**存量契约不一致**(前端形状与后端形状不同)
- **复现步骤**:
  1. `curl -sS -i -X POST http://localhost:1000/account/notifications -H 'Content-Type: application/json' -H "Authorization: Bearer $USER" -d '{"email":true,"push":false,"sms":true}'`(前端 `MerchantSettings`/账户页形状)
  2. `curl -sS -H "Authorization: Bearer $USER" http://localhost:1000/account/notifications`
  3. `select * from user_notification_pref where user_id=<id>`
- **预期**:200 后偏好应改变;或返回 400 指出字段不合法(来源:后端契约字段为 `emailOrder/emailPromo/smsOrder`)
- **实际**:
  ```
  POST {email,push,sms}     → 200 {"code":200,...}   GET → {"emailOrder":true,"emailPromo":false,"smsOrder":true}  DB → 1 5 1 0 1 (未变)
  POST {emailOrder,emailPromo,smsOrder} → 200        GET → {"emailOrder":false,"emailPromo":true,"smsOrder":false} DB → 1 5 0 1 0 (已变)
  ```
  即:**只认后端的三个 key;前端形状提交后 200 且零变化**。
- **修复建议**:统一字段名(前后端二选一),并把未知 key 视为 400(而不是静默忽略)。
- **回归方式**:前端实际 payload 提交后 GET 必须回读新值。

---

### B-7 · `GET /products/{id}` 不存在时返回 200 + `data:null`

- **等级**:**Minor**(前端有兜底,但契约不诚实;易掩盖 id 错误)
- **归属**:**存量缺陷**
- **复现**:`curl -sS -i -H "Authorization: Bearer $TOKEN" http://localhost:1000/products/999999`
- **预期**:404(与 `/merchants/{id}/profile`(404)、`/checkout/summary` 商品不存在(404)、`/orders` 不存在(404)一致)
- **实际**:`HTTP/1.1 200 {"code":200,"msg":"操作成功","data":null}`
- **证据**:`/tmp/qa-b/resp/STF-03.http` 原文(见上)
- **修复建议**:`selectById` 为空时抛 404。
- **回归**:`GET /products/999999` → 404。

---

### B-8 · `status` 过滤在商品域仍是「单档」:库无 `product.status` 列

- **等级**:**Minor**(如实返回空集,不是静默放行;但页面下拉形同虚设)
- **归属**:环境/未完成项(V10 未应用;`Product` 实体亦无该字段)
- **实测**:`/admin/products?status=active`→3 项、`?status=draft`→0 项;`/merchant/products` 同;`select count(*) from information_schema.columns ... column_name='status'` → **0**
- **判定**:`draft` 空集是**诚实**的(无该列),因此**不算静默失效**;但前端状态筛选在当前 schema 下永远只有一档 → 记为 Minor/环境项,**不应记成本次回归**。
- **修复建议**:应用 V10 并在实体/查询中真正使用 `status`;`ban` 端点也应改为置 `status` 而非 `setStock(0)`(否则被封商品仍在买家前台可见 —— 本条未单独构造下单验证,列 B-16 未确认项)。

---

### B-9 · `PUT /addresses/{id}/default` 返回 200 但不设置默认地址

- **等级**:**Major**(用户在地址页点「设为默认」,刷新后无效却收到成功提示)
- **归属**:**存量缺陷**
- **复现**:
  1. `POST /addresses` 建地址 → `{"id":2,...}`
  2. `curl -sS -i -X PUT http://localhost:1000/addresses/2/default -H "Authorization: Bearer $USER"` → **200** `{"code":200,...}`
  3. `GET /addresses` → 无任何默认标记字段;`select count(*) ... column_name='is_default'` → **0**
- **预期**:200 后该地址成为默认(且唯一);或明确未实现
- **实际**:200 + 零效果(`StorefrontAddressController` 的 `setDefaultAddress` 为 no-op)
- **补充**:`POST /addresses` 的响应体也**缺 `isDefault`/`type`/`city`/`zip`** 字段(`{"id":2,"name":"QA","tel":null,"address":"测试路9号","userId":5,"username":null,"createTime":null}`),与前端 `Address` 接口(`web/src/api/modules/address.ts`)不一致 → **同条一并修**。
- **修复建议**:应用 V10 的 `is_default` 列并在 Service 实现「置默认 + 清其它」;同时补 DTO 字段。

---

### B-10 · `/admin/products?q=<非 ASCII>` 未百分号编码时返回 Tomcat HTML 400,而非统一 JSON

- **等级**:**Info**
- **归属**:**存量/框架行为**,**不是前端缺陷**(浏览器与 axios 会自动编码)
- **实测对拍**(同一 token、同一语义):
  ```
  curl 'http://localhost:1000/admin/products?q=耳机'(raw UTF-8)  → HTTP 400  <!doctype html>…HTTP Status 400 – Bad Request…
  curl 'http://localhost:1000/admin/products?q=%E8%80%B3%E6%9C%BA' → HTTP 200  {"code":200,"msg":"操作成功","data":[{"…无线蓝牙耳机…"}]}
  ```
  同样症状见 `/merchant/products?q=耳机`。中文关键字在 percent-encoded 时**过滤真实生效**(返回「无线蓝牙耳机」)。
- **为何记 Info**:正常客户端(浏览器/axios)必然编码;但若把此路径暴露给第三方客户端,会看到非 JSON 的 400,破坏统一错误契约。
- **建议**:确认是 Tomcat 的 `relaxedQueryChars`/URI 编码拒绝即可;如需统一错误体,可配 `server.tomcat.relaxed-query-chars` 或前置过滤器。**不建议仅为此改业务代码。**

---

### B-11 · 契约字段不一致(账户资料 / 地址响应)

- **等级**:**Minor**
- **归属**:存量
- **实测**:`GET /account/profile` → `{"firstName":"QA验收用户","lastName":"","phone":null,"avatar":null,"email":"…"}`;`POST /addresses` 响应缺 `type/isDefault/city/zip`。对照 `web/src/api/modules/account.ts`、`address.ts` 的 TS 接口。
- **建议**:以「接口类型 + 后端 DTO」双端对齐;前端对可选字段做兜底。

---

### B-12 · 未知 JSON 字段被静默忽略(`price`/`amount`/`total`/`currency`)

- **等级**:**Info**
- **归属**:契约设计
- **事实**:`StorefrontCheckoutDTO`/`CheckoutSummaryDTO` 无 `price`/`amount`/`total` 字段,Jackson 默认丢弃未知字段 → 前端传的 `amount`(`usePaymentFlow.ts:129`)与 `currency` 从不被后端看到/校验。
- **判定**:**行为正确**(不信任前端金额),但**契约上应显式化**:要么删掉前端冗余字段,要么后端加 `@JsonIgnoreProperties`/明确注释,避免后来者误以为 `amount` 参与校验。
- **建议**:删 `payment.ts` payload 里的 `amount`/`currency`,或补文档说明「仅回显用」。

---

### B-13 · `/orders` 映射层把运费/税/折扣写死为 0

- **等级**:**Minor**
- **归属**:存量(前端)
- **位置**:`web/src/api/modules/orders.ts` 的 `mapStorefrontOrder`(注释自述「后端未持久化 运费/税/优惠(展示用,不入账)」)
- **影响**:订单详情页金额明细行恒 `0` 或 `subtotal == total`,用户无法看到构成。
- **建议**:要么后端持久化并在 DTO 返回,要么前端不再展示这三行。

---

### B-14 · `docs/backend-api.md` 未登记工作树新增的三个商品端点

- **等级**:**Minor**(文档漂移)
- **实测**:`GET /products/1/related?limit=3`→200(2 项);`/bought-together?limit=3`→200(0 项);`/complete-the-look?limit=3`→200(1 项)。而 `docs/backend-api.md` §1.1 只列 5 个端点。
- **建议**:补文档;同时核对 `MODULES.md §2` 与 `backend-api.md` 对 trending/facets/category-counts/dashboard 的相反结论(§4.1 实测结果支持 backend-api 的「已真实化」)。

---

### B-15 · A 阶段后端测试失败与 B-1 同域,需交叉核对

- **等级**:**Info/待确认**
- **归属**:待 Lead/code-reviewer 判定
- **事实**:A 阶段 `mvn -B clean test` → 11 failures + 1 error,主力是 `StorefrontPromoTest`(10F+1E)与 `RequestShapeTest`(1F)。其中 `StorefrontPromoTest` 与本次实测的 **B-1(券入口 400)** 同属优惠券域。
- **为何不直接合并定性**:该测试跑在 H2(`schema-h2.sql` 含 V6~V11),而真实 MySQL 无这些表/列,二者**不是同一环境**;必须分开归因(可能同源,也可能一个是被测代码真错、一个是 H2 schema 超前)。
- **建议**:让 code-reviewer 或后端责任人就 `StorefrontPromoTest` 的失败断言与 `CouponServiceImpl`/白名单路径对照一次。

---

### B-16 · 未确认项(不直接计为 Bug,需后续确认)

| # | 观察 | 为什么未定性 |
|---|---|---|
| 1 | `PUT /admin/reviews/1`(id 不存在)返回 **200** | 与「无入参也返 200」的 no-op 模式一致,但评价表为空 → **无法用数据判定**;需有评价数据后复测再定级 |
| 2 | `DELETE /admin/products/{id}/ban` 是否仍以 `setStock(0)` 充当下架、被封商品是否仍在买家前台可见 | 属已知语义缺口(`backend-api.md §1.10`);本轮未构造「封禁后买家检索」的完整对照 |
| 3 | `product.sales_volume` 在测试期间由 10→11、5→7 变化(而我又下了多笔待支付单) | **未定位**是下单、加购还是某处 update 触发;不影响金额,但影响 `/products/sales-top` 排序语义 → 建议后端确认「销量何时累加」 |
| 4 | 30min 超时取消:代码级确认存在(`OrderTimeoutTask`,`TIMEOUT_MINUTES=30`,`fixedDelay=60_000`),但库中无 >30min 的待支付单可观察 | 制造前置需直连 `UPDATE create_time`,超出授权边界 |
| 5 | balance 渠道「扣款 + 退款回补」正路径 | 无 `balance>0` 的测试用户可造(`PUT /admin/users/{id} {"balance":500}` 实测不生效) |

---

### B-17 · 安全建议(非缺陷)

- JWT 密钥强度与泄露面:本轮用容器内 `JWT_SECRET` **成功伪造了签名有效的 ADMIN token**(预期行为),证明**密钥即全部权限**。生产必须确保 `JWT_SECRET` 不入库、不入日志、不落镜像层;`JwtUtils.generalKey()` 把 `Base64(Base64(secret))` 当 HMAC key 属冗余变换,**不构成安全缺陷但属可疑实现**(建议改为直接对 secret 做 `Keys.hmacShaKeyFor`)。
- 有利结论(应保留):未知路径对匿名 401 / 已登录 403(**不暴露路径存在性**);`/admin-accounts`、`/productOrderEvaluate` **不再**被前缀误命中;token 过期/篡改/无 type 全部 fail-closed;图片扩展名白名单生效(`x.pdf` 匿名 401)。

---

## 9. 存量失败与本次引入的区分

| 结论 | 条目 |
|---|---|
| **本次未提交改动引入(回归)** | **B-1**(券入口 400,新增校验+既有白名单组合失效)、**B-2**(Cart.vue 漏改,展示 < 实扣)、**B-3**(AnalyticsMapper 新增的时间窗缺上界) |
| **本批后端契约先行、前端待接(未完成项,非回归)** | 前端 `usePaymentFlow.ts`/`checkout.ts` **不发 `code`** → 券虽已能经 `/payments/create` 核销,但页面用不到(Lead 已定性);即修好 B-1 也需前端接 `code` 才闭环 |
| **存量缺陷(不因本轮产生)** | B-4、B-5、B-6、B-7、B-9、B-11、B-13、B-14 |
| **环境/未完成项(不得记为 Bug)** | 库 23 张表(无 `merchant_wallet`/`admin_setting`/`product.status`/`review_status`/`is_default`);因此 B-5/B-8/B-9 的「无表/无列」是**本轮裁决不写库**的必然结果 |
| **测试脚本自身缺陷(不计缺陷)** | ①首轮 `10-a-face.sh` 在容器内嵌套 `docker exec`(容器内**无 docker CLI**)→ 变量为空 → 产生 2 个 400 与 **1 个 500**;②`qa.py` 的 `req()` 少传 `Authorization` 导致首轮大批 401;③并发脚本多线程共用同一临时 body 文件 → 1 个偶发 400。三者均已定位并修正后复测(`qa.py` 已改为 `tempfile.mkstemp` 每请求独立文件),**不计入产品缺陷**。 |
| **A 阶段基线(引用)** | `mvn -B clean test` 171/11F+1E;`vue-tsc` 0 错误;`build-prod` rc=0 |

---

## 10. 未覆盖项(如实列出)

| 项 | 原因 |
|---|---|
| FE-01..FE-21 浏览器层(页面渲染、Network 面板、401 跳转清会话、`localStorage` 残留实证) | 本轮无浏览器自动化环境;已用等价的 HTTP+DB 用例取证。**401→清会话→跳登录**仅由 `http.ts:39-61` 静态确认,无运行时证据 |
| 评价子系统(`GET/PUT/DELETE /admin/reviews`) | `product_order_evaluate` **0 行**(种子无评价)→ 无法判定 `updateReviewStatus` 是否 no-op |
| 30min 超时自动取消的端到端 | 需直连 SQL 改 `create_time`,超授权;仅代码级确认 |
| balance 渠道退款回补正路径 | 无 `balance>0` 账户可造 |
| SQL 注入 / 超长输入 / 5MB body | 预算取舍;MyBatis `#{}` 参数化 + 过滤器实测已给间接证据 |
| 文件上传统 (EXT-18/19) | 未构造 multipart 与 >10MB 样本 |
| 管理端 approve/reject、用户 toggle-status/reset-password/delete 的副作用 | 会改动种子账号(如重置 admin 密码),风险高于收益;未执行 |
| `PUT /merchant/orders/{id}/status` 合法跃迁链路(待支付→待发货→待收货→已完成)与快递单号 | 未构造;越权与非法跃迁路径已覆盖(403/400) |
| `/chat/*` 端到端 | 未构造会话与消息 |
| Playwright e2e(mock)运行时 | 见 §7;容器内 Playwright 1.62.1 已存在,e2e 运行状态以当时输出为准,**且不作为联调证据** |

---

## 11. 结论与下一阶段建议(只建议,不实施)

**能否作为可验收基线**:本轮**可以**作为「已查明状态」的基线保留,但**不建议**在修掉 B-1/B-2/B-3 之前对外宣称「主链路可用」——

- ✅ **已经可用且可信**:认证与鉴权(默认拒绝 + 对象级越权 + token 全路径)、商品/搜索/分类计数/趋势/facets(全部真实)、结算金额服务端重算(**篡改无效**)、下单/支付/订单/取消/退款/库存回补(**幂等 + 并发安全**)、管理端三类仪表盘与收入图(真实)、商家仪表盘与归属校验(真实)、店铺公开页 stats(真实)、优惠券/退换货/到货订阅/通知(数据层真实)、文件/聊天端点存在。
- 🔴 **必须修才能称为「跑通」**:B-1(券入口)、B-2(购物车金额)、B-3(营收环比)。
- 🟠 **建议同批修**:B-4/B-5/B-6/B-9 四处「200 假成功」(用户会以为操作成功)。

**下一阶段(Phase 4 / 质量收尾)最小范围建议**:
1. **修 B-1**:白名单路径的**可选鉴权**(解析 token 填 ThreadLocal,不强制 401)——这是一处配置级改动,收益覆盖全部券功能。
2. **修 B-2**:`Cart.vue` 改走 `/checkout/summary`,与结算页同源。
3. **修 B-3**:`paidOrderFilter` 补上界 + 分母为 0 的展示语义。
4. **统一「未实现的写端点」语义**:`PUT /merchant/settings`、`PUT /admin/settings`、`POST /merchant/wallet/withdraw`、`PUT /admin/reviews/{id}`、`PUT /addresses/{id}/default` 一律**返回 4xx/501**,而不是 200 —— 这是一条能一次性消掉 5 个 Major 的规则性修复。
5. **前端接 `code`**:`usePaymentFlow`/`calculateOrderSummary` 传 `code`,让 B-1 的修复真正闭环。
6. **对齐 `user_notification_pref` 字段名**(B-6)与 `Address`/`AccountProfile` 契约(B-11)。
7. 应用 V6~V11 后**重跑本报告 §4 的后台判定表**(那时 B-5/B-8/B-9 的「无表/无列」才可能转为真实实现,`review_status` 也才可测)。

**对 Lead 终验的建议**:终验只需复核 3 条 Blocker/Major 的**可复现性**(§8 每条都有「复现步骤」与「回归方式」),以及 §5 授权矩阵的 15 条精确命中;其余条目可直接引用本报告的原始报文。

---

## 附录 · 证据索引

| 类别 | 位置 | 数量 |
|---|---|---|
| HTTP 原始报文(`curl -sS -i` 原文:状态行+响应头+响应体) | 容器 `/tmp/qa-b/resp/<CASE-ID>.http` | **282** |
| 请求体副本 | 容器 `/tmp/qa-b/resp/<CASE-ID>.req` | 同批 |
| SQL 原始输出 | 报告内联引用(逐条含 SQL 与结果) | 60+ |
| 取证脚本(可复跑) | 本仓库 `docs/TASK-001/_b-evidence/`: `qa.py`、`00-login.sh`、`10-a-face.sh`、`20-main.py`、`21-check-promo.sh`、`30-admin-merchant.py`、`31-verify.py`、`32-verify2.py`、`40-authz.py`、`41/42-expired-jwt*.py`、`43-revenue-windows.py`、`50-concurrency.py`、`60-cart-vs-server.py`、`61-coupon-path.py`、`70-final-snapshot.py` | 17 |
| token | 容器 `/tmp/qa-b/tokens/{admin,user1,user2,shop1,shop2,newuser}.txt` | 6 |
| DB 终态快照 | 本报告 §4 与 `70-final-snapshot.py` 输出(product/order/payment/coupon/address/return 全表) | — |

> **复现说明**:所有脚本在容器内以 `python3 /tmp/<name>.py` / `bash /tmp/<name>.sh` 运行;MySQL 一律通过 **stdin**(`echo "SQL" | mysql -uroot -p123456 template_v3 -N -B`),因为**容器内没有 `docker` CLI**,嵌套 `docker exec` 必然失败(本轮踩坑记录,建议写入团队约定)。

---

## 附录 B · 变更合规与数据残留声明

**1. 未改动任何受保护文件(机器校验通过)**

- B 阶段开始前落盘 `git status --short` 快照(`docs/TASK-001/_b-git-snapshot.txt`,107 行);B 阶段结束后重新执行并 `Compare-Object`,结果:**IDENTICAL(107 行 → 107 行完全一致)**。
- 即:`src/main/java`、`web/src`、`sql/`、`docker/` 的状态**在本阶段前后未发生任何变化**,其中的 ` M` 全部是本轮开工前 Phase 3 的既成改动。
- 本 Agent 新增的仅:`docs/TASK-001/06-TEST-REPORT.md`、`docs/TASK-001/06a-TEST-PLAN.md`、`docs/TASK-001/_b-git-snapshot.txt`、`docs/TASK-001/_b-evidence/`(18 个取证脚本)。

**2. 无 DDL、无直连写库、无迁移**:全部数据变更经 API 端点产生(与 Lead 授权边界一致)。DB 表数自始至终 **23**。

**3. 测试数据残留(均为 API 端点产生的合法副作用,已如实登记,供 Lead 决定是否清理)**

| 表 | 残留 | 来源 |
|---|---|---|
| `user` | 新增 2 个测试用户:`4 qa_b_1790860289`、`5 qa_b_1790860342`(均 `启用`,余额 0.00) | AUTH-06 注册端点 |
| `product` | 新增 1 个探针商品:`4 QA探针商品-改名 / 12.34 / 7 / shop_id 1` | MER-06 商家建品端点 |
| `product` | 种子商品库存变化:`1: 50→40`、`2: 30→28`、`3: 20→1`;`sales_volume` 变化:`1: 10→20`、`2: 5→7`、`3: 3→22` | 下单扣库存/取消回补;`sales_volume` 变化原因**未定位**(见 B-16#3) |
| `product_order` | 新增 17 行(状态分布:`已取消 3 / 待发货 2 / 待支付 12`) | 下单/支付/取消端点 |
| `payment` | 17 行(`已支付 2 / 已退款 2 / 已取消 1 / 待支付 12`) | 下单/支付/取消端点 |
| `user_coupon` | `1 5 1 used`(WELCOME10 已被测试用户核销) | 领券 + `/payments/create` 核销 |
| `shipping_address` | 新增 1 行 `2 5 QA 测试路9号` | EXT-02 地址端点 |
| `return_request` | 新增 1 行 `1 5 NO…28995 pending 198.00` | EXT-13b 退换货端点 |
| `stock_alert` | 增后又删,当前 **0 行** | EXT-14 到货订阅端点 |
| `shopping_cart` | user1 的两行已被下单时的 `cartItemIds` 清除,当前 **0 行** | ORD-01 下单端点 |

> 种子账号 `admin`/`user1`/`user2`/`shop1`/`shop2` 的**密码、角色、状态、余额均未被修改**(`user1.balance` 仍 1000.00,`shop` 表未变)。探针把 `shop1` 的店铺名两次 PUT 均未生效(no-op,B-4),故 `shop` 表保持原值。

**4. 复跑提示**:若 Lead 需要「干净环境」重跑本报告,建议先记录上述残留的逆操作;但**注意 B-4/B-5/B-9 的 no-op 端点无法通过 API 复原任何东西**。
