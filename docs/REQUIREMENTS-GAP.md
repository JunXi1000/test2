# 现有实现 vs 需求差距分析

> 依据:需求见 [REQUIREMENTS.md](REQUIREMENTS.md);现有实现事实来源于 [MODULES.md](MODULES.md) 功能状态矩阵、[backend-api.md](backend-api.md) 接口契约清单,以及抽查关键代码(Product 实体、UserServiceImpl 密码处理)。
> 状态标记:🟢 已具备 · 🟡 部分(能用但有缺口) · 🔴 缺失/大差距
> 用途:把「需求文档」翻译成「要补什么」,并按路线图阶段排期。
> **2026-09 复核**:后端 Phase 0~4 之后已逐条回代码核实。下文凡标「2026-09 已落地」的,都是**已补齐**、不再是待办;仍标 ❌/🟡 的才是真缺口。

## 1. 总览

| 需求模块(REQ §3) | 需求要点 | 现有实现 | 差距等级 | 归属阶段 |
|---|---------|---------|:-:|:-:|
| 3.1 商品管理 | 多级类目/属性/SPU-SKU/上下架/库存/价格/搜索/详情 | 单表 `Product` 扁平模型;搜索为 DB like;分类计数硬编码 | 🔴 大 | Phase 2~3 |
| 3.2 用户管理 | 登录(手机/邮箱/第三方)/账号安全/地址 | 手机+密码登录、改密真实,bcrypt ✅;找回密码字段已对齐且有验证码限次 ✅(2026-09 已落地);无第三方登录/手机绑定/设备管理;默认地址 no-op | 🟡 中 | Phase 2/4 |
| 3.3 购物车 | 增删改/选中结算/价格/失效处理 | 后端 `/shoppingCart` 真实;**前端仍用 localStorage 未同步后端** | 🟡 中 | Phase 2 |
| 3.4 订单管理 | 生成/状态机/拆分/取消退款/金额 | 订单表 + 状态机真实;取消退款按渠道分流且幂等、待支付 30 分钟超时自动取消 ✅(2026-09 已落地);无多店铺拆分 | 🟡 中 | Phase 2/4 |
| 3.5 支付 | 微信/支付宝/余额/回调/对账 | `payment` 表 + 建单/确认/状态机/幂等 ✅(2026-09 已落地);仍是**模拟网关**,无真实商户号、回调验签与对账 | 🟡 中 | Phase 2 |
| 3.6 库存管理 | 预占/扣减/回补/超卖防护/预警 | 下单原子扣减(条件 UPDATE 防超卖)、取消/超时回补 ✅(2026-09 已落地);**仍无预占**、无流水表、无预警闭环 | 🟡 中 | Phase 2 |
| 3.7 物流配送 | 运费模板/发货/跟踪/自动确认 | 状态机有发货(`delivery`);无运费模板/物流跟踪/自动收货 | 🟡 中 | Phase 3 |
| 3.8 营销促销 | 优惠券/满减/积分/会员/秒杀拼团 | 优惠券真实(`coupon`+`user_coupon`);满减/积分/会员无;秒杀拼团不在本期 | 🟡 中 | Phase 3 |
| 3.9 评价管理 | 评价/晒图/追评/回复 | 仅管理端 `/admin/reviews`(列表/删除)真实;**买家侧发布/列表端点随遗留控制器一并删除**,前端也已无对应 API;追评、商家回复未见 | 🟡 中 | 补充完善 |
| 3.10 售后服务 | 退款/退货/换货/工单 | `return_request` 真实(GET/POST,含归属校验与退款上限校验 ✅);缺审批流转,故**退货不触发退款**;无换货/工单升级(注:取消订单的退款已真实执行,见 3.4) | 🟡 中 | Phase 2/3 |
| 3.11 后台管理 | 看板/审核/订单/用户/营销/权限 | 用户/商家/商品/订单管理真实;看板硬编码;无营销配置界面;无 RBAC 配置 | 🟡 中 | Phase 3 |
| 3.12 数据统计 | GMV/订单量/转化率/用户/商品分析 | 原 `statisticalReportForms` 聚合端点及其 service **已随遗留控制器删除**(2026-09);admin/merchant 看板与钱包仍硬编码 0/空 | 🔴 大 | Phase 3 |

