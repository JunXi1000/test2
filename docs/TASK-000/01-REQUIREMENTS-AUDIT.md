# TASK-000-A 需求盘点与用户故事（代码级审计）

> **产出者**：产品分析 Agent ｜ **日期**：2026-09 ｜ **方法**：读文档 → 逐文件回代码核对 → **以代码为准**
> **审计范围**：`src/main/java/com/project/platform/`（19 个 Controller + Service/Mapper）、`web/src/api/modules/*.ts`（35 个模块）、`web/src/stores/*`、`sql/`、`src/test/resources/schema-h2.sql`
> **本文档性质**：只界定「要做什么」和「怎么算做完」。**不含技术方案**（那是 TASK-000-B 的事）。本次审计**未修改任何业务代码 / SQL / 配置**。

---

## 0. 阅读指引与结论摘要

| 指标 | 数值 |
|---|---|
| 后端返回**硬编码假数据或 no-op** 的端点 | **23** 个（详见 §2） |
| 后端**静默失效**（接收参数但从不使用）的过滤器 | **8** 处（详见 §2.1） |
| 后端**零支撑**的纯前端功能 | **8** 项（详见 §4） |
| **数据模型结构性缺失** | 4 类（wallet/transaction、product.status、audit_log、stock 流水） |
| 文档漂移 | **9 处**（详见 §6） |
| 建议批次 | **5** 个（详见 §7） |

**一句话结论**：买家主链路（下单→支付→订单→取消）**确已真实**，文档对此的判断准确；但**管理端/商家端/店铺公开页/商品评价**四处存在系统性的编造数据问题，其中 `GET /merchants/{id}/profile` 返回的 **rating 4.5 / satisfactionRate 95 是凭空编造且对买家可见的信誉数字**，风险等级高于 admin 看板的 `$0`。

---

## 1. 缺口清单（四档，附文件路径证据）

图例：🟢 真实可用 ｜ 🟡 部分可用（含语义错误或局部占位）｜ 🔴 占位假数据 ｜ ⚫ 缺失

### 1.1 认证与账号安全

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 登录 / 注册 / 改密 / 找回密码 | `config/AuthzRules.java:52-56`、`config/SpringMvcConfig.java:21-24`、`controller/CommonController.java` |
| 🟢 | 授权模型（默认拒绝 + 显式规则表，路径段匹配） | `config/AuthzRules.java:50-103`、`interceptor/LoginInterceptor.java` |
| 🟡 | 通知偏好 | 真实落库 `user_notification_pref`；`controller/StorefrontAccountController.java:65-82` |
| ⚫ | 第三方登录（微信/支付宝/Google） | `web/src/api/modules/auth.ts` 无对应分支；无 OAuth 端点 |
| ⚫ | 手机绑定/解绑、登录设备管理、异常登录提醒 | 全项目零引用 |

### 1.2 商品与搜索

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 商品列表 / 详情 / 推荐 / 销量榜 | `controller/StorefrontProductController.java:34-105` |
| 🟡 | `GET /products` 分页 | 返回 `List<Product>` **无 total**，违反 REQ §7.2「分页统一 {list,total}」；`StorefrontProductController.java:65` |
| 🟡 | `GET /products` 价格排序 | `:60-64` 只对**当前页切片**排序，跨页结果错误 |
| 🔴 | 分类计数 | `StorefrontProductController.java:79-89` 全 0；`mapper/ProductMapper.java:34 selectTypeCount()` **已就绪但零调用** |
| 🔴 | 搜索 trending | `controller/StorefrontSearchController.java:54-59` 硬编码 5 个词 |
| 🔴 | 搜索 facets / relatedSearches | `StorefrontSearchController.java:102-103` 空 Map / 空列表 |
| 🔴 | 搜索建议 keywords | `StorefrontSearchController.java:46` `Collections.emptyList()`（**文档标 🟢 真实，未列此占位**） |
| ⚫ | **商品上下架**（REQ 3.1 P0） | `entity/Product.java` **无 `status` 字段**；`controller/AdminApiController.java:246-251 banProduct` 用 `setStock(0)` 代替下架，而 `:34-66` 列表**不过滤 stock=0** → 被封禁商品仍在列表页可见 |
| ⚫ | SPU/SKU、划线价、活动价 | `entity/Product.java` 扁平单表，无规格层 |
| ⚫ | 三级类目树 | `entity/ProductType.java` 单层 |
| ⚫ | 库存流水 / 操作审计 | `sql/`、`src/main/resources/**/*.xml` 全文检索 `stock_log|audit_log` **零命中** |

### 1.3 购物车 / 结算 / 支付

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 购物车 4 端点 + 归属收紧 | `config/AuthzRules.java:74-77`；`createOrder` 刻意未登记 → 默认拒绝（设计正确） |
| 🟢 | 结算金额按 DB 价重算 | `controller/StorefrontCheckoutController.java:53-64` |
| 🟢 | 支付建单 / 确认 / 3DS，幂等 | `controller/StorefrontPaymentController.java:37-83` |
| 🟢 | 库存原子扣减防超卖 | `mapper/ProductMapper.java:43 deductStock`、`:49 restoreStock`；`service/impl/ProductServiceImpl.java:100,115` |
| 🟡 | **结算展示总额 ≠ 实扣总额** | `StorefrontCheckoutController.java:76-84` 的 `total = subtotal+shipping+tax-discount` **仅展示**；实扣按 DB 价×数量。运费/税/优惠三项均不入账 |
| 🔴 | 硬编码优惠码兜底 | `StorefrontCheckoutController.java:111-117` 接受 `SAVE10`/`VIP15`，**无券记录、无核销、可无限次重复使用** |
| 🟡 | 游客购物车合并（REQ 3.3 P0） | `web/src/stores/cart.ts:37 serverEnabled = !USE_MOCK`；游客态恒 localStorage，登录后无合并逻辑 |
| ⚫ | 库存预占（soft-hold） | 下单即实扣；仅靠 30 分钟超时任务回补 |
| ⚫ | 真实支付网关 / 回调验签 / 对账 | `StorefrontPaymentController.java:43 clientSecret 恒 null` |

