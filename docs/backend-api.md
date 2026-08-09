# 后端接口契约清单(backend-api)

> 本文档列出 **Spring Boot 后端当前实际暴露的端点**(29 个 Controller),并标注每个端点的**实现状态**与所委托的 Service。
> 用途:与 [docs/API接口说明.md](API接口说明.md)(前端期望的接口)对照,找出路径/字段差异与缺口;也是实现各阶段路线图的起点清单。
> 状态标记:🟢 真实 · 🟡 部分(含占位) · 🔴 占位/mock · ⚪ 未建

## 0. 通用约定

- 统一响应 `ResponseVO<T>`:`{ code, msg, data }`,`code=200` 成功;分页 `PageVO<T>`:`{ list, total }`。
- 鉴权:默认需登录(`Authorization: Bearer <token>` 或 `token` 头);公开接口见 [ARCHITECTURE.md](ARCHITECTURE.md) §4 白名单。
- 角色:`/admin` 仅 ADMIN、`/merchant/` 仅 SHOP(LoginInterceptor.checkRole)。
- 后端模块包名 `com.project.platform`,主类 `ProjectManagement`,端口 1000。

---

## 1. 门面控制器(面向 Nexus 前端,12 个)

> 路径与 `web/src/api/modules/*.ts` 对齐;部分端点仍为硬编码占位(标 🔴/🟡)。

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
| GET | `/account/notifications` | 🔴 | 通知偏好硬编码返回 |
| POST | `/account/notifications` | 🔴 | no-op(不落库) |

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
| POST | `/checkout/promo` | 🔴 | 优惠码硬编码 `SAVE10`/`VIP15` |

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

---

## 2. 传统 CRUD 控制器(17 个)

> 标准模板:`page`(分页) / `selectById` / `list` / `add` / `update` / `delBatch`(批量删),均真实代理到对应 Service。下表只列前缀与额外业务端点。

| 前缀 | 额外业务端点 | Service |
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

| 差异点 | 说明 | 归属阶段 |
|--------|------|----------|
| `/payments/*` | 纯 mock,无表 | Phase 2 |
| `/checkout/*` | 伪计算 + 硬编码优惠码 | Phase 2 |
| `/account/notifications` | 硬编码 + no-op | Phase 1 (WP-3) |
| `/addresses/:id/default` | no-op | Phase 2 |
| `/search/trending`、facets | 硬编码/空 | Phase 3 |
| `/products/category-counts` | 硬编码 0 | Phase 3 |
| `/merchant/wallet*` | 无表 | Phase 3 |
| `/merchant/settings`、`/admin/settings` | 硬编码 + no-op | Phase 3 |
| dashboard stats(admin/merchant) | 硬编码 0 | Phase 3 |
| `/merchants/:id/profile` | stats 硬编码 | Phase 3 |
| 密码找回 | 前端 `email` vs 后端 `tel`;token 复用为 userId | Phase 4 |
| 前端 `updateProfile`(改密码) | 前端本地模拟,未调 `/common/updatePassword` | Phase 1 (WP-1) |
| 图片上传 | 前端 logo 未走 `/file/upload` | Phase 1 (WP-2) |

## 4. 维护约定

- 新增/修改端点时同步更新本文件与 `docs/API接口说明.md`(前端侧)及对应 `web/src/api/modules/*.ts`。
- 本文件可由各 `*Controller.java` 的 `@RequestMapping`/`@GetMapping` 等扫描生成,人工维护版本需保持与代码一致。