### 非功能需求差距(REQ §5)

| 维度 | 需求目标 | 现有实现 | 差距等级 | 归属阶段 |
|---|---|---|---|:-:|
| 性能 | 1000 单/秒、P95<300ms、首屏<2s | 单体无缓存/无 ES/无分库分表,未压测 | 🔴 大 | Phase 4+ 架构演进 |
| 安全 | HTTPS/加密存储/防刷/审计 | bcrypt ✅;JWT 密钥已外置(**仓库内无可用密钥**,非 prod 用一次性随机密钥、prod 缺失即拒绝启动)✅、验证码发送限流 + 失败 5 次销毁 ✅(2026-09 已落地);无 HTTPS/全局限流/审计日志 | 🟡 中 | Phase 4 |
| 可用性 | ≥99.95%、容灾、备份 | 单实例单体,无容灾/备份策略 | 🔴 大 | 架构演进 |
| 兼容性 | PC+移动端 | Vue3 响应式;无移动端适配验证 | 🟡 中 | 持续 |
| 可扩展性 | 微服务/水平扩展 | 单体架构,模块耦合 | 🔴 大 | 架构演进 |

### 数据与接口差距(REQ §6/§7)

- **数据实体**:user / shipping_address / product / product_order / product_order_evaluate / coupon / return_request / stock_alert / notification / chat 等**已具备**;`payment`(支付单,`sql/migrations/V3__phase2_order_payment.sql`)与订单 `order_no` 分组字段 **2026-09 已落地**;仍缺 `spu/sku`(商品规格拆分)、`stock` 扣减/回补**流水表**、`audit_log`(操作审计)。
- **第三方接口**:微信/支付宝支付、物流轨迹、短信、实名认证**均未对接**。支付目前是**模拟网关**:订单与支付单真实落库、库存真实扣减,但没有真实商户号、回调验签与对账。
- **内部接口规范**:统一 `ResponseVO{code,msg,data}` + `PageVO{list,total}` ✅ 与需求一致;错误码分段、OpenAPI 文档未建。

---

## 2. 逐模块差距明细

### 3.1 商品管理 🔴
- **类目**:现有 `product_type` 为单层,无三级类目树、无类目迁移;`/products/category-counts` 仍硬编码 0(`StorefrontProductController` L79-88,`ProductMapper.selectTypeCount()` 已就绪但未接)。
- **SPU/SKU**:`Product` 为单表扁平模型(无 SPU 层、无规格属性),不支持"一商品多规格多价格多库存"。
- **库存/价格**:价格仅 `price` 字段,无划线价/活动价;库存仅 `stock` 字段,无 SKU 级库存。
- **搜索**:`/search` 走 DB like,无 ES 全文检索、无 facets 聚合(`StorefrontSearchController` L102 `facets` 恒为空 Map)、`/search/trending` 硬编码(L54-59)。
- **建议**:先补"规格/SPU-SKU"或维持单表但明确不做多规格;搜索待量级上来再上 ES。

### 3.2 用户管理 🟡
- ✅ 注册/登录/改密真实,bcrypt 哈希(`UserServiceImpl.encodeIfNeeded`);**用户名查重也已正确**(`UserServiceImpl.check`:`byUsername != null && !byUsername.getId().equals(entity.getId())`,`insert`/`updateById` 均已调用 —— 原文把它列为待修 bug 属误判,该条已删除)。
- ✅ **密码找回字段已对齐**(2026-09 已落地):前端 `web/src/api/modules/auth.ts` 以 `{type, tel, code, password}` POST `/common/retrievePassword`(不再拼 URL);后端 `retrievePassword` 按 `type+tel` 校验验证码,`ResetCodeStore` 有 60s/日 10 次发送限流 + **失败 5 次即销毁验证码**。登录失败文案已合并为「用户名或密码错误」,不再泄漏用户是否存在。
- ❌ 第三方登录(微信/支付宝)未实现;手机绑定/解绑、设备管理无。
- ⚠️ 默认地址 `PUT /addresses/:id/default` 仍为 no-op(`StorefrontAddressController` L56-60)。