### 1.4 订单

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 订单列表按 order_no 分组 / 最近 / 取消 | `controller/StorefrontOrderController.java:25-48` |
| 🟢 | 取消退款按渠道分流 + 幂等 | `service/impl/ProductOrderServiceImpl.java` `cancelRows` / `cancelByOrderNo` |
| 🟡 | **买家仪表盘订单数按「行」计数** | `controller/StorefrontDashboardController.java:31-37` 同一 `order_no` 的多行被重复计入 `Total Orders`；与 `/orders` 的分组口径**不一致** |
| 🟡 | 买家仪表盘 Pending 计算 | `:42` `total - inTransit - completed - cancelled`，遇到非枚举状态即算错 |
| 🟡 | 商家改状态无状态机前置校验 | `controller/MerchantApiController.java:154-165` `delivered` 可从「待支付」直达「已完成」，违反 REQ §4.4「禁止跳转」 |
| 🟢 | **商家订单归属校验（读/改/取消）** | Controller 层无 `AccessGuard` 调用属**正常的纵深防御分工**——归属校验下沉在 Service 层：`GET` → `ProductOrderServiceImpl.java:75`；`PUT` 非取消分支 → `:117-118`（注释明写「防御直接调用 updateById 的越权」）；`PUT` 取消分支 → `cancelByOrderNo` `:197-198` 逐行校验；旧链路 `cancel(id)` → `:401` 复用带校验的 `selectById`。`AccessGuard.checkOrderOwner`（`utils/AccessGuard.java:34-38`）对 SHOP 比对 `order.getShopId()` vs `current.getId()`，语义正确。**四条路径无一漏网**（2026-09 勘误，原判「2 处 IDOR」为误判） |
| 🔴 | 发货不写快递单号 | `MerchantApiController.java:156-159` `trackingNumber` 置空串，REQ 3.7「商家填写快递单号」未落地 |
| ⚫ | 多店铺拆单 | 当前单店模型 |
| ⚫ | 超时自动收货（发货后 15 天） | `task/OrderTimeoutTask.java` 仅做未支付取消 |

### 1.5 评价（P0 缺失，且当前展示 100% 为假）

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🔴 | **商品详情页展示的评价全部是硬编码种子** | `web/src/api/modules/reviews.ts:43-148`（8 条，含用户名/头像/日期/"Store Support" 回复），`:173-175` 按商品 id 存 localStorage |
| 🟡 | 管理端评论列表/删除真实，但**表无写入方** | `controller/AdminApiController.java:291-310, 319-323` 真实读删 `product_order_evaluate`；但全项目**无任何写入该表的端点** → 列表恒空 |
| 🔴 | 审核状态不落库 | `AdminApiController.java:312-317` no-op，**返回 200** |
| 🔴 | 评论 status 字段编造 | `AdminApiController.java:306` 恒 `"visible"` |
| ⚫ | 买家发布评价 / 追评 / 商家回复 / 晒图 | `web/src/api/modules/` 无任何买家评价 API |

### 1.6 售后

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 买家提交/列表 + 归属校验 + 退款额以实付为上限 | `controller/ReturnRequestController.java:46-79` |
| ⚫ | 审批流转（无审批端点 → 退货不触发退款） | `AuthzRules.java:68` `/returns/**` 仅放行 `USER`，SHOP/ADMIN 均 403；`ReturnRequestController` 只有 GET/POST |
| ⚫ | 换货 / 工单升级 | 零端点 |
| ⚫ | 物流轨迹 / 运费模板 | 零端点 |

### 1.7 优惠券 / 通知 / 聊天 / 文件 —— 🟢 真实

| 证据 |
|---|
| `controller/CouponController.java`、`ReturnRequestController.java`、`StockAlertController.java`、`NotificationController.java`、`ChatController.java`、`FilesController.java` 逐行核对，端点均有 Service + Mapper 支撑，无硬编码 |

### 1.8 管理端（admin）

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 用户管理（列表/改/启停/重置密码/删） | `AdminApiController.java:70-130` |
| 🟢 | 商家管理（列表/建/改/approve/reject/删） | `AdminApiController.java:134-217` |
| 🟢 | 订单列表 / 强制取消 | `AdminApiController.java:255-287` |
| 🟡 | 响应体违约 | `/admin/users`、`/admin/merchants`、`/admin/products`、`/admin/orders`、`/admin/reviews` 均返回 `List<...>` 而非 `PageVO{list,total}`，分页硬编码 `:225 page=1,size=100`、`:267 page=1,size=1000` |
| 🔴 | 仪表盘 stats | `AdminApiController.java:35-46` 4 个硬编码 `$0`/`0`/`+0%` |
| 🔴 | 收入图 | `AdminApiController.java:63-66` `Collections.emptyList()` |
| 🔴 | 商家列表 revenue | `AdminApiController.java:163` 恒 `0` |
| 🔴 | 商品列表 status | `AdminApiController.java:239` 恒 `"active"` |
| 🔴 | 评论列表 status | `AdminApiController.java:306` 恒 `"visible"` |
| 🔴 | 系统设置 GET | `AdminApiController.java:327-335` 硬编码 4 个值 |
| 🔴 | 系统设置 PUT | `AdminApiController.java:337-342` no-op，**返回 200** |
| ⚫ | 营销配置界面 / RBAC 角色-权限配置 / 审计日志 | 零端点；角色为代码常量（`AuthzRules.java:35-37`） |

### 1.9 商家端（merchant）

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | 商品 CRUD（**有归属校验**） | `MerchantApiController.java:71-105` |
| 🟢 | 订单列表 / 低库存 | `MerchantApiController.java:50-67, 109-130` |
| 🔴 | 仪表盘 stats | `MerchantApiController.java:38-48` 4 个硬编码 |
| 🔴 | 钱包余额 | `MerchantApiController.java:185-192` `balance=0, pending=0`；**`sql/` 无 wallet 表** |
| 🔴 | 钱包流水 | `MerchantApiController.java:194-197` 空列表；**无表** |
| 🔴 | 提现 | `MerchantApiController.java:199-205` no-op，**返回 200**（前端以为已受理） |
| 🔴 | 店铺设置 GET 部分字段 | `MerchantApiController.java:220-223` `location="Unknown"`、`responseTime="< 1 hour"`、`policies` 空、`notifications` 硬编码；且 `:214` shop 为 null 时只返回这 4 个假字段，`storeName/logo/email` 全缺 |
| 🔴 | 店铺设置 PUT | `MerchantApiController.java:227-232` no-op，**返回 200**（店铺名改不了） |

