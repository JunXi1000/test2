# 开发路线图

> 目标:把「前端成熟、后端半真半假」的原型,分阶段推进为关掉 mock 也能完整跑通的系统。
> 优先级顺序经项目负责人确认。每阶段含**范围**与**验收标准**;现状依据见 [MODULES.md](MODULES.md)。

## Phase 1 — 前端占位功能补全 ✅ 已完成(2026-08-08)

**目标**:让「看似完整但仅前端占位」的功能真正对接后端。优先复用已有后端能力,必要时补建最小表。

> **完成情况**:WP-1~WP-7 全部落地。新增 6 张表(`user_notification_pref` / `coupon` / `user_coupon` / `return_request` / `stock_alert` / `notification`)与 4 个控制器(`CouponController` / `ReturnRequestController` / `StockAlertController` / `NotificationController`);`/checkout/promo` 已接 coupon 表;新端点经冒烟测试全部通过(领券/退换货/订阅/通知/通知偏好);存量 7 个 H2 测试失败与约 30 个前端 TS 错误均为**预存问题**,已移入 Phase 4。

| # | 工作项 | 涉及文件(示意) | 说明 |
|---|--------|-----------------|------|
| WP-1 | 改密码对接后端 | `web/src/pages/dashboard/Settings.vue`、`web/src/api/modules/account.ts` | 复用已有 `POST /common/updatePassword` |
| WP-2 | 图片上传对接后端 | `web/src/pages/merchant/Settings.vue`、`web/src/api/modules/*` | 复用已有 `POST /file/upload`,logo 弃 data URL |
| WP-3 | 用户通知偏好落库 | `StorefrontAccountController` + 新表 | 通知偏好真实读写 |
| WP-4 | 优惠券后端化 | 新 `coupon`/`user_coupon` 表 + Service/Controller + `web/src/stores/coupons.ts` | 领券/我的券/对订单校验 |
| WP-5 | 退换货后端化 | 新 `return_request` 表 + Service/Controller + `web/src/stores/returns.ts` | 申请/列表/取消 |
| WP-6 | 到货订阅后端化 | 新 `stock_alert` 表 + Service/Controller + `web/src/stores/stockAlerts.ts` | 订阅/我的/取消 |
| WP-7 | 通知后端化(可选) | 新 `notification` 表 + Service/Controller + admin/merchant 通知页 | 时间紧则移入 Phase 3 |
| 横切 | schema 同步 + 增量 SQL | `docker/mysql/init/01-schema.sql`、`schema-h2.sql`、增量迁移 | 新表三处同步 |

**验收**:关 mock 后——改密码成功、商家 logo 上传回显、领券出现在「我的优惠券」、提交退换货可查、订阅到货可取消、通知偏好读写生效;`mvn test` 通过。

## Phase 2 — 核心电商链路真数据化

**目标**:打通「结算 → 支付 → 订单 → 用户中心」主链路,关 mock 可完整跑通。

| 范围 | 说明 |
|------|------|
| 结算服务端校验 | `StorefrontCheckoutController` 不再信任前端 price,按 DB 校验商品金额/库存/运费 |
| 支付真实落库 | 新增 `payment` 表 + PaymentService;`/payments/create`+`confirm` 模拟支付成功但真实创建订单、扣库存、走状态机、写支付记录 |
| 全链路 | 购物车→下单→支付→订单→用户中心,关 mock 跑通 |
| 购物车同步 | 前端 cart store 对接 `/shoppingCart`(含 createOrder) |
| 优惠码统一 | `/checkout/promo` 与 Phase 1 coupon 打通 |
| 顺带修复 | `setDefaultAddress` no-op、结算成功订单写入服务端 |

**验收**:mock 关闭,新注册用户可完整走通 浏览→加购→结算→支付→订单列表 且数据落库;取消订单回补库存。

## Phase 3 — 商家/管理后台真实化

**目标**:替换 dashboard/钱包/设置/搜索等硬编码占位。

| 范围 | 说明 |
|------|------|
| 商家钱包 | `wallet` + `transaction` 表/Service,替换 `MerchantApiController` mock(余额/流水/提现) |
| 后台统计 | Admin/Merchant dashboard stats、revenue-chart 用真实 SQL 聚合(参考 `StatisticalReportFormsServiceImpl`) |
| 设置持久化 | `/admin/settings`、`/merchant/settings` 落库 |
| 店铺/搜索真实化 | `/merchants/:id/profile` stats、`/products/category-counts`、`/search/trending`、facets |
| 通知后端化 | 若 WP-7 未做,在此完成;用户侧通知补全 |

**验收**:商家可提现(余额流转有记录);admin/merchant 首页数字与订单/商品数据一致;设置改完刷新仍在;店铺页评分/销量非空。

## Phase 4 — 基础质量修复与收尾

**目标**:修复已知缺陷、消除文档漂移、补测试。

| 范围 | 说明 |
|------|------|
| 生产 mock 开关 | `.env.production` 显式 `VITE_USE_MOCK=false` |
| 用户名查重 bug | `UserServiceImpl.check` L213 `id != id` 恒 false |
| 密码找回流程 | 前端 `email` ↔ 后端 `tel` 对齐;`resetPasswordWithToken` 不再把 token 当 userId |
| JWT 密钥外置 | `JwtUtils` 硬编码密钥 → 配置项 |
| 退款完成 | `ProductOrderServiceImpl` 的 `//TODO 退款` |
| 验证码校验 | Admin/Shop `retrievePassword` 的 `//TODO 校验验证码` |
| 测试补强 | 现有 H2 冒烟测试 → 增加业务断言级用例(订单状态机/购物车/统计) |
| 文档同步 | 修正 `web/docs/DEVTOOLS.md`/`ENVIRONMENT.md`/`ROUTING.md` 与代码漂移(DebugPanel 等) |
| 清理 | `VITE_APP_API_URL` 无用变量、过时 `sql/templatev3_s.sql` 标注 |

**验收**:`mvn test` 全绿;生产构建 mock=false;登录/查重/找回密码行为正确。

---

## 执行约定

- 每阶段结束提交一次,工作区保持干净再进入下一阶段。
- Phase 1 阶段内的零风险修复(生产 mock 开关、用户名查重 bug)若顺路碰到,随手修掉,不必等 Phase 4。
- 新端点遵循门面控制器 + ResponseVO + 「mock 分支 + 真实分支」约定(见 [DEVELOPMENT.md](DEVELOPMENT.md))。
- 阶段范围可随时按业务需要调整;调整时同步更新本文件。