### 3.3 购物车 🟡
- ✅ 后端 `/shoppingCart` 的 `page`/`add`/`update`/`delBatch` 真实,且已在 `AuthzRules` 显式放行;`createOrder` 因对传入的 `shoppingCartId` 无归属校验,**刻意不入规则表 → 默认拒绝(已不可达)**,下单统一走 `/payments/create` → `createStorefrontOrder`。
- ❌ **前端 Cart store 仍用 localStorage**(`web/src/stores/cart.ts`,`nexus_cart_items`),未切到后端 → 跨设备不同步、关 mock 后购物车页与后端不一致。
- ❌ 价格以本地计算为准,未做服务端刷新;失效商品处理无。

### 3.4 订单管理 🟡
- ✅ 订单表与状态机真实;`/productOrder` 控制器已删除,状态机改由 `/orders/{orderNo}/cancel`(买家)、`/merchant/orders/{id}/status`(商家发货/确认/取消)、`/admin/orders/{id}/cancel` 承载;admin/merchant 订单管理真实。
- ✅ **取消退款已按渠道分流且幂等**(2026-09 已落地):`ProductOrderServiceImpl.cancelRows` 先用条件 UPDATE 抢占行所有权,只有抢到行的执行流才回补库存/退款;仅 `payment.channel=balance` 才 `topUp` 回余额,`card` 等网关渠道只把支付单置「已退款」而**不动余额**(原文的「凭空增加余额」缺陷已修)。残留的 `//TODO 退款`(`ProductOrderServiceImpl` L388)只出现在**遗留** `pay(id)` —— 那是纯扣款方法,不涉及退款。
- ✅ **待付款 30 分钟超时自动取消 + 释放库存已落地**(2026-09):`task/OrderTimeoutTask` 每 60s 扫一次(`selectPendingBefore`,单轮上限 200 行),`ProductOrderServiceImpl.cancelTimeoutOrder` 回补库存 + 按渠道退款 + 支付单置「已超时」,且带事务。
- ✅ **结算金额已服务端重算**(2026-09 已落地):`StorefrontCheckoutController.calculateSummary` 一律按 DB `product.price` × 数量算小计,不信任前端传入的 price;落单金额(`doInsert`/`createStorefrontOrder`)同样用 DB 价格。**限制**:优惠/运费/税仅用于展示,不写入订单与支付金额。
- ❌ 多店铺订单拆分无(当前为单店模型;`order_no` 只是同一结算批次的分组键,不是多店拆单)。

### 3.5 支付 🟡
- ✅ **"模拟支付 + 落库"已先行打通**(2026-09 已落地,正是原文给出的方案):`/payments/create` 真实调用 `createStorefrontOrder` —— 落订单行 + 建 `payment` 支付单 + 原子扣库存,并把真实 `orderNo` 当 `paymentId`/`orderId` 返回;不再吞异常伪造 `pay_*`/`ORD-随机`。
- ✅ `/payments/confirm` 走状态机且**幂等**:`payment.status` 守卫(已支付直接返回,不重复扣款);`balance` 渠道逐行扣款并推进「待支付→待发货」,`card` 渠道只推进状态;并把**实际扣款渠道**回写 `payment.channel`(否则取消时按渠道退款会判错)。`/payments/complete-action` 与 confirm 同语义。
- ❌ 仍**不是真实网关**:无真实商户号、无回调**验签**、无对账;`payment` 表无独立退款流水(退款只体现为支付单状态「已退款」)。接入微信/支付宝时须替换为「网关下单 + 回调验签 + 幂等入账」。