### 1.10 店铺公开页 —— **最高信任风险**

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🔴 | **店铺评分 4.5、满意度 95% 是凭空编造且对买家可见** | `controller/StorefrontMerchantController.java:46-51` `stats.put("rating", 4.5)` / `satisfactionRate, 95` / `followers, 0` / `totalSales, 0` |
| 🔴 | 位置与响应时间编造 | `StorefrontMerchantController.java:42-43` `"Unknown"` / `"< 1 hour"` |
| 🔴 | 售后/运费政策编造 | `StorefrontMerchantController.java:54-57` 硬编码英文文案 `"Free shipping on orders over $50."` / `"30-day returns."` |
| 🔴 | 精选商品恒空 | `StorefrontMerchantController.java:59` |
| 🔴 | 分类栏恒只有「全部」 | `StorefrontMerchantController.java:79` `List.of("All")` |
| 🔴 | **分类筛选参数从不生效** | `StorefrontMerchantController.java:66` 接收 `category`，`:71-74` **从不放入 query** |
| 🟡 | 店铺不存在返回 200 + "Unknown Store" | `StorefrontMerchantController.java:31-35`（应 404） |
| 🟢 | 店铺商品列表本身真实 | `StorefrontMerchantController.java:63-81`（分页字段正确） |

### 1.11 地址

| 档 | 项目 | 证据 |
|:-:|---|---|
| 🟢 | CRUD（**有归属校验**） | `StorefrontAddressController.java:25-54` |
| 🔴 | 设为默认地址 | `StorefrontAddressController.java:56-60` no-op，注释 `// Simple implementation` |

### 1.12 纯前端功能（后端零支撑）

| 功能 | store / 模块 | localStorage key | 后端 |
|---|---|---|---|
| 收藏 / 心愿单 | `web/src/stores/wishlist.ts:16` | `nexus_wishlist_items` | 端点 2026-09-24 已删 |
| 浏览历史 | `web/src/stores/browsingHistory.ts:15` | `nexus_browsing_history` | 同上 |
| 店铺关注 | `web/src/stores/followedStores.ts:20` | `nexus_followed_stores` | 同上 **（文档未列）** |
| 积分 / 会员等级 | `web/src/stores/loyalty.ts:24` + `web/src/api/modules/loyalty.ts:24-28` | `nexus_loyalty` | 无 **（文档未列）** |
| 积分商城兑换 | `web/src/api/modules/loyalty.ts:44-75` | — | 无；兑换出的是**前端构造的券码字符串**，不入 coupon 表 |
| 提现方式 / 预设 | `web/src/pages/merchant/Wallet.vue:413-415` | `merchant_withdraw_methods_mru_v2` 等 3 个 | 无 |
| 商品问答 | `web/src/components/ui/ProductQA.vue:28-75` | 组件内状态 | 无（文档已列） |
| 商品对比 | `web/src/stores/compare.ts:14` | `nexus_compare_items` | 无（设计如此，可接受） |

> **连带失效**：`ProductCollectMapper` / `ProductBrowsingHistoryMapper` 虽保留，但因无写入端点，`GET /products/recommend/{size}` 的个性化权重**恒为空**，退化为纯热门（与 `web/CLAUDE.md` §6 记载一致，此处独立复核确认）。

---

## 2. 假数据清单（最高优先级 · 已穷尽）

> 判定标准：返回体中至少一个业务字段的值与数据库真实状态**无任何关联**，或端点接受入参但从不读取。
> 全部 20 条均已逐行阅读确认。
>
> ⚠️ **2026-09 勘误**：原表 #3/#4（`/merchant/orders/{id}` 的 GET 与 PUT「IDOR 越权」）**已删除**。经复核，归属校验下沉在 Service 层且四条路径无一漏网（`ProductOrderServiceImpl.java:75`/`:117-118`/`:197-198`/`:401`），Controller 层无 `AccessGuard` 调用属正常的纵深防御分工。**下游 Agent 不得为此在 Controller 里叠加重复校验**——`AuthorizationBaselineTest` 的现有越权用例是按当前 Service 层行为写的，重复校验可能改变异常来源或状态码、导致回归网变红。后续编号已顺序前移。

