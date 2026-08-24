# 功能模块与实现状态矩阵

> **核心资产**:逐模块厘清「真实 / 部分 / 占位 / 纯前端」边界,决定每一轮开发该补什么。
> 状态标记:🟢 真实(关 mock 可用)· 🟡 部分(能跑但含占位)· 🔴 占位(硬编码/无后端)· ⚪ 纯前端(localStorage,后端无对应)

## 1. 总览

| 区域 | 模块 | 前端页面 | 后端端点 | 状态 |
|------|------|----------|----------|------|
| 认证 | 登录/注册/改密/找回密码 | Login / Signup / ForgotPassword / ResetPassword | `/common/login` `/common/register` `/common/updatePassword` `/common/retrievePassword` | 🟢 真实(找回密码字段待对齐,见 §4) |
| 商品 | 列表/详情/推荐/销量榜 | Home / ProductDetail / Compare | `/products` `/products/:id` `/products/recommend/:size` `/products/sales-top/:size` | 🟢 真实 |
| 商品 | 分类计数 | Home 分类栏 | `/products/category-counts` | 🔴 占位(全部计数硬编码 0) |
| 搜索 | 建议/结果/趋势/分面 | SearchResults | `/search/suggestions` `/search` `/search/trending` | 🟡 suggestions 真实;trending 硬编码、facets 空 |
| 购物车 | 增删改/下单 | Cart | `/shoppingCart`(CRUD + `createOrder`) | 🟡 后端真实;**前端仍用 localStorage,未走后端** |
| 结算 | 金额汇总/优惠码 | Checkout | `/checkout/summary` `/checkout/promo` | 🟡 优惠码已接 coupon 表(`/checkout/promo` 先查券再兜底);金额仍信任前端 price(Phase 2 服务端校验) |
| 支付 | 创建/确认支付 | Checkout | `/payments/create` `/payments/confirm` | 🔴 纯 mock 返回,无表无业务 |
| 订单 | 我的订单/最近/仪表盘 | DashboardHome / Orders | `/orders` `/orders/recent` `/dashboard/stats` | 🟢 真实(代理 ProductOrderService) |
| 账户 | 资料/通知偏好 | dashboard/Settings | `/account/profile` `/account/notifications` | 🟢 真实(通知偏好落库 `user_notification_pref`) |
| 地址 | CRUD/默认 | dashboard/Addresses | `/addresses` CRUD | 🟡 CRUD 真实;`setDefaultAddress` no-op |
| 聊天 | 会话/消息/未读 | UserMessages / MerchantMessages / ChatWidget | `/chat/*` | 🟢 全量真实(唯一无 mock 兜底的模块) |
| 收藏/关注 | 心愿单/收藏/浏览历史/店铺关注 | Wishlist / ProductDetail | `/productCollect` `/productBrowsingHistory` `/shopCollect` | 🟡 后端真实;前端 Wishlist store 未同步后端 |
| 评价 | 评论/审核 | ProductDetail 评论区 / AdminReviews | `/productOrderEvaluate` + 管理端 | 🟢 真实 |
| 退换货 | 申请/状态 | dashboard/Returns | `/returns`(GET/POST) | 🟢 真实(`return_request` 表) |
| 优惠券 | 领券/使用 | dashboard/Coupons / Cart / Checkout | `/coupons` `/coupons/:id/claim` `/coupons/my-coupons` | 🟢 真实(`coupon` + `user_coupon` 表,checkout promo 已打通) |
| 到货订阅 | 订阅/通知 | ProductDetail | `/stock-alerts`(GET/POST/DELETE) | 🟢 真实(`stock_alert` 表) |
| 通知 | 用户/商家/管理 | admin/Notifications / MerchantLayout 铃铛 / 用户中心 | `/notifications` + 已读接口 | 🟢 真实(`notification` 表,按角色广播) |
| 商家端 | 仪表盘 | MerchantHome | `/merchant/dashboard/stats` `/low-stock` | 🔴 统计硬编码 0;low-stock 真实 |
| 商家端 | 商品管理 | merchant/Products | `/merchant/products` CRUD | 🟢 真实 |
| 商家端 | 订单管理 | merchant/Orders | `/merchant/orders*` | 🟢 真实 |
| 商家端 | 钱包/提现 | merchant/Wallet | `/merchant/wallet*` | 🔴 无表无 Service,余额恒 0,提现 no-op |
| 商家端 | 店铺设置 | merchant/Settings | `/merchant/settings` | 🔴 get 硬编码、update no-op;logo 上传仅 data URL |
| 管理端 | 仪表盘/收入图 | AdminHome | `/admin/dashboard/stats` `/revenue-chart` `/recent-users` | 🔴 stats 硬编码 0、revenue 空列表;recent-users 真实 |
| 管理端 | 用户管理 | admin/Users | `/admin/users*` | 🟢 真实 |
| 管理端 | 商家审核 | admin/Merchants | `/admin/merchants*` | 🟢 真实(approve/reject 真实) |
| 管理端 | 商品监管 | admin/Products | `/admin/products` `/ban` | 🟢 真实 |
| 管理端 | 订单管理 | admin/Orders | `/admin/orders*` `/cancel` | 🟢 真实 |
| 管理端 | 评论管理 | admin/Reviews | `/admin/reviews*` | 🟢 真实(updateReviewStatus 部分 no-op) |
| 管理端 | 系统设置 | admin/Settings | `/admin/settings` | 🔴 硬编码、update no-op |
| 店铺公开页 | 资料/商品 | StorePage | `/merchants/:id/profile` `/products` | 🟡 商品真实;profile stats/featured/policies 硬编码 |
| 文件 | 上传/访问 | 各页面上传 | `/file/upload` `/{fileName}` | 🟢 真实(MD5 命名落盘) |
| 统计 | 报表图表 | (传统后台) | `/statisticalReportForms` | 🟢 真实 SQL 聚合 |