### 3.6 库存管理 🟡
- ✅ **扣减 / 回补 / 超卖防护已落地**(2026-09):下单与支付走 `ProductMapper.deductStock` —— `UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?`,受影响行数为 0 即「库存不足」,并发下不会超卖;取消与超时取消走 `restoreStock` 回补(`sales_volume` 用 `GREATEST(...,0)` 不回补为负)。**不再是"下单不扣库存"**。
- ✅ 低库存查询 `/merchant/dashboard/low-stock`(阈值 stock<=5)仍在;但**无主动预警闭环**(`stock_alert` 是买家"到货提醒"订阅,不是商家库存预警)。
- ❌ **仍无「预占」(soft-hold)**:下单即实扣,没有「先占位 → 支付成功再确认扣减 → 超时释放」的中间态;待支付订单占用的库存靠 30 分钟超时任务回补,而非预占。
- ❌ 无库存扣减/回补**流水表**,出入库不可追溯。

### 3.7 物流配送 🟡
- ✅ 订单状态机有"发货"(`delivery`)。
- ❌ 无运费模板(需求 P1);`/checkout/summary` 里虽有「满 200 免邮、否则 12」的运费,但仅用于**展示**,不写入订单金额;无物流轨迹对接;无超时自动收货。

### 3.8 营销促销 🟡
- ✅ 优惠券全链路真实:券池、领券、我的券、`/checkout/promo` 已接 `coupon` 表(Phase 1)。
- ❌ 满减、积分、会员等级无;优惠券无后台配置界面(仅买家侧接口)。
- 秒杀/拼团按需求不在本期,预留扩展点即可。

### 3.9 评价管理 🟡
- ⚠️ **买家侧评价端点已消失**:`/productOrderEvaluate` 的发布/列表随 14 个遗留控制器一并删除,前端 `web/src/api/modules/` 也**没有任何**买家评价 API —— 买家目前无法发布或查看评价(一处功能回退,非「已具备」)。
- ✅ 管理端 `/admin/reviews` 仍在且真实:`GET` 读 `ProductOrderEvaluateService.list()`,`DELETE /admin/reviews/{id}` 真实删除。
- ⚠️ 追评、商家回复未见;`PUT /admin/reviews/{id}`(审核状态)仍为 no-op(入参已去掉,如实表达"输入被忽略")。

### 3.10 售后服务 🟡
- ✅ `return_request` 表 + GET/POST 真实(Phase 1),2026-09 又补了两处:**提退货申请时 `orderId` 必须是本人订单**(`listOwnedOrderRows`,不存在 404 / 非本人 403),**退款金额以该订单实付金额为上限由服务端算**(不再采信客户端虚报)。
- ❌ 仍缺"商家同意→寄回→确认收货→退款"完整流转:只有买家侧 GET/POST,**没有审批端点**,因此退货也不会触发实际退款;无换货、无工单升级。
- ⚠️ 原文「退款仍走 TODO」**不准确**:仓库内唯一的 `//TODO 退款` 在遗留 `pay(id)`(纯扣款方法),取消订单的退款已按 `payment.channel` 真实执行。

### 3.11 后台管理 🟡
- ✅ 用户/商家(approve/reject)/商品(ban)/订单管理真实。
- ❌ `AdminApiController` 看板统计硬编码 `$0`/`0`(L35-46)、收入图空列表(L63-66);`/admin/settings` GET 硬编码、PUT no-op。商家侧同样:`/merchant/dashboard/stats` 硬编码、`/merchant/wallet` 与 `/merchant/wallet/transactions` 恒 0/空、`/merchant/settings` PUT no-op。
- ✅ **授权已改为显式规则表 + 默认拒绝**(2026-09 已落地):`LoginInterceptor.checkRole` 委托 `config/AuthzRules`,`AntPathMatcher` 按**路径段**匹配,未命中任何规则一律 403。不再是「按前缀 + 未命中即放行」,`/admin` 误命中 `/admin-accounts`、`/productOrder` 误命中 `/productOrderEvaluate` 这类问题从机制上消失。
- ❌ 仍**无 RBAC 角色-权限配置**:角色只有硬编码的 ADMIN/SHOP/USER 三级,规则表是代码常量,后台不可配。
- ❌ 无营销配置界面。