| # | Method | URL | 文件:行 | 当前返回 | 应返回 | 优先级 |
|:-:|---|---|---|---|---|:-:|
| 1 | GET | `/merchants/{id}/profile` | `StorefrontMerchantController.java:41-59` | `location:"Unknown"`、`responseTime:"< 1 hour"`、`stats{rating:4.5, totalReviews:0, totalProducts:0, totalSales:0, satisfactionRate:95, followers:0}`、硬编码 policies、`featuredProducts:[]` | 全部真实聚合；无数据时返回 0 / 空，**禁止编造** | **P0** |
| 2 | POST | `/checkout/promo` | `StorefrontCheckoutController.java:111-117` | 接受硬编码 `SAVE10`(10%)、`VIP15`(15%)，无券记录、可无限次复用 | 仅走 coupon 表；未命中返回 400「优惠码无效」 | **P0** |
| 3 | GET | `/merchants/{id}/products` | `StorefrontMerchantController.java:66, 71-74, 79` | `category` 参数从不生效；`categories` 恒 `["All"]` | 真实分类列表 + 生效的 category 过滤 | P0 |
| 4 | GET | `/admin/dashboard/stats` | `AdminApiController.java:35-46` | 4 个硬编码 `$0`/`0`/`+0%` | 今日 GMV / 活跃用户 / 订单数 / 在售商品数（真实 SQL 聚合） | P0 |
| 5 | GET | `/admin/dashboard/revenue-chart` | `AdminApiController.java:63-66` | `Collections.emptyList()` | 近 N 天按日 GMV 序列 | P0 |
| 6 | GET | `/admin/settings` | `AdminApiController.java:327-335` | 硬编码 `Nexus Market` / `false` / `true` / `5.0` | `system_setting` 表读取 | P0 |
| 7 | PUT | `/admin/settings` | `AdminApiController.java:337-342` | no-op，**返回 200** | upsert 落库 | P0 |
| 8 | POST | `/merchant/wallet/withdraw` | `MerchantApiController.java:199-205` | no-op，**返回 200**（前端显示提现成功） | 余额校验 → 扣减 → 流水记录 | P0 |
| 9 | GET | `/merchant/wallet` | `MerchantApiController.java:185-192` | `balance=0, pending=0` | 余额表查询（**当前无表**） | P0 |
| 10 | GET | `/merchant/wallet/transactions` | `MerchantApiController.java:194-197` | `Collections.emptyList()` | 流水表查询（**当前无表**） | P0 |
| 11 | PUT | `/merchant/settings` | `MerchantApiController.java:227-232` | no-op，**返回 200**（店铺名改不了但提示成功） | 落库 | P0 |
| 12 | GET | `/merchant/settings` | `MerchantApiController.java:220-223` | `location:"Unknown"`、`responseTime`、`policies{}`、`notifications` 硬编码 | 落库；shop 为 null 时不得返回假字段 | P0 |
| 13 | GET | `/merchant/dashboard/stats` | `MerchantApiController.java:38-48` | 4 个硬编码 `$0`/`0`/`0%` | 本店真实聚合 | P0 |
| 14 | GET | `/products/category-counts` | `StorefrontProductController.java:79-89` | 全部计数 `0` | 接 `ProductMapper.selectTypeCount()`（`mapper/ProductMapper.java:34`，**已就绪**） | P0 |
| 15 | GET | `/search/trending` | `StorefrontSearchController.java:54-59` | 硬编码 `["Phone","Laptop","Headphones","Watch","Camera"]` | 基于真实日志；无日志返回 `[]` | P1 |
| 16 | POST | `/search` | `StorefrontSearchController.java:102-103` | `facets` 空 Map、`relatedSearches` 空列表 | 真实聚合计数 | P1 |
| 17 | GET | `/search/suggestions` | `StorefrontSearchController.java:46` | `keywords` 恒 `[]` | 真实关键词建议 | P1 |
| 18 | GET | `/admin/merchants` | `AdminApiController.java:163` | 每个商家 `revenue` 恒 `0` | 该商家已支付订单金额合计 | P1 |
| 19 | GET | `/admin/products` | `AdminApiController.java:239` | 每个商品 `status` 恒 `"active"` | 真实上下架状态（**需先加 `product.status` 列**） | P1 |
| 20 | GET | `/admin/reviews` | `AdminApiController.java:306` | 每条评论 `status` 恒 `"visible"` | 真实审核状态 | P1 |
| + | PUT | `/admin/reviews/{id}` | `AdminApiController.java:312-317` | no-op，**返回 200** | 审核状态落库 | P1 |
| + | PUT | `/addresses/{id}/default` | `StorefrontAddressController.java:56-60` | no-op，**返回 200** | 落库 `is_default` + 清除同用户其他默认标记 | P1 |
| + | — | 商品详情页评价区 | `web/src/api/modules/reviews.ts:43-148` | 8 条硬编码种子评价，含编造的用户名/头像/"Store Support" 回复 | 真实 `product_order_evaluate` 数据 | **P0** |

> 统计口径：端点级 **20**（表内 20 行）+ 追加 3 行 = **23 个端点/界面返回编造数据或不落库的 200**。

### 2.1 静默失效的过滤参数（返回 200 但结果与请求无关，UI 上表现为"筛选坏了"）

| 端点 | 位置 | 现象 |
|---|---|---|
| GET `/admin/users?role=X` | `AdminApiController.java:77` | `if (role != null && !"all".equals(role)) return false;` → **任何非 all 的 role 一律返回空列表** |
| GET `/admin/products?status=X` | `AdminApiController.java:224, 227-231` | `status` 接收后从未使用 |
| GET `/admin/orders?q=X` | `AdminApiController.java:256, 268-279` | `q` 接收后从未使用 |
| GET `/admin/reviews?q=X&status=X` | `AdminApiController.java:294, 296-308` | 两个参数均从未使用 |
| GET `/merchant/products?status=X` | `MerchantApiController.java:74, 76-79` | `status` 接收后从未使用 |
| GET `/merchant/orders?q=X` | `MerchantApiController.java:112, 113-127` | `q` 接收后从未使用 |
| GET `/merchants/{id}/products?category=X` | `StorefrontMerchantController.java:66, 71-74` | `category` 接收后从未使用 |
| GET `/dashboard/stats` | `StorefrontDashboardController.java:42` | Pending 用减法推导，遇非枚举状态即错 |

---

## 3. 候选批次划分

> 排序依据：**改动风险 × 收益**。风险 = 是否触碰 schema / 资损链路 / 状态机。
> 批次 4 与 5 无相互依赖，可并行。

### 批次 1 — 信任止血（不动 schema，改动风险最低，收益最高）

| 项 | 内容 |
|---|---|
| **目标** | 消灭一切「向用户展示编造数字」的行为；让 no-op 不再返回 200 |
| **包含模块** | 假数据 #1、#2、#3、#8、#17；追加行 `reviews.ts` 种子评价；静默过滤器 7 处；`banProduct` 语义；`/dashboard/stats` 行/组口径；`/checkout/summary` 展示总额与实付不一致；结算 promo 硬编码券；订单状态机跳转与发货快递单号（US-02） |
| **不涉及** | 任何建表；任何**退款**逻辑（不动资损链路） |
| **验收标准** | 见 §4 US-01 ~ US-04、US-09 |
| **前置依赖** | 无（可立即开工）。checkout 部分已由 **TASK-000-I** 单独承接 |
| **风险** | **低**。主要风险是口径统一：`/dashboard/stats` 改为按 `order_no` 分组计数会改变已有展示数字，属预期变更。checkout 金额口径**已裁定**（Q1 采纳变体 c：运费/税不得进入应付总额，详见 §7），不再是待决项 |

### 批次 2 — 设置与钱包持久化（需新建 3 张表）

| 项 | 内容 |
|---|---|
| **目标** | `system_setting` + 店铺设置字段落库；`wallet` / `wallet_transaction` 建表并打通提现闭环 |
| **包含模块** | 假数据 #8~#14、#20 |
| **验收标准** | 见 §4 US-05、US-06 |
| **前置依赖** | 批次 1（先把假字段删干净，避免"落库后仍显示旧假值"） |
| **风险** | **中**。⚠️ 新表必须三处同步（`sql/`、`src/main/resources` 或 mapper XML、`src/test/resources/schema-h2.sql`），否则 7 个 H2 测试全红。提现涉及资金，建议首批只做「余额/流水只读 + 提现记录 pending」，**真实打款后置** |

### 批次 3 — 看板统计真实化

| 项 | 内容 |
|---|---|
| **目标** | admin/merchant dashboard stats + revenue-chart 用真实 SQL 聚合；分类计数接现成 Mapper |
| **包含模块** | 假数据 #4、#5、#6、#7、#13、#14、#15、#16、#18、#19、#20 |
| **验收标准** | 见 §4 US-07、US-08 |
| **前置依赖** | 批次 2（商家 GMV 与钱包余额口径必须一致，否则看板收入与钱包对不上） |
| **风险** | **中高**。原参考实现 `StatisticalReportFormsService` 已随 14 个遗留控制器删除，聚合 SQL 需重写。需与批次 1 的行/组口径统一，避免"看板一套口径、订单页另一套" |

