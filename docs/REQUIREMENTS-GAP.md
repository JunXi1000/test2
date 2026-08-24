# 现有实现 vs 需求差距分析

> 依据:需求见 [REQUIREMENTS.md](REQUIREMENTS.md);现有实现事实来源于 [MODULES.md](MODULES.md) 功能状态矩阵、[backend-api.md](backend-api.md) 接口契约清单,以及抽查关键代码(Product 实体、UserServiceImpl 密码处理)。
> 状态标记:🟢 已具备 · 🟡 部分(能用但有缺口) · 🔴 缺失/大差距
> 用途:把「需求文档」翻译成「要补什么」,并按路线图阶段排期。

## 1. 总览

| 需求模块(REQ §3) | 需求要点 | 现有实现 | 差距等级 | 归属阶段 |
|---|---------|---------|:-:|:-:|
| 3.1 商品管理 | 多级类目/属性/SPU-SKU/上下架/库存/价格/搜索/详情 | 单表 `Product` 扁平模型;搜索为 DB like;分类计数硬编码 | 🔴 大 | Phase 2~3 |
| 3.2 用户管理 | 登录(手机/邮箱/第三方)/账号安全/地址 | 手机+密码登录、改密真实,bcrypt ✅;无第三方登录/手机绑定/设备管理;默认地址 no-op | 🟡 中 | Phase 2/4 |
| 3.3 购物车 | 增删改/选中结算/价格/失效处理 | 后端 `/shoppingCart` 真实;**前端仍用 localStorage 未同步后端** | 🟡 中 | Phase 2 |
| 3.4 订单管理 | 生成/状态机/拆分/取消退款/金额 | 订单 CRUD + 简单状态机真实;无拆分;退款 TODO 未完成;无超时自动取消 | 🟡 中 | Phase 2/4 |
| 3.5 支付 | 微信/支付宝/余额/回调/对账 | `/payments/*` 纯 mock,无支付表无业务 | 🔴 大 | Phase 2 |
| 3.6 库存管理 | 预占/扣减/回补/超卖防护/预警 | 仅 `Product.stock` 字段 + 低库存查询;无预占/扣减/回补/超卖防护 | 🔴 大 | Phase 2 |
| 3.7 物流配送 | 运费模板/发货/跟踪/自动确认 | 状态机有发货(`delivery`);无运费模板/物流跟踪/自动收货 | 🟡 中 | Phase 3 |
| 3.8 营销促销 | 优惠券/满减/积分/会员/秒杀拼团 | 优惠券真实(`coupon`+`user_coupon`);满减/积分/会员无;秒杀拼团不在本期 | 🟡 中 | Phase 3 |
| 3.9 评价管理 | 评价/晒图/追评/回复 | `productOrderEvaluate` 真实;追评、商家回复未见 | 🟢 基本具备 | 补充完善 |
| 3.10 售后服务 | 退款/退货/换货/工单 | `return_request` 真实(GET/POST);缺审批流转/退款/换货/工单升级 | 🟡 中 | Phase 2/3 |
| 3.11 后台管理 | 看板/审核/订单/用户/营销/权限 | 用户/商家/商品/订单管理真实;看板硬编码;无营销配置界面;无 RBAC 配置 | 🟡 中 | Phase 3 |
| 3.12 数据统计 | GMV/订单量/转化率/用户/商品分析 | `statisticalReportForms` 真实 SQL 聚合;admin/merchant 看板硬编码 0 | 🟡 中 | Phase 3 |

### 非功能需求差距(REQ §5)

| 维度 | 需求目标 | 现有实现 | 差距等级 | 归属阶段 |
|---|---|---|---|:-:|
| 性能 | 1000 单/秒、P95<300ms、首屏<2s | 单体无缓存/无 ES/无分库分表,未压测 | 🔴 大 | Phase 4+ 架构演进 |
| 安全 | HTTPS/加密存储/防刷/审计 | bcrypt ✅、JWT 密钥硬编码 ⚠️、无 HTTPS/限流/审计日志 | 🟡 中 | Phase 4 |
| 可用性 | ≥99.95%、容灾、备份 | 单实例单体,无容灾/备份策略 | 🔴 大 | 架构演进 |
| 兼容性 | PC+移动端 | Vue3 响应式;无移动端适配验证 | 🟡 中 | 持续 |
| 可扩展性 | 微服务/水平扩展 | 单体架构,模块耦合 | 🔴 大 | 架构演进 |

### 数据与接口差距(REQ §6/§7)

- **数据实体**:user / shipping_address / product / product_order / product_order_evaluate / coupon / return_request / stock_alert / notification / chat 等**已具备**;缺 `spu/sku`(商品规格拆分)、`payment`(支付单)、`stock` 预占/扣减**流水表**、`audit_log`(操作审计)、订单**父单拆分字段**。
- **第三方接口**:微信/支付宝支付、物流轨迹、短信、实名认证**均未对接**(支付为 mock)。
- **内部接口规范**:统一 `ResponseVO{code,msg,data}` + `PageVO{list,total}` ✅ 与需求一致;错误码分段、OpenAPI 文档未建。

---

## 2. 逐模块差距明细

### 3.1 商品管理 🔴
- **类目**:现有 `product_type` 为单层,无三级类目树、无类目迁移;`/products/category-counts` 硬编码 0(`StorefrontProductController` L77-87)。
- **SPU/SKU**:`Product` 为单表扁平模型(无 SPU 层、无规格属性),不支持"一商品多规格多价格多库存"。
- **库存/价格**:价格仅 `price` 字段,无划线价/活动价;库存仅 `stock` 字段,无 SKU 级库存。
- **搜索**:`/search` 走 DB like,无 ES 全文检索、无 facets 聚合(`StorefrontSearchController` L101-103 空)、`/search/trending` 硬编码(L54-59)。
- **建议**:先补"规格/SPU-SKU"或维持单表但明确不做多规格;搜索待量级上来再上 ES。

