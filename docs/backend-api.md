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
| GET | `/products/category-counts` | 🔴 | 分类计数全硬编码 0(注释 "Placeholder") |
| GET | `/products/recommend/:size` | 🟢 | 推荐(浏览/收藏加权) |
| GET | `/products/sales-top/:size` | 🟢 | 销量榜(真实 SQL) |

### 1.2 搜索 /search — StorefrontSearchController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/search/suggestions?q=` | 🟢 | 建议(查产品标题/分类) |
| GET | `/search/trending` | 🔴 | 硬编码关键词数组 |
| POST | `/search` | 🟡 | 结果真实;facets 空 Map、relatedSearches 空 |

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
| GET | `/account/notifications` | 🟢 | 通知偏好(读 `user_notification_pref`,无记录时返回默认值) |
| POST | `/account/notifications` | 🟢 | 更新通知偏好(upsert 落库) |

### 1.6 地址 /addresses — StorefrontAddressController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/addresses` | 🟢 | 我的地址列表 |
| POST | `/addresses` | 🟢 | 新建地址 |
| PUT | `/addresses/:id` | 🟢 | 更新地址 |
| DELETE | `/addresses/:id` | 🟢 | 删除地址 |
| PUT | `/addresses/:id/default` | 🔴 | no-op,不设默认地址 |

### 1.7 结算 /checkout — StorefrontCheckoutController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| POST | `/checkout/summary` | 🔴 | 用前端传入 price 直接算,未按服务端 DB 校验 |
| POST | `/checkout/promo` | 🟡 | 先查 coupon 表(`CouponService.applyByCode`,含门槛/有效期校验),未命中再兜底硬编码 `SAVE10`/`VIP15` |

### 1.8 支付 /payments — StorefrontPaymentController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| POST | `/payments/create` | 🔴 | 吞异常,返回 mock `pay_*`/`ORD-随机`/`mock_secret`;无支付表 |
| POST | `/payments/confirm` | 🔴 | 永远返回 `succeeded` |

### 1.9 公开店铺 /merchants — StorefrontMerchantController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/merchants/:id/profile` | 🟡 | 商品真实;stats/featuredProducts/policies 硬编码 |
| GET | `/merchants/:id/products` | 🟢 | 店铺内商品(分类/排序/分页) |

### 1.10 管理端 /admin — AdminApiController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/admin/dashboard/stats` | 🔴 | 统计硬编码 `$0`/`0`/`+0%` |
| GET | `/admin/dashboard/recent-users` | 🟢 | 新用户列表 |
| GET | `/admin/dashboard/revenue-chart` | 🔴 | 空列表 |
| GET | `/admin/users` | 🟢 | 用户分页 |
| POST | `/admin/users/:id/toggle-status` | 🟢 | 启停用 |
| PUT | `/admin/users/:id` | 🟢 | 更新 |
| POST | `/admin/users/:id/reset-password` | 🟢 | 重置密码 |
| DELETE | `/admin/users/:id` | 🟢 | 删除 |
| GET | `/admin/merchants` | 🟢 | 商家分页 |
| POST | `/admin/merchants` | 🟢 | 创建商家 |
| PUT | `/admin/merchants/:id` | 🟢 | 更新商家 |
| POST | `/admin/merchants/:id/approve` | 🟢 | 审核通过 |
| POST | `/admin/merchants/:id/reject` | 🟢 | 审核拒绝 |
| DELETE | `/admin/merchants/:id` | 🟢 | 删除 |
| GET | `/admin/products` | 🟢 | 全站商品 |
| DELETE | `/admin/products/:id/ban` | 🟢 | 下架/封禁 |
| GET | `/admin/orders` | 🟢 | 全站订单 |
| POST | `/admin/orders/:id/cancel` | 🟢 | 取消订单 |
| GET | `/admin/reviews` | 🟢 | 评论列表 |
| PUT | `/admin/reviews/:id` | 🟡 | updateReviewStatus no-op(审核状态不落库) |
| DELETE | `/admin/reviews/:id` | 🟢 | 删除评论 |
| GET | `/admin/settings` | 🔴 | 设置硬编码 |
| PUT | `/admin/settings` | 🔴 | no-op |