### 批次 4 — 评价与售后闭环（涉及退款，资损风险最高）

| 项 | 内容 |
|---|---|
| **目标** | 买家发布评价/列表 + 商家回复（**追评本期不做**，Q5 裁定后置）；退货审批流转打通（申请→同意→寄回→确认→退款） |
| **包含模块** | 追加行 `reviews.ts` 种子评价、#20、`PUT /admin/reviews/{id}`（Q2：补实现不删端点）；`/returns` 审批端点；`AuthzRules` 新增商家/管理端退货规则 |
| **验收标准** | 见 §4 US-10、US-11 |
| **前置依赖** | 批次 2（`return_request` 可能需加状态字段 → 迁移脚本） |
| **风险** | **高**。退款金额计算与库存回补路径一旦改错会造成资损。**建议批次 4 内部再切两刀**：4a 只做评价（不涉资金），4b 再做退货审批 |

### 批次 5 — 商品状态与搜索完整化

| 项 | 内容 |
|---|---|
| **目标** | `product.status` 列 + 商家上下架端点 + 全链路过滤；三级类目树；全局价格排序；trending/facets |
| **包含模块** | 假数据 #14、#15、#16、#19；`banProduct` 语义改造；分页响应体对齐 `PageVO` |
| **验收标准** | 见 §4 US-12、US-13 |
| **前置依赖** | 批次 3（改商品过滤会同时改变统计口径） |
| **风险** | **中高**。`product` 加列 + 商品列表/详情/结算/统计全线回归；`/products` 加过滤会影响买家主链路，须完整跑通下单→支付→订单 |

---

## 4. 用户故事与验收标准（AC）

> **AC 编写规则**：每条均可由测试 Agent 用「HTTP 调用 + 数据库查询」客观判定，不含"体验良好""性能可接受"等不可验证描述。
> 判定用词统一为：**通过 = 断言全部成立**；**失败 = 任一断言不成立**。

### 批次 1

**US-01｜作为买家，我打开任何店铺页时，看到的评分与销量必须来自真实数据，不存在编造数字**
- **AC-01.1** 调用 `GET /merchants/{id}/profile`，断言 `data.stats.rating` ∈ `[0,5]` 且等于该店全部评价 `AVG(rate)`（无评价时为 `0`）；断言 `data.stats.rating ≠ 4.5` **当且仅当** DB 中该店无任何评价。
- **AC-01.2** 同接口，断言 `data.stats.satisfactionRate`、`data.stats.followers`、`data.stats.totalSales`、`data.stats.totalProducts` 四者**全部**可由 DB 单表聚合复算得出；断言 `data.stats.totalSales == SUM(已支付订单金额 WHERE shop_id=?)`。
- **AC-01.3** 同接口，断言 `data.location` 与 `data.responseTime` 在 DB 无对应记录时为 `""` 或 `null`，**不得**为 `"Unknown"` / `"< 1 hour"`。
- **AC-01.4** 同接口，断言 `data.policies.shipping` 与 `data.policies.returns` 来自 DB；DB 无记录时为 `""`。
- **AC-01.5** 调用 `GET /merchants/{不存在的id}/profile`，断言 **HTTP 404** 且响应体 `code != 200`。
- **AC-01.6** 全量扫描 `web/src/pages/**`：断言无任何 `.vue` 文件把上述 4 个 stats 字段以常量形式硬编码（`rating: 4.5` 等）渲染。

**US-02｜作为商家，我改订单状态时只能走合法的状态流转，并且发货必须留下快递单号**
- **AC-02.1** 用 `shop1` 调用 `PUT /merchant/orders/{自己订单}/status` 且 `status` 为 `delivered`，而该订单当前为「待支付」，断言 **HTTP 400**（状态机禁止跳转；当前 `MerchantApiController.java:154-165` 允许任意状态直达「已完成」）。
- **AC-02.2** `shop1` 对自己订单 `status=shipped` 调用成功，断言 DB `tracking_number` **非空字符串**（当前 `:156-159` 置空串，REQ 3.7「商家填写快递单号」未落地）。
- **AC-02.3** 回归（**当前已成立，仅作护栏**）：用 `shop1` 调用 `GET/PUT /merchant/orders/{shop2的id}`，断言 **HTTP 403** 且 DB 中该订单 `status` 未变化。归属校验在 Service 层（`ProductOrderServiceImpl.java:75`/`:117-118`），**本条用于防止修复过程中误破坏既有防线，不是待修缺陷**。

**US-03｜作为平台管理员，我看到的每个统计数字都能追溯到真实聚合**
- **AC-03.1** 造数：3 笔已支付订单（金额 100/200/300）、1 笔已取消、2 个新注册用户。调用 `GET /admin/dashboard/stats`，断言 4 个指标的 value **全部**可由这些数据复算得出；断言 Revenue 指标 == `600`（非 `$0`）。
- **AC-03.2** 调用 `GET /admin/dashboard/revenue-chart`，断言返回数组 `size >= 1`，且**每个**元素的 `value` 等于该日已支付订单金额之和。
- **AC-03.3** 调用 `GET /admin/merchants`，断言每个元素的 `revenue` 等于该商家已支付订单金额之和；断言存在至少一个 `revenue != 0` 的元素。
- **AC-03.4** 调用 `GET /admin/products`，断言每个元素的 `status` 反映 DB 真实上下架状态；断言当 DB 中存在下架商品时，返回结果中该商品 `status != "active"`。
- **AC-03.5** 调用 `GET /admin/reviews`，断言每个元素的 `status` 等于 DB 中该评价的真实审核状态字段值（DB 无该字段时，此条判为**不适用**并记录）。
- **AC-03.6** 调用 `GET /admin/users?role=user`（非 `all`），断言返回**非空**列表（当前实现恒返回空）；调用 `?role=all` 断言返回全部。
- **AC-03.7** 调用 `GET /admin/products?status=<某状态>`，断言返回结果**全部**处于该状态（当前实现忽略参数恒返回全部）。
- **AC-03.8** 调用 `GET /admin/dashboard/recent-users`，断言返回的 5 个用户的 `joinedAt` 是全表**最大**的 5 个 createTime（当前实现取的是前 5 条）。

