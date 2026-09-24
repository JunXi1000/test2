# API 接口说明

> ⚠️ **本文档是历史文档,描述的是前端「最初期望」的一套接口,与当前实际契约已有多处不符。**
>
> **当前权威来源**(按优先级):
> 1. **`web/src/api/modules/*.ts`** —— 前端**实际**调用的路径,唯一 unavoidable 的事实来源;
> 2. **[backend-api.md](backend-api.md)** —— 后端**实际**暴露的端点、实现状态与鉴权规则;
> 3. 本文档 —— 仅用于了解各业务域的接口**意图**与字段语义,路径/字段名/响应格式请以上面两者为准。
>
> 已知不符(2026-09-24 核实,未逐条修正):
> - **前端已直连 Java 后端**:`vite` 把 `/api` 代理到 `localhost:1000` 并 **rewrite 掉 `/api` 前缀**
>   (后端无 context-path)。本文档第 11 节「需要网关/BFF 做路径映射」的说法**已不成立**。
> - **响应格式**:实际是 `{ code, msg, data }` 且 `code=200` 表示成功(不是本文档 §1 写的
>   `{ code, message, data }` / `code === 0`);错误原因现在**同时**出现在 `msg` 与 `data`。
> - 后端已通过门面控制器(`Storefront*` / `AdminApi` / `MerchantApi`)把路径对齐到
>   `web/src/api/modules/*.ts`,不再需要前端改路径去迁就 Java 侧。

本文档根据 **`web/src/api`** 下的模块整理，描述 **Nexus 前端** 在关闭 Mock、请求真实后端时所使用的路径与含义。实际联调时请以 `web/.env` / `web/.env.production` 中的 **`VITE_API_BASE_URL`** 为前缀（默认多为 `/api`，由代理转到 Java 或其它网关）。

---

## 1. 通用约定

| 项 | 说明 |
|----|------|
| **Base URL** | `import.meta.env.VITE_API_BASE_URL`，默认 `/api`;`vite` 代理到 `localhost:1000` 并去掉 `/api` 前缀 |
| **鉴权** | 请求头 `Authorization: Bearer <token>`（见 `web/src/api/http.ts`） |
| **Mock** | `VITE_USE_MOCK=true` 或 `localStorage.RUNTIME_USE_MOCK` 为 `true` 时，多数接口不发起真实请求，由前端模块内 Mock 返回 |
| **响应格式** | 实际为 `{ code, msg, data }`,`code=200` 表示成功（**不是**下文旧描述里的 `code===0`）。`http.ts` 的响应拦截器负责解包；错误时**具体原因同时出现在 `msg` 与 `data`**（过渡态，见 [backend-api.md](backend-api.md) §0） |
| **鉴权失败** | 401 由 `http.ts` 统一处理(清会话、按角色跳登录并带 `?redirect=`)；业务错误(如 409)透传后端原因 |

---

## 2. 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/login` | 登录。Body：`{ email, password, role?: 'user' \| 'merchant' \| 'admin' }`。成功：兼容 `{ user, token }` 或仅 `user` |
| POST | `/auth/forgot-password` | 忘记密码。Body：`{ email }`。后端应向该邮箱发送重置链接（链接建议指向前台 `/reset-password?token=...`，`token` 由后端签发） |
| POST | `/auth/reset-password` | 用邮件 token 重置密码。Body：`{ token, password }`（`password` 为新密码）。**无需** `Authorization` |

**模块：** `web/src/api/modules/auth.ts`

---

## 3. 商品（前台）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/products` | 商品列表。Query：`category`, `q`, `sort`, `page`, `limit` |
| GET | `/products/category-counts` | 各分类数量 |
| GET | `/products/:id` | 商品详情 |

**模块：** `web/src/api/modules/product.ts`

---

## 4. 结算与支付

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/checkout/summary` | 订单金额汇总。Body：`{ items, zip? }` |
| POST | `/checkout/promo` | 优惠码。Body：`{ code, subtotal }` |
| POST | `/payments/create` | 创建支付。Body：含 `items`, `amount`, `currency`, `shipping` |
| POST | `/payments/confirm` | 确认支付。Body：`{ paymentId, method, cardLast4? }` |

**模块：** `web/src/api/modules/checkout.ts`、`payment.ts`

---

## 5. 用户侧：订单与仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/orders` | 我的订单列表 |
| GET | `/orders/recent` | 最近订单 |
| GET | `/dashboard/stats` | 用户仪表盘统计卡片 |

**模块：** `web/src/api/modules/orders.ts`、`dashboard.ts`

---

## 6. 用户侧：账户与地址

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/account/profile` | 个人资料 |
| POST | `/account/profile` | 更新资料（Partial） |
| GET | `/account/notifications` | 通知偏好 |
| POST | `/account/notifications` | 更新通知偏好 |
| GET | `/addresses` | 地址列表 |
| POST | `/addresses` | 新建地址 |
| PUT | `/addresses/:id` | 更新地址 |
| DELETE | `/addresses/:id` | 删除地址 |
| PUT | `/addresses/:id/default` | 设为默认地址 |

**模块：** `web/src/api/modules/account.ts`、`address.ts`

---

## 7. 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/chat/conversations` | 会话列表（后端按当前用户过滤） |
| GET | `/chat/conversations/:conversationId/messages` | 消息列表 |
| POST | `/chat/messages` | 发送消息 |
| PUT | `/chat/conversations/:conversationId/read` | 标记已读 |

