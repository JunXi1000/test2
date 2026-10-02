# 后端接口契约清单(backend-api)

> 本文档列出 **Spring Boot 后端当前实际暴露的端点**(19 个 Controller),并标注每个端点的**实现状态**与所委托的 Service。
> 2026-09-24:原先的 33 个 Controller 里有 14 个「遗留 CRUD」控制器(约 90 个端点)已**物理删除** —— 它们
> 早已被授权层默认拒绝(见 §2),代码留着只是负担。删除后 Controller 数为 **19**。
> 用途:与 [docs/API接口说明.md](API接口说明.md)(前端期望的接口)对照,找出路径/字段差异与缺口;也是实现各阶段路线图的起点清单。
> 状态标记:🟢 真实 · 🟡 部分(含占位) · 🔴 占位/mock · ⚪ 未建

## 0. 通用约定

- 统一响应 `ResponseVO<T>`:`{ code, msg, data }`,`code=200` 成功;分页 `PageVO<T>`:`{ list, total }`。
- **错误响应(2026-09-24 起为过渡态)**:`msg` 与 `data` **都**携带具体原因。
  此前 `msg` 恒为字面量 `"操作失败"`,真实原因只在 `data` 里(前端 `http.ts` 据此把它折进 `e.message`)。
  现在两处都带原因,对前端是**纯增量**;待前端不再依赖 `data` 携带原因后,再收敛为
  「`msg` 放原因、`data` 只放业务数据」。见 [REFACTOR_PLAN-BACKEND.md](REFACTOR_PLAN-BACKEND.md) Phase 3a。
- **鉴权是「默认拒绝 + 显式放行」**(2026-09-24 起):公开接口在 `config/SpringMvcConfig` 的
  `excludePathPatterns` 声明;其余路径必须在 `config/AuthzRules` 的规则表里登记「路径 → 允许角色」,
  **未登记的路径对所有角色一律 403**。规则表按**路径段**匹配(`AntPathMatcher`),不再用 `String.startsWith`。
- **角色**:`/admin/**` → ADMIN、`/merchant/**` → SHOP、`/chat/**` → USER 或 SHOP、
  `/notifications/**` → 三种角色(通知按角色投递);其余见 `AuthzRules`。
- 未知路径对已登录用户返回 **403**、对匿名用户 **401**(而非 404):拦截先于 handler 解析生效,
  好处是探测者无法区分路径存在与否。
- 后端模块包名 `com.project.platform`,主类 `ProjectManagement`,端口 1000。

---

## 1. 门面控制器(面向 Nexus 前端,16 个)

> 路径与 `web/src/api/modules/*.ts` 对齐;部分端点仍为硬编码占位(标 🔴/🟡)。
> Phase 1(2026-08-08)新增了 `CouponController` / `ReturnRequestController` / `StockAlertController` / `NotificationController`,见 §1.13。

### 1.1 商品 /products — StorefrontProductController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/products` | 🟢 | 列表:分页 + 排序 + 分类/关键字过滤 |
| GET | `/products/:id` | 🟢 | 商品详情 |
| GET | `/products/category-counts` | 🟢 | 真实分类计数(首项 `All`=全站商品数;**含 0 件的分类**,顺序同分类表) |
| GET | `/products/recommend/:size` | 🟢 | 推荐(浏览/收藏加权) |
| GET | `/products/sales-top/:size` | 🟢 | 销量榜(真实 SQL) |

### 1.2 搜索 /search — StorefrontSearchController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/search/suggestions?q=` | 🟢 | 建议(查产品标题/分类) |
| GET | `/search/trending` | 🟢 | 销量最高的商品名,不足时用分类名补齐;无任何销量数据时返回**空列表**(不再返回硬编码的 Phone/Laptop/…) |
| POST | `/search` | 🟢 | 结果真实;`facets` 与 `relatedSearches` 已真实聚合(见下) |