### 1.11 商家端 /merchant — MerchantApiController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/merchant/dashboard/stats` | 🔴 | 统计硬编码 `$0`/`0` |
| GET | `/merchant/dashboard/low-stock` | 🟢 | 低库存商品 |
| GET | `/merchant/products` | 🟢 | 我的商品 |
| POST | `/merchant/products` | 🟢 | 创建 |
| PUT | `/merchant/products/:id` | 🟢 | 更新 |
| DELETE | `/merchant/products/:id` | 🟢 | 删除 |
| GET | `/merchant/orders` | 🟢 | 我的订单 |
| GET | `/merchant/orders/:id` | 🟢 | 订单详情 |
| PUT | `/merchant/orders/:id/status` | 🟢 | 更新状态 |
| GET | `/merchant/wallet` | 🔴 | 余额恒 0,无表无 Service |
| GET | `/merchant/wallet/transactions` | 🔴 | 空列表 |
| POST | `/merchant/wallet/withdraw` | 🔴 | no-op |
| GET | `/merchant/settings` | 🟡 | 部分硬编码 |
| PUT | `/merchant/settings` | 🔴 | no-op(店铺名改不了) |

### 1.12 聊天 /chat — ChatController

| 方法 | 路径 | 状态 | 说明 |
|------|------|------|------|
| GET | `/chat/conversations` | 🟢 | 会话列表(按当前用户过滤,JWT 联表出昵称头像) |
| GET | `/chat/conversations/:id/messages` | 🟢 | 消息列表 |
| POST | `/chat/messages` | 🟢 | 发消息(自动建会话) |
| PUT | `/chat/conversations/:id/read` | 🟢 | 标记已读 |

### 1.13 Phase 1 新增功能控制器(4 个)

> Phase 1(2026-08-08)后端化:优惠券 / 退换货 / 到货订阅 / 通知。均需登录(`/checkout/promo` 除外,已入白名单)。

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

| 已删除的前缀 | 额外业务端点(曾) | Service(已删) |
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
| `/shoppingCart` | `POST /shoppingCart/createOrder` 购物车下单 | ShoppingCartService |
| `/shippingAddress` | — | ShippingAddressService |
| `/shopCollect` | — | ShopCollectService(联动 fans_count) |
| `/slideshow` | — | SlideshowService |
| `/advertising` | — | AdvertisingService |
| `/statisticalReportForms` | 2 个图表端点(商品类型占比 / 近 N 天销售总额,真实 SQL) | StatisticalReportFormsService |
| `/file` | `POST /file/upload`、`GET /file/{fileName}`(MD5 命名落盘) | FileService |
| `/common` | `login` / `register` / `currentUser` / `updatePassword` / `retrievePassword` / `resetPassword`(登录/注册走这里) | UserService / ShopService / AdminService(CommonService) |

## 3. 与前端契约的差异与缺口

对照 [docs/API接口说明.md](API接口说明.md),后端已通过门面控制器补齐了绝大部分路径,剩余差异:

| 差异点 | 说明 | 归属 |
|--------|------|----------|
| 授权收口 | 传统 CRUD 绝大多数前缀自 2026-09-24 起默认拒绝(403),仅购物车 4 个端点仍放行 —— 见 §2 | 重构 Phase 1a |
| 错误模型 | `msg` 与 `data` 双写原因(过渡态);补上 5 个缺失的异常处理器(畸形 JSON/类型不匹配/缺参数/方法不支持/无处理器:此前一律 500) | 重构 Phase 3 |
| `/payments/*` | ~~纯 mock,无表~~ 已不成立:Phase 2 建了 `payment` 表,下单会真实落库(order_no 唯一键) | 已完成 |
| `/checkout/summary` | ~~伪计算(信任前端 price)~~ 已不成立:现按 `product.price` 从 DB 重算小计/运费/税/满减 | 已完成 |
| `/addresses/:id/default` | no-op | 待办 |
| `/search/trending`、facets | 硬编码/空 | 待办 |
| `/products/category-counts` | 硬编码 0 | 待办 |
| `/merchant/wallet*` | 无表 | 待办 |
| `/merchant/settings`、`/admin/settings` | 硬编码 + no-op | 待办 |
| dashboard stats(admin/merchant) | 硬编码 0 | 待办 |
| `/merchants/:id/profile` | stats 硬编码 | 待办 |
| 密码找回 | 前端 `email` vs 后端 `tel`;token 复用为 userId | 待办 |

> 注:「归属」列里「重构 Phase x」指 [REFACTOR_PLAN-BACKEND.md](REFACTOR_PLAN-BACKEND.md) 的阶段编号,
> 与本仓库原有的 Phase 1–4 路线图**不是同一套编号**,勿混。

## 4. 维护约定

- 新增/修改端点时同步更新本文件与 `docs/API接口说明.md`(前端侧)及对应 `web/src/api/modules/*.ts`。
- 本文件可由各 `*Controller.java` 的 `@RequestMapping`/`@GetMapping` 等扫描生成,人工维护版本需保持与代码一致。