**模块：** `web/src/api/modules/chat.ts`

---

## 8. 商户端（需商户角色）

### 8.1 仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchant/dashboard/stats` | 经营指标 |
| GET | `/merchant/dashboard/low-stock` | 低库存商品 |

### 8.2 商品

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchant/products` | 列表。Query：`q`, `status` |
| POST | `/merchant/products` | 创建 |
| PUT | `/merchant/products/:id` | 更新 |
| DELETE | `/merchant/products/:id` | 删除 |

### 8.3 订单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchant/orders` | 列表。Query：`status`, `q` |
| GET | `/merchant/orders/:id` | 详情 |
| PUT | `/merchant/orders/:id/status` | 更新状态。Body：`{ status }` |

### 8.4 钱包

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchant/wallet` | 余额概览 |
| GET | `/merchant/wallet/transactions` | 流水 |
| POST | `/merchant/wallet/withdraw` | 提现。Body：`amount`, `destinationId?`, `destinationLabel?` |

### 8.5 店铺设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchant/settings` | 读取设置（店名、logo、地区、政策等） |
| PUT | `/merchant/settings` | 更新设置（Partial） |

**模块：** `merchantDashboard.ts`、`merchantProducts.ts`、`merchantOrders.ts`、`merchantWallet.ts`、`merchantSettings.ts`

---

## 9. 管理端（需管理员角色）

### 9.1 仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/dashboard/stats` | 总览指标 |
| GET | `/admin/dashboard/recent-users` | 新用户 |
| GET | `/admin/dashboard/revenue-chart` | 营收图表数据 |

### 9.2 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/users` | 列表。Query：`q`, `role` |
| POST | `/admin/users/:id/toggle-status` | 启用/停用 |
| PUT | `/admin/users/:id` | 更新 |
| POST | `/admin/users/:id/reset-password` | 重置密码 |
| DELETE | `/admin/users/:id` | 删除 |

### 9.3 商户审核

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/merchants` | 列表。Query：`q`, `status` |
| POST | `/admin/merchants` | 创建 |
| PUT | `/admin/merchants/:id` | 更新 |
| POST | `/admin/merchants/:id/approve` | 通过 |
| POST | `/admin/merchants/:id/reject` | 拒绝 |

### 9.4 商品（全站）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/products` | 列表。Query：`q` |
| DELETE | `/admin/products/:id/ban` | 下架/封禁 |

### 9.5 订单（全站）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/orders` | 列表。Query：`q`, `status` |
| POST | `/admin/orders/:id/cancel` | 取消订单 |

### 9.6 评论（全站）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/reviews` | 列表。Query：`q`（关键词）, `status`（`all` \| `visible` \| `hidden`） |
| PUT | `/admin/reviews/:id` | 审核状态。Body：`{ status: 'visible' \| 'hidden' }` |
| DELETE | `/admin/reviews/:id` | 永久删除评论 |

**模块：** `web/src/api/modules/adminReviews.ts`

### 9.7 系统设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/settings` | 读取 |
| PUT | `/admin/settings` | 更新 |

**模块：** `adminDashboard.ts`、`adminUsers.ts`、`adminMerchants.ts`、`adminProducts.ts`、`adminOrders.ts`、`adminReviews.ts`、`adminSettings.ts`

---

## 10. 公开店铺（无需登录，顾客浏览）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/merchants/:merchantId/profile` | 店铺公开资料 |
| GET | `/merchants/:merchantId/products` | 店铺内商品。Query：`category`, `q`, `sort`, `page`, `limit` |

**模块：** `web/src/api/modules/merchantPublic.ts`

---

## 11. 与仓库内 Spring Boot 后端的关系

> **更新(2026-09-24):本节原先描述的「前端期望 与 Java 后端不一致、需要网关/BFF 映射」状态已不成立。**
> 那时后端只有传统 CRUD 控制器;此后的工作已补齐门面控制器(`Storefront*` / `AdminApi` / `MerchantApi`),
> 路径与 `web/src/api/modules/*.ts` 对齐,**前端现在直连 Java 后端**:
>
> ```
> 浏览器 → vite dev server :5173 → 代理 /api → localhost:1000(后端,无 context-path,前缀被 rewrite 掉)
> ```
>
> 不再需要路径映射层。若发现某处仍"不一致",那是**缺陷**而非设计,应改后端或前端其一,
> 而不是再加一层映射 —— 差异清单见 [backend-api.md](backend-api.md) §3。

本仓库 **`src/main/java/.../controller`** 为平台型 API(例如 `@RequestMapping("/common")` 下的
`POST /common/login`)。各业务域的实际端点、鉴权角色与实现状态以 [backend-api.md](backend-api.md) 为准。

---

## 12. 文档维护

- **更新前端契约时**：同步改 `web/src/api/modules/*.ts` 与本文件。  
- **路径一律写完整相对路径**（含前缀片段），不含域名；部署时由 Base URL 拼接。
- **改后端端点时**:同步 `docs/backend-api.md`;若影响到前端可调用的路径,还必须同步
  `config/AuthzRules.java` 的放行表(见 `docs/DEVELOPMENT.md` §4.1) —— **漏登记会让前端拿到 403**。