**`POST /search` 的 facets 结构**(2026-09-27 落地,此前恒为空 Map):

```jsonc
"facets": {
  "categories":   [{ "name": "Electronics", "count": 2 }],       // 按命中数倒序
  "priceRanges":  [{ "label": "$50.00 - $200.00",                 // 桶边界 0/50/200/500/1000/∞
                     "min": 50.00, "max": 200.00, "count": 3 }],
  "ratings":      [{ "value": 4, "count": 1 }]                    // 累计口径:4 = 4 星及以上;只返回 count>0
}
"relatedSearches": ["test", "product"]                            // 从命中商品标题拆词,长度≥3,排除查询词本身
```

> **口径约定**:三个分面维度都**只应用关键字过滤、不应用已选分类** —— 否则用户一选分类,
> 其他分类计数全变 0,分面就成了死路(标准 faceted search:每维用「除自己外的全部过滤」计数)。
>
> `relatedSearches` 刻意**不做随机化**(前端 mock 分支用 `Math.random()`):同一查询必须给同一结果,
> 否则无法写测试断言、用户也会看到闪变的推荐。

### 1.3 用户仪表盘 /dashboard — StorefrontDashboardController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/dashboard/stats` | 🟢 | 基于订单聚合统计 |

### 1.4 我的订单 /orders — StorefrontOrderController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/orders` | 🟢 | 当前用户订单分页 |
| GET | `/orders/recent` | 🟢 | 最近订单 |

### 1.5 账户 /account — StorefrontAccountController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/account/profile` | 🟢 | 当前用户资料(含 balance) |
| POST | `/account/profile` | 🟢 | 更新资料 |
| GET | `/account/notifications` | 🟢 | 通知偏好(读 `user_notification_pref`,无记录时返回默认值 `emailOrder=true`/`emailPromo=false`/`smsOrder=true`) |
| POST | `/account/notifications` | 🟢 | 更新通知偏好(upsert 落库)。**字段名 `emailOrder`/`emailPromo`/`smsOrder`** —— 与响应、与 DB 三列一一对应,买家侧前后端本来就一致(无需「字段对齐」;`{email,push,sms}` 是**商家端** `PUT /merchant/settings` 的形状)。**C6 校验:三个偏好全缺 → 400 + 明确 msg**(2026-10-02 新增;此前空 body / 错字段名 → 200 且静默写默认值)。**部分提交是 patch 不是整行替换(MAJ-E3)**:未出现的字段**保留库中现值**,只有该用户尚无记录时才落到默认值 —— 全量提交与「只改一个开关」两种用法都成立,不会静默重置另外两项 |

### 1.6 地址 /addresses — StorefrontAddressController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/addresses` | 🟢 | 我的地址列表 |
| POST | `/addresses` | 🟢 | 新建地址 |
| PUT | `/addresses/:id` | 🟢 | 更新地址 |
| DELETE | `/addresses/:id` | 🟢 | 删除地址 |
| PUT | `/addresses/:id/default` | 🔴 | **501(未实现)**。无 `is_default` 列可落库 —— 该列由仓库里的 `sql/migrations/V10__product_status_and_default_address.sql` 引入,**本轮未应用该迁移**(运维单独裁决)。此前返回 200 是假成功 |

### 1.7 结算 /checkout — StorefrontCheckoutController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| POST | `/checkout/summary` | 🟢 | **需登录**(匿名 401)。金额一律按 DB `product.price` 重算 `subtotal/discount/total`,**不信任前端传入的 price**;**无** 运费/税/满减档位(已移出契约)。`items` 缺失/为空 → **400**;商品项参数不合法 → **400**(2026-10-02 裁决,不是 409);商品不存在或已下架 → **404**(见 §3) |
| POST | `/checkout/promo` | 🟢 | **需登录**(匿名 401)。只查 coupon 表(`CouponService.applyByCode`,含归属/有效期/已用/门槛校验);未命中/未领取/已使用 → **400**「优惠码无效」/「您未领取该优惠券」/「该优惠券已使用」,**无** `SAVE10`/`VIP15` 硬编码兜底。未达门槛 → **409**。只读,不核销(核销在 `/payments/create`) |