### 3.2 用户管理 🟡
- ✅ 注册/登录/改密真实,bcrypt 哈希(`UserServiceImpl.encodeIfNeeded`)。
- ❌ 第三方登录(微信/支付宝)未实现;手机绑定/解绑、设备管理无。
- ⚠️ 密码找回字段不匹配:前端发 `email`、后端用 `tel`;token 复用为 userId(`UserServiceImpl.retrievePassword`)。
- ⚠️ 默认地址 `PUT /addresses/:id/default` 为 no-op(`StorefrontAddressController` L51-55)。

### 3.3 购物车 🟡
- ✅ 后端 `/shoppingCart` CRUD + `createOrder` 真实。
- ❌ **前端 Cart store 仍用 localStorage**(`nexus_cart_items`),未切到后端 → 跨设备不同步、关 mock 后下单链路断裂。
- ❌ 价格以本地计算为准,未做服务端刷新;失效商品处理无。

### 3.4 订单管理 🟡
- ✅ 订单表/CRUD 真实;`/productOrder` 有 `pay/cancel/delivery/confirm` 简单状态机;admin/merchant 订单管理真实。
- ❌ 多店铺订单拆分无(当前为单店模型)。
- ❌ `//TODO 退款`(`ProductOrderServiceImpl` L107/L125)未完成。
- ❌ 无"待付款 30 分钟超时自动取消+释放库存"定时任务。
- ⚠️ 结算金额信任前端 price(`/checkout/summary` 伪计算),未服务端校验。

### 3.5 支付 🔴
- `/payments/create` 吞异常返回 mock `pay_*`/`ORD-随机`;`/payments/confirm` 永远 `succeeded`(`StorefrontPaymentController` L47-66)。
- 无支付表、无回调、无幂等、无对账。**这是主链路最大缺口**,建议 Phase 2 用"模拟支付+落库"先行打通。

### 3.6 库存管理 🔴
- 仅 `Product.stock` 字段 + `/merchant/dashboard/low-stock` 查询。
- 无预占/扣减/回补逻辑 → 目前下单不扣库存、无超卖防护。Phase 2 与支付落库一并实现。

### 3.7 物流配送 🟡
- ✅ 订单状态机有"发货"(`delivery`)。
- ❌ 无运费模板/运费计算(需求 P1);无物流轨迹对接;无超时自动收货。

### 3.8 营销促销 🟡
- ✅ 优惠券全链路真实:券池、领券、我的券、`/checkout/promo` 已接 `coupon` 表(Phase 1)。
- ❌ 满减、积分、会员等级无;优惠券无后台配置界面(仅买家侧接口)。
- 秒杀/拼团按需求不在本期,预留扩展点即可。

### 3.9 评价管理 🟢(基本)
- ✅ `productOrderEvaluate` 真实(发布/列表/管理端审核)。
- ⚠️ 追评、商家回复未确认存在;`AdminApiController.updateReviewStatus` 为 no-op(审核状态不落库)。

### 3.10 售后服务 🟡
- ✅ `return_request` 表 + GET/POST 真实(Phase 1)。
- ❌ 缺"商家同意→寄回→确认收货→退款"完整流转;退款仍走 TODO;无换货、无工单升级。

### 3.11 后台管理 🟡
- ✅ 用户/商家(approve/reject)/商品(ban)/订单管理真实。
- ❌ `AdminApiController` 看板统计硬编码 `$0`/`0`(L34-42)、收入图空列表(L59-62);`/admin/settings` 硬编码+no-op。
- ❌ 无营销配置界面;无 RBAC 角色-权限配置(当前仅硬编码 ADMIN/SHOP 两级,`LoginInterceptor.checkRole` 按前缀)。

### 3.12 数据统计 🟡
- ✅ `/statisticalReportForms`(商品类型占比、近 N 天销售)为真实 SQL 聚合。
- ❌ admin/merchant dashboard stats 硬编码;无 GMV/转化率/用户增长看板。

---

## 3. 关键结论与优先级建议

1. **MVP 主链路是断裂的**:`/checkout` 伪计算 → `/payments` 纯 mock → 前端结算成功仅 mock 模式写本地订单 → **关 mock 后"下单→支付→订单列表"不成立**。Phase 2 必须优先打通:**结算服务端校验 + 模拟支付落库 + 库存预占/扣减/回补 + 购物车切后端**。
2. **数据模型需先行补表**:`payment`、库存流水、SPU/SKU(如要做多规格)是本链路的地基;`audit_log`、订单父单号按需加。
3. **后台看板与设置真实化**是 Phase 3 的主要工作(钱包/统计/设置/搜索 facets)。
4. **质量收尾(Phase 4)**:密码找回字段对齐、用户名查重 bug(`UserServiceImpl.check` L213 `id != id`)、JWT 密钥外置、退款完成、验证码校验、生产 mock 开关(`.env.production` 默认 mock=true)。
5. **架构演进(超出当前单体)**:百万用户/1000TPS 需要缓存(Redis)、搜索(ES)、分库分表、消息队列与微服务化——这是独立于功能补全的工程,建议按流量真实增长再演进,避免过度设计。
6. **合规基线**:补隐私政策、个人敏感字段(手机号)加密/脱敏、操作审计日志,满足 PIPL/电商法要求后再考虑公网上线。

> 详细到行号的占位清单见 [MODULES.md](MODULES.md) §2;阶段拆分见 [ROADMAP.md](ROADMAP.md)。