## 2. 完整占位清单(按文件定位)

> 这些位置是「看似实现、实为占位」的代码,补全时以此为准。
> Phase 1(2026-08-08)已解决项已从清单移除:改密码对接、logo 上传、通知偏好落库、优惠券/退换货/到货订阅/通知后端化。

### 后端控制器占位(`src/main/java/com/project/platform/controller/`)

| 位置 | 行号 | 占位内容 |
|------|------|----------|
| `AdminApiController.getDashboardStats` | L34-42 | 4 个统计硬编码 `"$0"/"0"/"+0%"` |
| `AdminApiController.getRevenueChart` | L59-62 | `Collections.emptyList()` |
| `AdminApiController.updateReviewStatus` | L303-306 | no-op,永远成功 |
| `AdminApiController.updateSettings` / `getSettings` | L316-329 | 设置硬编码(`siteName "Nexus Market"`),更新 no-op |
| `MerchantApiController.getDashboardStats` | L38-46 | 统计硬编码 `"$0"/"0"` |
| `MerchantApiController.getWallet` | L152-159 | 余额/pending 恒 0,无后端支撑 |
| `MerchantApiController.getTransactions` | L161-164 | `Collections.emptyList()` |
| `MerchantApiController.withdraw` | L166-169 | no-op |
| `MerchantApiController.updateSettings` | L191-194 | no-op(getSettings 部分硬编码) |
| `StorefrontPaymentController.createPayment` | L47-57 | 吞异常,返回 mock `pay_*`/`ORD-随机`/`mock_secret` |
| `StorefrontPaymentController.confirmPayment` | L60-66 | 永远 `succeeded` |
| `StorefrontSearchController.getTrending` | L54-59 | 硬编码关键词数组 |
| `StorefrontSearchController.search` | L101-103 | facets 空 Map、relatedSearches 空 |
| `StorefrontProductController.getCategoryCounts` | L77-87 | 计数全部 0(注释 "Placeholder") |
| `StorefrontMerchantController.getProfile` | L45-59 | stats 硬编码、featuredProducts 空、policies 硬编码 |
| `StorefrontAddressController.setDefaultAddress` | L51-55 | no-op,不设默认地址 |
| `StorefrontCheckoutController` | L22-59 | `/checkout/summary` 用前端传入 price 直接计算(未服务端校验);`/checkout/promo` 已接 coupon 表(硬编码 SAVE10/VIP15 仅兜底) |