### 1.8 支付 /payments — StorefrontPaymentController

> **模拟网关(非真实)**:下单/支付记录**真实落库**(`payment` 表)、库存**真实扣减**、状态机**真实**;
> 但没有真实商户号与回调验签 —— 接入微信/支付宝必须替换为「网关下单 + 回调验签 + 幂等入账」。

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| POST | `/payments/create` | 🟢 | 真实下单 + 建支付单(`payment` 表),原子扣库存;`paymentId`/`orderId` 均回填 `orderNo`;`clientSecret` 恒 `null`(模拟网关无真实 secret) |
| POST | `/payments/confirm` | 🟢 | 真实状态机:校验支付单、按 `channel`(缺省读支付单)落库(`TXN-<orderNo>` + `paid_at`);**已支付则幂等**直接返回 `succeeded`,不重复扣款 |
| POST | `/payments/complete-action` | 🟢 | 3DS 回调:读支付单 `channel` 转调 `confirm`,同语义同幂等(`orderNo` 回落顺序与 `confirm` **相反**:`paymentId` 优先) |

### 1.9 公开店铺 /merchants — StorefrontMerchantController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/merchants/:id/profile` | 🟢 | `stats`(rating/totalReviews/totalProducts/totalSales/satisfactionRate/followers)与 `featuredProducts` 均为真实聚合;`location`/`responseTime`/`policies` 需 `merchant_setting` 表(未落地前**如实返回空串**)。**店铺不存在 → 404** |
| GET | `/merchants/:id/products` | 🟢 | 店铺内商品(`category` / `q` / 分页);`categories` 返回该店真实分类;店铺不存在 → 404 |

### 1.10 管理端 /admin — AdminApiController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/admin/dashboard/stats` | 🟢 | 4 张卡片真实聚合(见下方口径表) |
| GET | `/admin/dashboard/recent-users` | 🟢 | 新用户列表 |
| GET | `/admin/dashboard/revenue-chart?days=7` | 🟢 | 按自然日聚合的已支付金额;**无订单的日期补 0** 保证 ECharts 的 category 轴连续;`days` 服务层收敛到 1~31 |
| GET | `/admin/users` | 🟢 | 用户分页。`role` 过滤:`all`/`user`/缺省 → 本端点全部;`admin`/`merchant` → 空集(见下方说明) |
| POST | `/admin/users/:id/toggle-status` | 🟢 | 启停用 |
| PUT | `/admin/users/:id` | 🟢 | 更新 |
| POST | `/admin/users/:id/reset-password` | 🟢 | 重置密码 |
| DELETE | `/admin/users/:id` | 🟢 | 删除 |
| GET | `/admin/merchants` | 🟢 | 商家分页;`revenue` 为**真实**累计销售额(此前恒 0) |
| POST | `/admin/merchants` | 🟢 | 创建商家 |
| PUT | `/admin/merchants/:id` | 🟢 | 更新商家 |
| POST | `/admin/merchants/:id/approve` | 🟢 | 审核通过 |
| POST | `/admin/merchants/:id/reject` | 🟢 | 审核拒绝 |
| DELETE | `/admin/merchants/:id` | 🟢 | 删除 |
| GET | `/admin/products` | 🟢 | 全站商品;`q` 生效、返回 `description`(`product.intro`)。`status` 只有 `active` 一档 —— 该列由仓库里的 `sql/migrations/V10__product_status_and_default_address.sql` 引入,**本轮未应用**(运维单独裁决),见 §3 |
| DELETE | `/admin/products/:id/ban` | 🟡 | **语义待修**:当前用 `setStock(0)` 充当下架,而列表不过滤 stock=0 → 被封禁商品仍在买家前台可见。需 `product.status` 列(= V10 迁移,本轮未应用,见 [TASK-000/04b-SCHEMA-REQUIREMENTS.md](TASK-000/04b-SCHEMA-REQUIREMENTS.md) §1) |
| GET | `/admin/orders` | 🟢 | 全站订单;`q` 真实生效(订单号/商品名/收货人/收货电话) |
| POST | `/admin/orders/:id/cancel` | 🟢 | 取消订单 |
| GET | `/admin/reviews` | 🟢 | 评论列表;`q` 真实生效(id/商品/用户/内容)。`status` 依赖 `review_status` 列,该列由仓库里的 `sql/migrations/V8__review_moderation.sql` 引入、**本轮未应用**(运维单独裁决),故当前域只有 `visible` 一档 |
| PUT | `/admin/reviews/:id` | 🟡 | updateReviewStatus 仍 no-op(需 `review_status` 列 = V8 迁移,本轮未应用) |
| DELETE | `/admin/reviews/:id` | 🟢 | 删除评论 |
| GET | `/admin/settings` | 🔴 | 设置硬编码(需 `admin_setting` 表,属 TASK-000-D2) |
| PUT | `/admin/settings` | 🔴 | **501(未实现)**。无 `admin_setting` 表可落库;此前接收 body 后静默丢弃并返回 200(假成功)。实现需 schema 变更,见 [TASK-000/04b-SCHEMA-REQUIREMENTS.md](TASK-000/04b-SCHEMA-REQUIREMENTS.md) |