**US-04｜作为买家，结算页展示的应付金额等于我实际被扣的金额**
- **AC-04.1** 选定 2 个商品（共 X），调用 `POST /checkout/summary`，记录返回的 `total`。
- **AC-04.2** 立即调用 `POST /payments/create` 落单，断言返回的 `amount` **等于** AC-04.1 的 `total`（容差 0.01 以内）。
- **AC-04.3** 断言 AC-04.2 后 DB 中订单行的 `total_money` 等于 AC-04.2 的 `amount`。
- **AC-04.4** 用优惠码 `SAVE10` 调用 `POST /checkout/promo`，断言 **HTTP 4xx**（未在 `coupon` 表中登记的码一律拒绝）。
- **AC-04.5** 用优惠码 `VIP15` 重复调用 AC-04.4 三次，断言三次**全部**返回 4xx（当前实现三次均成功）。
- **AC-04.6** 在 `coupon` 表中登记一张有效券后，用其码调用 `POST /checkout/promo`，断言返回 200 且 `discount > 0`，并断言该券的核销/使用状态在支付成功后被更新。

---

### 批次 2

**US-05｜作为平台管理员，我改的系统设置在刷新后仍然生效**
- **AC-05.1** 调用 `PUT /admin/settings`，body 传 `siteName="验收测试站点"`，断言 HTTP 200。
- **AC-05.2** 重新调用 `GET /admin/settings`，断言 `data.siteName == "验收测试站点"`（当前实现恒返回 `"Nexus Market"`）。
- **AC-05.3** 在新 HTTP 会话（不带任何前端状态）再次调用 `GET /admin/settings`，断言值仍一致（证明已落库，非内存缓存）。
- **AC-05.4** 直接查 DB 对应表，断言存在该配置行。
- **AC-05.5** 断言 `GET /admin/settings` 返回的 4 个字段**全部**可由 DB 复算（不允许任何硬编码兜底值）。

**US-06｜作为商家，我能修改店铺资料，且资金流转有据可查**
- **AC-06.1** 调用 `PUT /merchant/settings`，body 传 `storeName="验收店铺A"`，断言 HTTP 200；调用 `GET /merchant/settings` 断言 `data.storeName == "验收店铺A"`（当前实现恒为 DB 旧值，`PUT` 静默丢弃）。
- **AC-06.2** 断言 `GET /merchant/settings` 返回的 `location`、`responseTime`、`policies`、`notifications` 四个字段**全部**来自 DB；DB 无记录时为 `""` / 空对象 / 全 false，**不得**出现 `"Unknown"` / `"< 1 hour"`。
- **AC-06.3** 断言当 `shopService.selectById` 返回 null 时，`GET /merchant/settings` 返回 **HTTP 404**，而非一组假字段。
- **AC-06.4** 断言 `GET /merchant/wallet` 的 `balance` 等于 DB 中该商家余额表之和（当前恒 0）。
- **AC-06.5** 断言 `GET /merchant/wallet/transactions` 返回条数 == DB 中该商家流水表行数（当前恒 0 条）。
- **AC-06.6** 调用 `POST /merchant/wallet/withdraw`，`amount` **大于**余额，断言 **HTTP 4xx**（当前实现返回 200）。
- **AC-06.7** 调用 `POST /merchant/wallet/withdraw`，`amount` **小于**余额，断言 HTTP 200，且：① DB 余额减少该值；② 流水表新增 1 条 `withdrawal` 记录；③ 重复调用同一请求，第二次返回 4xx（幂等，不重复扣款）。
- **AC-06.8** 断言 `src/test/resources/schema-h2.sql` 中存在批次 2 新增的全部表定义（否则 H2 测试全红）。

---

### 批次 3

**US-07｜作为商家/管理员，首页数字与订单、商品列表页对得上**
- **AC-07.1** 造数：同一商家 4 笔已支付订单、1 笔已取消、1 笔待支付。调用 `GET /merchant/dashboard/stats`，断言 `Orders` 指标 == 已支付订单**组数**（按 `order_no` 去重），而非行数；断言 `Total Sales` == 已支付金额之和。
- **AC-07.2** 调用 `GET /admin/dashboard/stats`，断言 `Sales` 指标 == 全站已支付订单组数；`Active Users` == `user` 表中 `status='启用'` 的行数。
- **AC-07.3** 断言 `/dashboard/stats`（买家侧）与 `/orders`（买家侧）使用**同一**计数口径：同一用户造 1 笔含 3 个商品的订单，断言 `/orders` 返回 1 个分组且 `/dashboard/stats` 的 `Total Orders` == 1（当前实现为 3）。
- **AC-07.4** 断言 `Low Stock`（`/merchant/dashboard/low-stock`）返回的每个商品 `stock <= 5`，且 `size == DB 中该商家 stock<=5 的商品数`。
- **AC-07.5** 断言 `/admin/dashboard/stats`、`/merchant/dashboard/stats` 的实现中**不出现**任何返回字面量 `"$0"`、`"0%"` 的语句（可用静态检查或对空库调用断言：空库时返回 0 而非编造非零值）。

**US-08｜作为买家，商品页分类栏显示每个分类的真实商品数**
- **AC-08.1** 造数：3 个分类，分别 5 / 3 / 0 个商品。调用 `GET /products/category-counts`，断言返回值 == `{全部: 8, 分类A: 5, 分类B: 3, 分类C: 0}`（键名以 `product_type.name` 为准）。
- **AC-08.2** 断言该值可由 `SELECT product_type_id, COUNT(*) FROM product GROUP BY product_type_id` 复算得出。
- **AC-08.3** 断言 0 商品的分类**仍出现在**返回中且值为 0（当前实现所有分类一律 0）。
- **AC-08.4** 断言 `ProductMapper.selectTypeCount()`（`mapper/ProductMapper.java:34`）被实际调用（当前零调用）。

---

### 批次 4