### 3.12 数据统计 🔴
- ❌ **`/statisticalReportForms`(商品类型占比、近 N 天销售)连同其 service 已随 14 个遗留控制器物理删除**(2026-09)——原来的真实 SQL 聚合能力**已不存在**,`AuthzRules` 里残留的 `/statisticalReportForms/**` 只是默认拒绝清单的一员。
- ❌ admin/merchant dashboard stats 硬编码 `$0`/`0`;`/admin/dashboard/revenue-chart` 空列表;`/merchant/wallet`、`/merchant/wallet/transactions` 恒 0/空。无 GMV/转化率/用户增长看板 —— 本模块现在**没有任何真实聚合**。

---

## 3. 关键结论与优先级建议

1. **MVP 主链路已打通**(2026-09,Phase 0~2 落地后复核):`/checkout/summary` 按 DB 价格重算 → `/payments/create` 真实落订单行 + 支付单 + 原子扣库存 → `/payments/confirm` 状态机 + 幂等 → `/orders` 按 `order_no` 分组可见 → 取消/超时回补库存并按渠道退款。**关掉 mock 后「下单→支付→订单列表→取消」成立**。本链路**剩余**的缺口是:① 无**预占**(下单即实扣,待支付占用靠 30 分钟超时兜底);② 无真实网关(无商户号/回调验签/对账);③ 前端购物车仍走 localStorage(见 §3.3)。
2. **数据模型待补的只剩**:库存**流水表**(出入库不可追溯)、SPU/SKU(如要做多规格);`payment` 与订单 `order_no` 分组字段已于 2026-09 补上;`audit_log`、订单多店拆单按需加。
3. **后台看板与设置真实化**是 Phase 3 的主要工作(钱包/统计/设置/搜索 facets);另外 §3.12 的 `/statisticalReportForms` 被删除后,**统计模块已无任何真实聚合**,需要重做而不是接线上。
4. **质量收尾(Phase 4)——以下已于 2026-09 完成,不再是待办**:密码找回字段对齐(前后端 `type/tel/code/password`)、用户名查重(原文所指 `UserServiceImpl.check` 的 bug **是误判**,当前实现正确,无需修)、JWT 密钥外置(仓库内已无可用密钥,prod 缺失即拒绝启动)、取消订单退款(按渠道分流 + 幂等)、验证码校验(限流 + 失败 5 次销毁)、生产 mock 开关(`web/.env` 已是 `VITE_USE_MOCK=false`,`web/.env.production` 只有 `VITE_API_BASE_URL=/api`,生产产物**不是** mock)。
   真正剩下的收尾项:`PUT /admin/settings`、`PUT /admin/reviews/{id}`、`PUT /merchant/settings`、`POST /merchant/wallet/withdraw` 仍为 no-op;`PUT /addresses/:id/default` 仍为 no-op;退货申请无审批流转(§3.10);买家侧评价端点缺失(§3.9)。
5. **架构演进(超出当前单体)**:百万用户/1000TPS 需要缓存(Redis)、搜索(ES)、分库分表、消息队列与微服务化——这是独立于功能补全的工程,建议按流量真实增长再演进,避免过度设计。
6. **合规基线**:补隐私政策、个人敏感字段(手机号)加密/脱敏、操作审计日志,满足 PIPL/电商法要求后再考虑公网上线。

> 详细到行号的占位清单见 [MODULES.md](MODULES.md) §2;阶段拆分见 [ROADMAP.md](ROADMAP.md)。