**`/admin/dashboard/stats` 口径**(2026-09-27 落地,此前 4 个指标全部硬编码 `$0`/`0`/`+0%`):

| 卡片 | value | change |
|------|-------|--------|
| `Total Revenue` | 累计已支付金额 | 近 30 天 vs 再前 30 天的环比 |
| `Active Users` | 启用(`启用`)用户数 | 新注册用户的环比(存量快照不可追溯,如实改用新增趋势) |
| `Sales` | 累计已支付**订单单数**(按 `order_no` 去重,不是订单行数) | 近 30 天 vs 再前 30 天的环比 |
| `Active Now` | 近 24h 下过单的**去重用户数** | 与前一个 24h 的**绝对差值**(基数太小,百分比会剧烈跳变) |

> **「已支付」是白名单口径**:`status IN ('待发货','待收货','已完成')`。
> 用白名单而非 `NOT IN ('待支付','已取消')` 是刻意的 fail-closed ——
> 将来新增任何状态(如「退款中」)都**默认不计入**营收。该片段只写在
> `AnalyticsMapper.xml` 的 `paidOrderFilter` 一处。
>
> **`Active Now` 是近似值**:库里没有 session / last_login 表,登录行为不可观测。
> 与其编一个「当前在线人数」,不如如实统计「近 24 小时内有下单行为的用户」。
>
> **`role=admin|merchant` 返回空集的原因**:前端 `AdminUser` 的行操作
> (toggle-status / reset-password / delete)只带一个 id 打到本端点,
> 而 id 在 `user`/`admin`/`shop` 三张表里各自从 1 开始。把另两张表的行混进来会让
> 「删除用户 1」误删一个毫不相干的管理员 —— 比返回空集危险得多。
> 跨角色管理由 `/admin/merchants` 承担。「Users 页角色下拉含 Merchant/Admin」
> 属**前端用法问题**,已上报总控。