### 后端明确 TODO / Bug

| 位置 | 内容 |
|------|------|
| `UserServiceImpl.check` L213 | `entity.getId() != entity.getId()` 恒 false → 用户名查重失效 |
| `ProductOrderServiceImpl` L107/L125 | `//TODO 退款`(退款逻辑未完成) |
| `ProductMapper` L32 | `//TODO 图表` |

### 前端纯占位 / 本地模拟

| 位置 | 内容 |
|------|------|
| `web/src/components/ProductQA.vue` L28-75 | 问答硬编码 mock,提问/点赞仅前端状态 |
| `web/src/pages/admin/Products.vue` L115 | 商品详情描述为占位文案 |

### 前端 localStorage store 清单(后端同步状态)

| store | localStorage 键 | 后端对应 | 是否同步 |
|-------|----------------|----------|----------|
| cart | `nexus_cart_items` | `/shoppingCart` | ❌ 未同步 |
| wishlist | `nexus_wishlist_items` | `/productCollect` | ❌ 未同步 |
| browsingHistory | `nexus_browsing_history` | `/productBrowsingHistory` | ❌ 未同步 |
| compare | `nexus_compare_items` | — | ❌ 仅本地 |
| coupons | `nexus_user_coupons` | `/coupons` `/coupons/my-coupons` | ✅ 后端化(领券/我的券) |
| returns | `nexus_return_requests` | `/returns` | ✅ 后端化 |
| stockAlerts | `nexus_stock_alerts` | `/stock-alerts` | ✅ 后端化 |
| 钱包提现方式 | `merchant_withdraw_methods_mru_*` | — | ❌ 仅本地 |

## 3. 关键依赖关系与风险

1. **聊天是唯一无 mock 兜底的模块**(`chat.ts` 不读 USE_MOCK)→ 后端未启动时消息页/悬浮聊天必然报错。
2. **结算→支付→订单 主链路是断裂的**:`/checkout` 伪计算 + `/payments` 纯 mock + 订单虽真实但前端结算成功只在 mock 模式写本地订单(`Checkout.vue` L426-428)→ **关 mock 后结算成功不会出现在订单列表**。Phase 2 核心目标。
3. **生产构建默认 mock=true**(`.env.production` 未覆盖 `VITE_USE_MOCK`)→ 产物若后端未就绪会静默用假数据。
4. **密码找回前后端字段不匹配**:前端发 `email`、后端 `retrievePassword` 用 `tel`;`resetPasswordWithToken` 把 token 当 userId 拼 URL。
5. **前端 Debug 工具残留**:`FEATURE_DEV_LOGOUT` 仅定义无引用;原 `web/docs/` 陈旧工具文档(DebugPanel/Force Logout/Seed Data)描述的界面代码中不存在,文档已删除(2026-08-24)。
6. **外链图片**:商品图/头像均 Unsplash/Picsum 外链,离线时 ProductDetail 有三级 failover(主图→picsum→内联 SVG)。

## 4. 补全优先级建议

见 [ROADMAP.md](ROADMAP.md) Phase 1–4。简单结论:

- **Phase 1(✅ 2026-08-08 已完成)**:改密码对接、logo 上传、通知偏好落库、优惠券/退换货/到货订阅/通知后端化。
- **Phase 2**:主链路——结算服务端校验、模拟支付落库、购物车/订单全链路。
- **Phase 3**:后台真实化——钱包、dashboard 统计、设置持久化、搜索/店铺页真实化。
- **Phase 4**:质量收尾——生产 mock 开关、查重 bug、密码找回、JWT 密钥、退款、验证码、测试、文档同步。