**US-09｜作为买家，我发布的评价在商品详情页可见，且我看不到别人的假评价**
- **AC-09.1** 清空 `product_order_evaluate` 表，打开任意商品详情页，断言评论区渲染 0 条评价（当前渲染 8 条硬编码种子）。
- **AC-09.2** 断言 `web/src/api/modules/reviews.ts` 中的 `SEED_REVIEWS` 常量已被删除或不再被任何页面引用（静态检查）。
- **AC-09.3** 以 `user1` 对自己「已完成」订单的某商品调用 `POST` 发布评价（rating 5），断言 HTTP 200，且 `product_order_evaluate` 表新增 1 行。
- **AC-09.4** 调用买家侧评价列表端点，断言 AC-09.3 的评价出现在结果中，`rating` 字段为 5。
- **AC-09.5** 对**他人**订单调用同一发布端点，断言 **HTTP 403**。
- **AC-09.6** 对**未完成**（待支付/待发货）订单调用发布端点，断言 **HTTP 400**（REQ 3.9：确认收货后才可评价）。
- **AC-09.7** 以 `shop1` 调用商家回复端点回复自己店铺的评价，断言 HTTP 200 且 DB 记录回复内容；回复**他人店铺**评价断言 **HTTP 403**。
- **AC-09.8** 断言 `GET /admin/reviews` 返回条数 == `product_order_evaluate` 表行数（当前恒 0，因无写入方）。
- **AC-09.9** 调用 `PUT /admin/reviews/{id}` 改审核状态，断言重新 `GET /admin/reviews` 该条 `status` 已变化，且 DB 对应字段已更新（当前返回 200 但不落库）。

**US-10｜作为买家，我提交的退货申请能被商家处理并真正退款**
- **AC-10.1** 以 `user1` 提交退货申请，断言 HTTP 200、`status == "pending"`。
- **AC-10.2** 以 `shop2`（非本店商家）调用该退货单的审批端点，断言 **HTTP 403**。
- **AC-10.3** 以 `shop1` 调用审批端点 `approve`，断言 HTTP 200，`status` 推进为下一状态。
- **AC-10.4** 断言审批通过后，DB 中 `return_request.status` 与关联订单状态**均**发生推进。
- **AC-10.5** 断言「确认收货 → 退款」执行后：该订单对应商品库存**回补** N 件；支付单状态推进为「已退款」；`balance` 渠道的买家余额**增加**该笔金额。
- **AC-10.6** 对同一退货单**重复**调用退款，断言第二次返回 4xx，且库存/余额**未二次变动**（幂等）。
- **AC-10.7** 断言审批端点已在 `config/AuthzRules.java` 显式登记（未登记将默认 403）；断言新增的退货端点不在 `AuthzRules` 的默认拒绝清单中。

---

### 批次 5

**US-11｜作为商家，我能下架商品，买家侧立即看不到**
- **AC-11.1** 调用商家下架端点，断言 HTTP 200，DB 中 `product.status` 变为「下架」（当前无该列、无该端点）。
- **AC-11.2** 下架后调用 `GET /products`，断言该商品**不在**返回列表中（当前实现无任何过滤，下架商品仍可见）。
- **AC-11.3** 下架后直接访问 `GET /products/{id}`，断言返回 404 或明确的「已下架」标识。
- **AC-11.4** 对已下架商品调用 `POST /payments/create`，断言 **HTTP 4xx**，且 DB 库存**未**被扣减。
- **AC-11.5** 重新上架后，断言 `GET /products` 恢复包含该商品。
- **AC-11.6** 断言 `AdminApiController.banProduct`（`AdminApiController.java:246-251`）不再以 `setStock(0)` 充当下架（封禁后 DB 库存字段应保持原值）。
- **AC-11.7** 断言新增的 `product.status` 列定义同时存在于 `sql/` 迁移脚本与 `src/test/resources/schema-h2.sql`。

**US-12｜作为买家，商品列表的分页与排序结果正确**
- **AC-12.1** 造 25 个商品（价格 1~25），`GET /products?page=1&limit=10&sort=price-asc`，断言返回 10 条且价格**全局递增**；再取 `page=2`，断言其价格均**大于** page=1 的最大价（当前实现仅页内排序，跨页会错乱）。
- **AC-12.2** `sort=price-desc` 时断言全局递减。
- **AC-12.3** 断言 `GET /products` 响应体含 `total` 字段且等于商品总数（当前返回裸 List，无 total，违反 REQ §7.2）。
- **AC-12.4** 断言 `/search` 的 `price-asc/price-desc` 具备与 AC-12.1 相同的跨页正确性。
- **AC-12.5** 传入 `sort=sales`（销量排序）时，断言返回结果按 `sales_volume` 降序（当前静默忽略该值）。

**US-13｜作为买家，搜索页的筛选面板有真实数据**
- **AC-13.1** 调用 `GET /search/trending`，断言返回数组中**每一项**都能在 `product.name` 中找到对应商品（当前返回的 5 个词与 DB 无关）。
- **AC-13.2** 若 DB 中无任何搜索/浏览日志，断言 `/search/trending` 返回 `[]` 而非编造的词。
- **AC-13.3** 调用 `POST /search`，断言 `facets` 中至少包含 `categories` 键，且其每个计数 == 用该分类过滤得到的 `total`。
- **AC-13.4** 断言 `facets` 中价格区间的分桶数之和 == `products` 的 `total`。
- **AC-13.5** 调用 `GET /search/suggestions?q=<部分商品名>`，断言 `keywords` 数组**非空**且每一项是 DB 中真实存在的商品名片段（当前恒 `[]`）。

---

## 5. 已在文档中被正确识别、本次复核**确认属实**的项

以下项文档标注为「已落地 / 真实」，逐行回代码复核后**确认成立**，可直接采信：

| 文档说法 | 复核结论 | 证据 |
|---|---|---|
| 密码 bcrypt + 登录失败文案不泄漏用户存在性 | ✅ 属实 | `service/impl/UserServiceImpl.java` `encodeIfNeeded`；`CommonController` |
| 密码找回字段已对齐（前端 `{type,tel,code,password}`） | ✅ 属实 | `web/src/api/modules/auth.ts` |
| JWT 密钥已外置，prod 缺失拒绝启动 | ✅ 属实 | `config/` + 配置文件 |
| 购物车 `createOrder` 刻意未登记 → 默认 403 | ✅ 属实 | `config/AuthzRules.java:71-77, 92-102` |
| 授权为「默认拒绝 + 路径段匹配」 | ✅ 属实 | `config/AuthzRules.java:115-125` |
| 库存条件 UPDATE 防超卖 | ✅ 属实 | `mapper/ProductMapper.java:43,49` |
| 取消退款按 `payment.channel` 分流且幂等 | ✅ 属实 | `service/impl/ProductOrderServiceImpl.java` `cancelRows` |
| 30 分钟未支付超时自动取消 + 回补库存 | ✅ 属实 | `task/OrderTimeoutTask.java` + `cancelTimeoutOrder` |
| `/checkout/summary` 不信任前端 price | ✅ 属实 | `StorefrontCheckoutController.java:53-64` |
| 退货申请归属校验 + 退款额以实付为上限 | ✅ 属实 | `ReturnRequestController.java:49-79` |
| 用户名查重 `check()` 正确（原记载 `id != id` 是误判） | ✅ 属实 | `service/impl/UserServiceImpl.java` `check` |
| `/statisticalReportForms` 已物理删除 | ✅ 属实 | controller 目录无该文件；`AuthzRules.java:97` 仅剩拒绝清单条目 |
| 生产构建非 mock | ✅ 属实 | `web/src/config/env.ts:29-30` `=== 'true'` 判 false |