### 1.11 商家端 /merchant — MerchantApiController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/merchant/dashboard/stats` | 🟢 | 4 张卡片真实聚合,`shopId` **只来自 token**(不读请求参数,故无法查看别家店铺) |
| GET | `/merchant/dashboard/low-stock` | 🟢 | 低库存商品 |
| GET | `/merchant/products` | 🟢 | 我的商品;`q` 生效。`status` 只有 `active` 一档(`product.status` 列 = V10 迁移,本轮未应用) |
| POST | `/merchant/products` | 🟢 | 创建 |
| PUT | `/merchant/products/:id` | 🟢 | 更新 |
| DELETE | `/merchant/products/:id` | 🟢 | 删除 |
| GET | `/merchant/orders` | 🟢 | 我的订单;`status` 与 `q`(订单号/商品名/收货人/电话)均真实生效 |
| GET | `/merchant/orders/:id` | 🟢 | 订单详情(归属校验在 `ProductOrderServiceImpl.selectById`) |
| PUT | `/merchant/orders/:id/status` | 🟡 | 含**状态机前置校验**;`shipped` **不记录快递单号**(DTO 缺字段,见 04b §3)。归属校验在 Service 层 |
| GET | `/merchant/wallet` | 🔴 | 余额恒 0,无表无 Service(需 `merchant_wallet`,属 TASK-000-D2) |
| GET | `/merchant/wallet/transactions` | 🔴 | 空列表(同上) |
| POST | `/merchant/wallet/withdraw` | 🔴 | **501(未实现)**。无提现表/服务,且余额本身恒 0;此前返回 200 让前端以为「提现已受理」(假成功) |
| GET | `/merchant/settings` | 🟡 | storeName/description/logo/email 真实(读 shop 表);`location`/`responseTime`/`policies`/`notifications` 为默认值(需 `merchant_setting` 表) |
| PUT | `/merchant/settings` | 🔴 | **501(未实现)**。需 `merchant_setting` 表;此前静默丢弃 body 并返回 200(假成功) |

**`/merchant/dashboard/stats` 口径**(2026-09-27 落地,此前 4 个指标全部硬编码 `$0`/`0`):

| 卡片 | value | change |
|------|-------|--------|
| `Total Sales` | 本店累计已支付金额 | 近 30 天 vs 再前 30 天环比 |
| `Orders` | 本店累计已支付**订单单数**(按 `order_no` 去重) | 同上 |
| `Products` | 本店在售商品数 | 固定 `+0%`(存量指标,历史快照不可追溯,硬编环比是假数据) |
| `Conversion Rate` | 已支付订单 / 全部订单 × 100 | 两个 30 天窗口的百分点差 |

**`PUT /merchant/orders/:id/status` 的状态机**(2026-09-27 新增):

| 当前状态(DB 中文) | 允许的目标状态(前端英文) |
|------------------|------------------------|
| `待支付` | `processing`、`cancelled` |
| `待发货` | `shipped`、`cancelled` |
| `待收货` | `delivered`、`cancelled` |
| `已完成` | 无(终态) |
| `已取消` | 无(终态) |

非法跳转返回 **400**,`msg` 带上当前状态与允许的目标状态。`cancelled` 不受该表约束
(任何非终态都应允许取消,幂等与退款由 Service 的 `cancelByOrderNo` 承担)。

> ⚠️ **执行顺序**:枚举合法性(400) → **归属校验(403/404,Service 层)** → 状态机(400)。
> 归属先于状态机,保证越权请求**不会**泄露目标订单的当前状态。

### 1.12 聊天 /chat — ChatController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/chat/conversations` | 🟢 | 会话列表(按当前用户过滤,JWT 联表出昵称头像) |
| GET | `/chat/conversations/:id/messages` | 🟢 | 消息列表 |
| POST | `/chat/messages` | 🟢 | 发消息(自动建会话) |
| PUT | `/chat/conversations/:id/read` | 🟢 | 标记已读 |

### 1.13 Phase 1 新增功能控制器(4 个)

> Phase 1(2026-08-08)后端化:优惠券 / 退换货 / 到货订阅 / 通知。**全部需登录** ——
> `/checkout/promo` 自 2026-10-02 起也已移出 `SpringMvcConfig` 白名单(原「已入白名单」的写法已作废)。