---

## 6. 文档漂移清单（**以代码为准**）

| # | 文档记载 | 代码事实 | 处理建议 |
|:-:|---|---|---|
| **D1** | `MODULES.md:52-67` 列出 **14** 条后端占位 | 实际 **23** 个端点/界面返回编造数据或不落库的 200。多出：`/merchants/{id}/profile` 硬编码段（#1）、`/checkout/promo` 硬编码券（#2）、`/search/suggestions` keywords（#17）、`/admin/merchants` revenue=0（#18）、`/admin/products` status=active（#19）、`/admin/reviews` status=visible（#20）、`/merchants/{id}/products` categories+category（#3） | **占位清单不完整**，按原表排期会漏 7 个信任风险点。**本文档 §2 应作为新基线** |
| **D2** | `MODULES.md:66` 称 `getProfile` 占位在 L45-59 | 硬编码实际从 **L41** 起（`location`/`responseTime`），L45-59 之外还有 | 修正行号 |
| **D3** | `REQUIREMENTS-GAP.md:46` 称 `getCategoryCounts` 占位 L79-88 | 实际 L79-89 | 轻微，修正 |
| **D4** | `backend-api.md` §1.1/§1.9 未登记 `/products/{id}/related`、`/bought-together`、`/complete-the-look` | 三个端点存在（`StorefrontProductController.java:110, 147, 170`）且已在 `SpringMvcConfig.java:27` 公开放行 | 契约清单漏项，补录 |
| **D5** | `backend-api.md:54` 标 `GET /dashboard/stats` 🟢 真实 | 真实但**按行计数**，与 `/orders` 按 `order_no` 分组口径冲突（AC-07.3） | 降级为 🟡 并标注口径 |
| **D6** | `MODULES.md:88-97` 列 **8** 个 localStorage store | 实际 **10** 个：漏 `followedStores`(`nexus_followed_stores`)、`loyalty`(`nexus_loyalty`) | 补录 |
| **D7** | `MODULES.md:14` 称购物车「登录态后端同步」 | 属实，但**游客→登录合并**（REQ 3.3 P0）未实现，且文档未标为缺口 | 补标缺口 |
| **D8** | `REQUIREMENTS-GAP.md:67, 83` 称运费/优惠「仅用于展示」 | 表述过轻：实为**结算页展示总额 ≠ 实扣总额**，且 `SAVE10`/`VIP15` 可无限复用 | 升级为独立高优项（US-04） |
| **D9** | `REQUIREMENTS-GAP.md:76` 称「不再是下单不扣库存」 | 属实（下单即实扣），但**「无预占」的后果未量化**：待支付订单实占库存 30 分钟，高峰期可能导致可售库存为 0 而实际无人购买 | 补充风险量化说明 |

---

## 7. 产品/总控裁定（已全部关闭）

> ✅ 2026-09-27 总控已对 Q1~Q5 全部裁定，**本节不再是开放问题**。下表为**最终结论**，下游 Agent 以此为准。

| # | 问题 | **裁定结论** | 落地影响 |
|:-:|---|---|---|
| **Q1** | `/checkout/summary` 的运费/税/优惠只展示不入账，如何处理？ | **采纳变体 (c)**：运费/税/优惠**不得出现在应付总额里**。运费模板本就不存在，显示假数字比不显示更糟。仅保留 coupon 表可校验的优惠 | 已拆为 **TASK-000-I** 派给 backend；不再阻塞批次 1 其余部分。相关 AC：**AC-04.2 / AC-04.3**（展示总额 == 实扣金额）、**AC-04.4 / AC-04.5**（`SAVE10`/`VIP15` 须 4xx） |
| **Q2** | `PUT /admin/reviews/{id}`、`PUT /addresses/{id}/default` 是补实现还是删端点？ | **补实现**，不删端点（前端已在调用，删了会坏 UI） | 两条均在**批次 1** 范围内（§2 追加行 #1、#2） |
| **Q3** | 商家钱包本期做到哪一步？ | **只做「余额 + 流水只读 + 提现记录 pending」**，真实打款不碰 | **批次 2**。提现只落 pending 记录 + 扣减余额，**不接任何真实支付通道**；AC-06.6/06.7 相应只验 pending 与幂等 |
| **Q4** | `product.status` 新增列还是复用 `stock==0` 语义？ | **新增可空列**（已批准 database 出迁移），不复用 stock 语义 | **批次 5**。可空 → 存量数据读为「上架」，迁移风险低；AC-11.1~11.6 |
| **Q5** | 买家评价本期做到哪一层？ | **发布 + 列表 + 商家回复**；追评可后置 | **批次 4**。**不实现追评**，AC-09 中不含追评；商家回复已含在 AC-09.7 |

> ⚠️ **Q1 的裁定改变了 US-04 的验收含义**：原 AC-04.1 是「先调 `/checkout/summary` 记 total，再调 `/payments/create` 比对」。裁定后 `/checkout/summary` **不再返回运费/税**，其 `total` 应等于 DB 价×数量之和，AC-04.2/04.3 的比对关系不变但**期望值口径已变**（不再含运费与税）。backend 实现时以本裁定为准。

---

## 8. 边界声明

- 本文档**未修改**任何业务代码、SQL、配置。所有结论均来自只读审查 + 文件行号引用。
- 本文档**不含技术方案**（表结构设计、类设计、API 契约细节）—— 属 TASK-000-B 范围。
- 本文中的 AC 均以「可执行、可观测」为标准编写，测试 Agent 可直接据此编写自动化用例。
- 所有 AC 中标注「当前实现 X」的部分，是**对现状的客观描述**，用于对照验收，不代表本次已修复。