**优惠券 /coupons — CouponController**(`coupon` + `user_coupon` 表)

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/coupons` | 🟢 | 可领取券池(未过期/未领完;不含用户领取状态) |
| POST | `/coupons/:id/claim` | 🟢 | 领取(已过期/已领取/已领完 → `CustomException` 409) |
| GET | `/coupons/my-coupons` | 🟢 | 我的券(含 isUsed / claimedAt / expiresAt) |

**退换货 /returns — ReturnRequestController**(`return_request` 表)

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/returns` | 🟢 | 我的退换货列表 |
| POST | `/returns` | 🟢 | 提交申请(状态 `pending`) |

**到货订阅 /stock-alerts — StockAlertController**(`stock_alert` 表)

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/stock-alerts/mine` | 🟢 | 我的订阅 |
| POST | `/stock-alerts` | 🟢 | 订阅(重复订阅 = 删除旧记录重建) |
| DELETE | `/stock-alerts/:productId` | 🟢 | 取消订阅 |

**通知 /notifications — NotificationController**(`notification` 表,`user_id=0` 表示按角色广播)

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/notifications` | 🟢 | 我的通知(广播 + 定向,按角色过滤) |
| POST | `/notifications/:id/read` | 🟢 | 标为已读 |
| POST | `/notifications/read-all` | 🟢 | 全部已读 |

---

## 2. 传统 CRUD 控制器 —— **已于 2026-09-24 物理删除**

> 这一组控制器(14 个、约 90 个端点,占当时全部端点的 48%)自 Phase 1a 起就被授权层「默认拒绝」,
> 对任何角色都返回 403;随后按用户决策**连同其孤儿 service/mapper/XML/entity 一并删除**
> (共 36 个 Java 文件 + 5 个 mapper XML)。**这些路径现在没有处理器**;请求仍会被
> `LoginInterceptor` 的默认拒绝挡下(匿名 401 / 已登录 403),与删除前的外部表现一致。
>
> 保留下来的三个**不是**孤儿,因此未删:`ProductTypeService`(店铺前台分类要用)、
> `ShippingAddressService`(`/addresses` 用)、`ProductOrderEvaluateService`(管理端评论用)。
> 另:`ProductBrowsingHistoryMapper` / `ProductCollectMapper` 虽然失去了遗留控制器,
> 但 `ProductServiceImpl.recommended()` 用它们算「为你推荐」的个性化权重(`/products/recommend/{size}`
> 是前端在用的放行端点),故**一并保留**。
>
> 下表是删除前的记录,保留作为历史参考 —— 这些前缀已不存在,不要再按它对接。

> ⚠️ **列名更正(2026-09-26)**:下表第三列原写作「Service(已删)」,**那是错的**。
> 真正被删的 service 只有六个:`AdvertisingService`、`SlideshowService`、`ShopCollectService`、
> `ProductCollectService`、`ProductBrowsingHistoryService`、`StatisticalReportFormsService`。
> 表中其余(如 `UserService`、`ProductService`、`ProductOrderService`、`ProductTypeService`、
> `ShippingAddressService`、`ProductOrderEvaluateService`、`ShopService`、`ShoppingCartService`)
> **都还在 `service/` 下** —— 被删的只是它们那些「遗留 CRUD 入口」,而它们各自仍被存活代码使用
> (见 §2 开头的保留清单)。

| 已删除的前缀 | 额外业务端点(曾) | Service(现存情况) |
|------|-------------|---------|
| `/user` | `POST /user/topUp/{amount}` 充值 | UserService |
| `/admin-accounts` | — | AdminService |
| `/shop` | — | ShopService |
| `/product` | `GET /product/salesVolumeTop/{size}`、`GET /product/recommend/{size}` | ProductService |
| `/productOrder` | `pay` / `cancel` / `delivery` / `confirm`(状态机) | ProductOrderService |
| `/productType` | — | ProductTypeService |
| `/productCollect` | — | ProductCollectService |
| `/productBrowsingHistory` | — | ProductBrowsingHistoryService(去重插入) |
| `/productOrderEvaluate` | — | ProductOrderEvaluateService |
| `/shippingAddress` | — | ShippingAddressService |
| `/shopCollect` | — | ShopCollectService(联动 fans_count) |
| `/slideshow` | — | SlideshowService |
| `/advertising` | — | AdvertisingService |
| `/statisticalReportForms` | 2 个图表端点(商品类型占比 / 近 N 天销售总额,真实 SQL) | StatisticalReportFormsService |

> ⚠️ **`/common`、`/file`、`/shoppingCart` 三个控制器**没有**被删除** —— 它们曾一度被列在上面这张
> 「已删除」表里,那是错的,已移出。三者今天仍在服务,端点与授权如下(`/common` 的免登录路径见
> `config/SpringMvcConfig` 的 `excludePathPatterns`,其余在 `config/AuthzRules`);
> 一并列出本批**从白名单移入 `AuthzRules`** 的 `/checkout`:
>
> | 前缀 | 控制器 | 端点 | 授权 |
> |------|--------|------|------|
> | `/common` | `CommonController` | `login` / `register` / `sendResetCode` / `retrievePassword` / `resetPassword` / `currentUser` / `updateCurrentUser` / `updatePassword` | `login` / `register` / `sendResetCode` / `retrievePassword` 四个在 `SpringMvcConfig` 白名单(不走拦截器);`currentUser` / `updateCurrentUser` / `updatePassword` 三角色、`resetPassword` 仅 ADMIN(均在 `AuthzRules`) |
> | `/file` | `FilesController` | `POST /file/upload`、`GET /file/{fileName}`(MD5 命名落盘) | `/file/**` → 三角色;图片 GET 由 `LoginInterceptor` 提前放行 |
> | `/shoppingCart` | `ShoppingCartController` | 仅 `page` / `add` / `update` / `delBatch` 放行(USER);同控制器的 `selectById` / `list` / **`createOrder`** 未登记 → **默认拒绝** | USER |
> | `/checkout` | `StorefrontCheckoutController` | `POST /checkout/summary`、`POST /checkout/promo` | `AuthzRules` 的 `/checkout/**` → **仅 USER(买家)**,需登录,**匿名 401**;SHOP/ADMIN 命中规则但角色不匹配 ⇒ **403**(`AuthzRulesTest.rolesCannotCrossDomains` 专门钉住这一点)。2026-10-02 前这两条在 `SpringMvcConfig` 白名单里,导致券入口对已登录用户也不可用;移出后必须在 `AuthzRules` 登记,否则默认拒绝 403 |

## 3. 与前端契约的差异与缺口

对照 [docs/API接口说明.md](API接口说明.md),后端已通过门面控制器补齐了绝大部分路径,剩余差异:

| 差异点 | 说明 | 归属 |
|--------|------|----------|
| 授权收口 | 传统 CRUD 绝大多数前缀自 2026-09-24 起默认拒绝(403),仅购物车 4 个端点仍放行 —— 见 §2 | 重构 Phase 1a |
| 错误模型 | `msg` 与 `data` 双写原因(过渡态);补上 5 个缺失的异常处理器(畸形 JSON/类型不匹配/缺参数/方法不支持/无处理器:此前一律 500) | 重构 Phase 3 |
| `/payments/*` | ~~纯 mock,无表~~ 已不成立:Phase 2 建了 `payment` 表,下单会真实落库(order_no 唯一键) | 已完成 |
| `/checkout/summary` | ~~伪计算(信任前端 price)~~ 已不成立:现按 `product.price` 从 DB 重算 `subtotal/discount/total`;运费/税/满减档位**已从契约移除**。**需登录**(2026-10-02 移出白名单,匿名 401)。状态码:空 items / 参数不合法 → **400**、商品不存在 → **404** | 已完成 |
| `/checkout/promo` | ~~硬编码 `SAVE10`/`VIP15` 兜底~~ 已不成立:只认 coupon 表(归属/有效期/已用/门槛)。**需登录**(2026-10-02 移出白名单,匿名 401)。未达门槛仍为 **409**(见下注) | 已完成 |
| `/account/notifications` | ~~字段名不一致~~ 已不成立(买家侧本来就一致)。真缺陷是**缺参数校验**:三个偏好全缺曾返回 200 且不落库 → 现为 **400**(C6) | 已完成 |
| `/addresses/:id/default` | **501 未实现**:`shipping_address` 无 `is_default` 列 —— 该列由 `sql/migrations/V10__product_status_and_default_address.sql` 引入,**本轮未应用**(运维单独裁决)。已写入 [TASK-000/04b](TASK-000/04b-SCHEMA-REQUIREMENTS.md) §2 | 待应用 V10 |
| `/search/trending`、facets | ✅ 已真实化(见 §1.2) | 已完成 |
| `/products/category-counts` | ✅ 已真实化 | 已完成 |
| `/merchant/wallet*` | 无表;`GET` 恒 0 / 空列表 | 待 D2 + schema |
| `/merchant/settings`、`/admin/settings` | `GET` 硬编码;`PUT` **501**(未实现,此前返回 200 假成功) | 待 D2 + schema |
| 未实现的写端点 | **诚实降级约定:** 无落库表可写的写端点一律返回 **501 + 明确原因**,不再返回 200 假成功(本批:<br>`PUT /admin/settings`、`PUT /merchant/settings`、`POST /merchant/wallet/withdraw`、`PUT /addresses/:id/default`) | 已完成 |
| dashboard stats(admin/merchant) | ✅ 已真实化(见 §1.10 / §1.11) | 已完成 |
| `/merchants/:id/profile` | ✅ stats/featuredProducts 已真实化;`policies` 仍需 `merchant_setting` | 部分完成 |
| 商品/评论的 `status` 过滤 | 参数已接上,但 `product.status`(= V10)/ `review_status`(= V8)列**本轮未应用迁移** → 只有单一取值 | 待应用 V8/V10 |
| 管理端/商家端订单搜索 `?q=` | ✅ 已真实下推到 SQL | 已完成 |
| `/merchant/orders/:id/status` 快递单号 | 仍不记录(DTO 缺字段) | 待 D2 |
| 密码找回 | 前端 `email` vs 后端 `tel`;token 复用为 userId | 待办 |

> 注:「归属」列里「重构 Phase x」指 [REFACTOR_PLAN-BACKEND.md](REFACTOR_PLAN-BACKEND.md) 的阶段编号,
> 与本仓库原有的 Phase 1–4 路线图**不是同一套编号**,勿混。
>
> ✅ **已决(TASK-002-G2,原「未决」)**:契约 C2 把「未达门槛」也写成 400,但该分支是
> **本批之前就存在的 409**(`CouponServiceImpl.applyByCode` 走 `CustomException(String)` = 409),
> 且 `StorefrontPromoTest.belowMinOrderRejected` 刻意钉住「沿用既有错误码」,**无缺陷驱动**
> ⇒ Lead 裁决按最小范围修改:**维持 409,既不改码也不改测试**。
> C2 的 400 仅适用于「未领券 / 已使用 / 优惠码无效」三种情形。
> 即:实现 409 + 测试 409 + 本行 409,三方一致。

## 4. 维护约定

- 新增/修改端点时同步更新本文件与 `docs/API接口说明.md`(前端侧)及对应 `web/src/api/modules/*.ts`。
- 本文件可由各 `*Controller.java` 的 `@RequestMapping`/`@GetMapping` 等扫描生成,人工维护版本需保持与代码一致。
