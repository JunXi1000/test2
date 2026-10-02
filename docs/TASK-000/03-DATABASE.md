# TASK-000-C 数据模型与迁移脚本

> 负责 Agent：database　｜　日期：2026-09-28
> 写范围：`sql/`、`src/test/resources/schema-h2.sql`、`docs/TASK-000/03-DATABASE.md`
> 状态：**已完成**。全部为**纯增量**变更，本次**没有任何删表/删列/改类型/改主键**。

---

## 0. 一页速查（后端从这里开始）

| 迁移 | 新增表 | 新增列 | 破坏性 |
|---|---|---|:-:|
| `V6__merchant_wallet.sql` | `merchant_wallet`、`merchant_wallet_transaction` | — | 无 |
| `V7__platform_settings.sql` | `admin_setting`、`merchant_setting` | — | 无 |
| `V8__review_moderation.sql` | — | `product_order_evaluate.review_status/reviewer_id/review_time/review_remark` | 无 |
| `V9__dashboard_aggregate_indexes.sql` | — | —（纯索引） | 无 |
| `V10__product_status_and_default_address.sql` | — | `product.status`、`shipping_address.is_default` | 无 |
| `V11__order_dashboard_indexes.sql` | — | —（纯索引） | 无 |

> **V11 是第二轮产物**：后端 Agent 的 `04b-SCHEMA-REQUIREMENTS.md` 在我交付后才落地，
> 逐条交叉核对发现 **2 条真实索引缺口**，已补 V11。逐条核对结果见 **§12**。

每个迁移都有 `sql/migrations/rollback/<同名>.sql`（**刻意放子目录**，见 §7）。
H2 测试 schema `src/test/resources/schema-h2.sql` 已全部同步，**已用 H2 2.2.224 实跑验证**（§8）。

---

## 1. 现有库的事实基线（动手前先核过）

| 事实 | 结论 |
|---|---|
| 表数量 | 23 张（schema.sql 15 + chat.sql 2 + phase1 6） |
| **表级缺口** | **0** —— 23 张表**全部**已同步到 `schema-h2.sql`，表名、列名、种子都对得上 |
| 索引缺口 | H2 缺 V4 的二级索引（已在本次补齐，见 §6） |
| 物理外键 | **全库 0 个**。既有约定即"逻辑外键"：列 + 索引 + 应用层校验 |
| 唯一键缺口 | V4 已补齐（`uk_user_product` / `uk_username` / `uk_code` / `uk_order_no` 等） |
| 金额精度 | V2 + V5 已把 `user.balance` / `product.price` / `product_order.total_money` / `coupon.value` / `coupon.min_order` / `coupon.max_discount` / `return_request.refund_amount` 全部收成 `DECIMAL` |

**所以本次工作不是"补漏表"，而是"补业务能力所必需的新结构"。** 这也是总控解除 task-3 对 task-2 依赖的依据：数据模型的输入由 P0 优先级直接驱动，不由架构文档推导。

---

## 2. 三条贯穿全局的设计约定

### 2.1 不建物理外键 —— 沿用既有约定，不是偷懒

全库 23 张表一个 `FOREIGN KEY` 都没有。本次新增的表同样不建，理由：

- 关联基数已由唯一键表达（`uk_wallet_shop_id`、`uk_txn_no`），FK 不提供额外信息；
- H2 + MockMvc 反复建表/清表，FK 会引入与业务无关的失败；
- 混用会让"本库是否真的一致"变得不可预测。

**逻辑关联（应用层必须保证）已逐条写进迁移脚本注释**：

| 子表列 | 指向 |
|---|---|
| `merchant_wallet.shop_id` | `shop.id` |
| `merchant_wallet_transaction.wallet_id` | `merchant_wallet.id` |
| `merchant_wallet_transaction.shop_id` | `shop.id`（**冗余列**，为省掉一次 join；写入方须保证与 `wallet_id` 一致） |
| `admin_setting.update_by` | `admin.id` |
| `merchant_setting.shop_id` | `shop.id` |
| `product_order_evaluate.reviewer_id` | `admin.id` |

### 2.2 金额一律 DECIMAL，但**不是所有金额都用 (10,2)**

| 字段 | 精度 | 理由 |
|---|---|---|
| `merchant_wallet.balance` / `pending_amount` / `total_income` / `total_withdraw` | `DECIMAL(14,2)` | 这些是**累计量**不是单笔金额。`(10,2)` 上限 99,999,999.99，单商家累计收入超这一量级就会在加法时溢出报错 |
| `merchant_wallet_transaction.amount` / `balance_before` / `balance_after` | `DECIMAL(14,2)` | 与上面同宽，`balance_after = balance_before ± amount` 在同精度下不会 DECIMAL 截断 |
| `admin_setting.commission_rate` | `DECIMAL(7,4)` | 这是**费率**不是金额。前端硬编码值 `5.0`（百分数），但比例制 `0.05` 也可能出现，`(10,2)` 会把 `0.05` 之外的精度全丢 |
| 既有 `price` / `total_money` / `balance` 等 | `DECIMAL(10,2)`（不动） | 单笔金额，(10,2) 足够 |

**全库零 FLOAT/DOUBLE 金额列。** 本次新增列中没有一个是 float/double。

### 2.3 金额符号：流水金额恒为正，但**出参必须转带符号**

`merchant_wallet_transaction.amount` 恒为正数，收支方向由 `direction`（`income`/`expense`）表达。这样做的好处：

- `SUM()` / 聚合不必按符号分支；
- 「退款 0.00」这类边界值仍然有明确方向（带符号时 0.00 两头都像）；
- 对账算式 `balance_before ± amount` 语义明确。

#### ⚠️ 但后端出参**必须转成带符号** —— 硬性契约

前端**完全依赖 `amount` 的正负号**判断收支并着色：

```vue
<!-- web/src/pages/merchant/Wallet.vue -->
L115  :class="row.amount >= 0 ? 'text-emerald-600' : 'text-red-600'"
L120  {{ row.amount >= 0 ? '+' : '' }}${{ Math.abs(row.amount).toFixed(2) }}
```

若直接返回库里的正数 `amount`，**一笔提现会渲染成绿色的「+$500.00」而不是红色的「-$500.00」**。DTO 组装必须写成：

```java
BigDecimal signedAmount = "income".equals(txn.getDirection())
        ? txn.getAmount()
        : txn.getAmount().negate();
```

`type` 与前端 `WalletTransaction.type`（`merchantWallet.ts:12`）严格对齐，`type ↔ direction` 一一对应，不会出现"类型是提现但方向是入账"的自相矛盾行。

---

## 3. V6 —— 商家钱包（总控 P0-1）

**本期边界（已确认）：只做「余额 + 流水只读 + 提现记录 pending」，真实打款不碰。**

### 3.1 `merchant_wallet`（商家余额，1:1 挂 shop）

| 列 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT | | 主键 |
| `shop_id` | INT NOT NULL | | 商家 id（逻辑外键 → `shop.id`） |
| `balance` | DECIMAL(14,2) NOT NULL | 0.00 | **可用余额**（可提现） |
| `pending_amount` | DECIMAL(14,2) NOT NULL | 0.00 | 待结算/冻结金额（尚不可提现） |
| `total_income` | DECIMAL(14,2) NOT NULL | 0.00 | 累计入账（只增不减，含已被提现部分） |
| `total_withdraw` | DECIMAL(14,2) NOT NULL | 0.00 | 累计提现（只增不减） |
| `currency` | VARCHAR(10) NOT NULL | `'USD'` | 币种（ISO 4217，对应前端 `Wallet.currency`） |
| `create_time` | TIMESTAMP NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | DATETIME | NULL | 最后变更时间 |

键：`PK(id)`、**`UNIQUE uk_wallet_shop_id(shop_id)`** —— 1:1 的唯一性依据，同时兜住并发建钱包。

### 3.2 `merchant_wallet_transaction`（钱包流水）

| 列 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT | | 主键 |
| `wallet_id` | INT NOT NULL | | 钱包 id（→ `merchant_wallet.id`） |
| `shop_id` | INT NOT NULL | | 商家 id（**冗余**，便于按商家直接聚合） |
| `txn_no` | VARCHAR(64) NOT NULL | | 流水号（全局唯一，对外展示） |
| `type` | VARCHAR(20) NOT NULL | `'adjustment'` | `sale`/`withdrawal`/`refund`/`fee`/`adjustment` |
| `direction` | VARCHAR(10) NOT NULL | `'income'` | `income`=入账 / `expense`=出账 |
| `amount` | DECIMAL(14,2) NOT NULL | 0.00 | 金额，**恒为正** |
| `balance_before` | DECIMAL(14,2) NOT NULL | 0.00 | 变动前可用余额 |
| `balance_after` | DECIMAL(14,2) NOT NULL | 0.00 | 变动后可用余额 |
| `ref_type` | VARCHAR(30) | NULL | 关联单据类型 `order`/`withdraw`/`manual` |
| `ref_no` | VARCHAR(64) | NULL | 关联单据号（如 `product_order.order_no`） |
| `status` | VARCHAR(20) NOT NULL | `'completed'` | `completed`/`pending`/`failed`（**与前端对齐**） |
| `description` | VARCHAR(255) | NULL | 描述（前端展示） |
| `idempotency_key` | VARCHAR(128) | NULL | **幂等键** |
| `create_time` | TIMESTAMP NOT NULL | CURRENT_TIMESTAMP | 发生时间 |
| `update_time` | DATETIME | NULL | 最后变更（pending→completed/failed 时回写） |

**`type` ↔ `direction` ↔ 前端契约**（`web/src/api/modules/merchantWallet.ts` 的 `type: 'sale'|'withdrawal'|'refund'|'fee'`）：

| type | direction | 触发 |
|---|---|---|
| `sale` | income | 订单结算入账 |
| `withdrawal` | expense | 商家提现 |
| `refund` | expense | 订单退款出账 |
| `fee` | expense | 平台佣金/手续费 |
| `adjustment` | income / expense | 人工调账 |

### 3.3 幂等设计（总控点名要的重点）

幂等落点是 **`uk_idempotency_key(idempotency_key)` 唯一索引**。

- 约定 `key = f(type, ref_type, ref_no)`，例如 `withdrawal:withdraw:W20260928001`
- 首次提交：插入流水 + 扣款成功
- 重复提交：撞 1062 → 应用层捕获 `DuplicateKeyException`，按 `idempotency_key` 查出原流水**原样返回**
- **结果：余额不变、流水不新增**

补充两点后端必须知道：

1. 该列为 NULL 时**不受唯一约束**（MySQL 唯一索引允许多行 NULL）。所以只有显式带幂等键的写才受保护；纯调账可留 NULL。**建议对所有 type 都构造幂等键，只有 adjustment 才允许 NULL。**
2. `balance_before`/`balance_after` 冗余存储是对账抓手，也是测试断言"重复提现余额不变"的依据。写入必须在**同一事务**里：先 `UPDATE merchant_wallet ... WHERE shop_id=? AND balance >= ?`（条件 UPDATE 防超扣，仿 `ProductMapper.deductStock`），确认受影响行数为 1 再 `INSERT` 流水。

### 3.4 索引依据（每条都指到具体查询形状）

| 索引 | 服务的查询 |
|---|---|
| `idx_wtxn_shop_time(shop_id, create_time)` | `GET /merchant/wallet/transactions` 按商家 + 时间倒序分页 |
| `idx_wtxn_wallet_time(wallet_id, create_time)` | 对账：按钱包取全部流水 |
| `idx_wtxn_ref(ref_type, ref_no)` | 按单据反查（退款幂等判定） |
| `idx_wtxn_status(status, create_time)` | 后台筛 `pending` 提现 |

### 3.5 存量数据处理

```sql
INSERT IGNORE INTO merchant_wallet (...) SELECT id, 0.00, ... FROM shop;
```

- 存量 shop 的**订单金额不回填**为余额 —— 那属于历史对账口径，需与业务确认后再补。本次只保证"每个商家都有钱包行"，余额从 0.00 起由流水累加。

---

## 4. V7 —— 设置持久化（总控 P0-2）

### 4.1 决策：强字段结构，**不是 KV**（总控已批准）

理由写死备查，将来有人想改成 KV 时能看到为什么：

1. **字段集合已被前端契约钉死**，不是开放集合：
   - `admin`：`siteName` / `maintenanceMode` / `allowRegistrations` / `commissionRate`
   - `merchant`：`storeName`/`description`/`logo`/`email`（复用 `shop` 已有列）+ `location`/`responseTime`/`policies{shipping,returns}`/`notifications{email,push,sms}`
2. **嵌套结构本来就得拆列**：`policies`/`notifications` 是对象，KV 也要拆成 `policies.shipping` 这类扁平键，并不比拆列省事，反而丢了类型。
3. **默认值无处安放**：强字段可写 `DEFAULT ''/0/1`；KV 表每行自带 value，新增字段容易出现"键不存在"的半初始化状态。
4. 商城设置天然是低基数、强约束的运营参数，**不是**用户自定义配置。KV 唯一合适的场景是"插件式、运营可自增的任意配置"，本项目没有这个需求。

**改成 KV 的收益为零，代价是把编译期类型检查换成运行期转换。**

### 4.2 `admin_setting`（单行表）

`singleton TINYINT NOT NULL DEFAULT 1` + `UNIQUE uk_singleton(singleton)` 表达"单行表"，读法固定 `WHERE singleton = 1`。

> 为什么不用 `CHECK(id=1)`：MySQL 8 的 CHECK 语法可用，但 H2 `MODE=MySQL` 下语义需单独验证，而唯一键在两边行为完全一致。

| 列 | 类型 | 默认 | 前端字段 |
|---|---|---|---|
| `singleton` | TINYINT NOT NULL | 1 | （单行标记） |
| `site_name` | VARCHAR(255) NOT NULL | `'Nexus Market'` | `siteName` |
| `maintenance_mode` | TINYINT(1) NOT NULL | 0 | `maintenanceMode` |
| `allow_registrations` | TINYINT(1) NOT NULL | 1 | `allowRegistrations` |
| `commission_rate` | DECIMAL(7,4) NOT NULL | 5.0000 | `commissionRate` |
| `contact_email` | VARCHAR(255) | NULL | — |
| `update_by` | INT | NULL | （`admin.id`） |
| `update_time` | DATETIME | NULL | — |

**默认值刻意与 `AdminApiController.getSettings()` 现在的硬编码返回逐字一致**（`Nexus Market` / 关闭维护 / 允许注册 / `5.0`）—— 迁移一落地，接口返回值不变，**不存在"迁移引入行为变化"**。

### 4.3 `merchant_setting`（每店一行）

| 列 | 类型 | 默认 | 前端字段 |
|---|---|---|---|
| `shop_id` | INT NOT NULL | | （逻辑外键 → `shop.id`） |
| `location` | VARCHAR(255) | NULL | `settings.location` |
| `response_time` | VARCHAR(64) | NULL | `settings.responseTime` |
| `shipping_policy` | TEXT | NULL | `settings.policies.shipping` |
| `return_policy` | TEXT | NULL | `settings.policies.returns` |
| `notify_email` | TINYINT(1) NOT NULL | 1 | `settings.notifications.email` |
| `notify_push` | TINYINT(1) NOT NULL | 0 | `settings.notifications.push` |
| `notify_sms` | TINYINT(1) NOT NULL | 1 | `settings.notifications.sms` |

键：`UNIQUE uk_merchant_setting_shop_id(shop_id)`。

**`storeName`/`description`/`logo`/`email` 不入本表**，由 `GET /merchant/settings` 合并 `shop` 行 + 本表行返回。理由：这 4 个值在商家列表、商品卡片等处也在用，复制成第二份必然漂移。

---

## 5. V8 / V10 —— 既有表加列

### 5.1 V8：`product_order_evaluate` 评价审核（总控 P0-3）

| 列 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `review_status` | VARCHAR(20) **NOT NULL** | `'visible'` | `visible` / `hidden` —— **直接用前端 `AdminReviewStatus`，不要另造中文枚举** |
| `reviewer_id` | INT NULL | NULL | 审核人 `admin.id` |
| `review_time` | DATETIME NULL | NULL | 审核时刻 |
| `review_remark` | VARCHAR(500) NULL | NULL | 驳回/隐藏原因 |

索引：`idx_review_status_time(review_status, review_time)` —— 审核列表全量分页，但后台筛选/只看待审会"按状态过滤 + 按审核时间排序"，复合索引既可过滤又可排序。

**为什么加列而不是新表**（总控倾向加列，已获批）：

1. 审核状态是**评价自身的属性**，不是独立实体。没有"一条评价对应多条审核记录"的需求，拆表立刻产生 1:N 的无意义 join。
2. **不破坏现有查询**：`ProductOrderEvaluateMapper.xml` 用 `SELECT product_order_evaluate.*`，`.*` 自动带出新列；实体不加字段也只是忽略多余列。
3. 存量行语义不变：新列带 `DEFAULT 'visible'`，所有存量评价视为"可见"，与迁移前"所有评价都在列表里"**逐字一致**，**无历史数据需要回填**。

### 5.2 V10：`product.status` + `shipping_address.is_default`

**`product.status`** 取值 = 前端两处声明的并集：

| 值 | 含义 | 买家侧 |
|---|---|---|
| `active` | 已上架 | **可见** |
| `draft` | 草稿 | 不可见 |
| `archived` | 归档（隐藏但保留历史） | 不可见 |
| `banned` | 封禁（对应 `DELETE /admin/products/{id}/ban`） | 不可见 |

存量行全部落 `active`，买家侧可见性迁移前后**不变**。

**`shipping_address.is_default`**：`TINYINT(1) NOT NULL DEFAULT 0`。存量行全为 0 —— **本迁移不替用户猜默认地址**，由用户首次 `PUT /addresses/{id}/default` 确定（更符合真实语义）。

不变式"一个用户至多一个默认地址"**不在 DB 建唯一键**，由应用层在事务里保证：

```sql
UPDATE shipping_address SET is_default = 0 WHERE user_id = ?;
UPDATE shipping_address SET is_default = 1 WHERE id = ? AND user_id = ?;
```

这与 V4 既定做法一致（V4 注释首段：「数据库约束与应用层校验必须共同保证数据正确性」）。若将来要下沉到 DB，正确写法见 §6。

### 5.3 ⚠️ 后端必读：`product.status` 加列后，**哪些既有查询要加过滤**

> 加列当天起**不加过滤等于没修** —— 商家一旦开始写 `draft`/`banned`，买家侧会重新看到下架商品。
> 下表逐个列出全仓库所有读 `product` 的入口。

| # | 方法 / 位置 | 是否要加 `status='active'` |
|---|---|:-:|
| **A** | `ProductMapper.queryPage` / `queryCount`（共用 `<sql id="queryConditions">`，`ProductMapper.xml` L25-37） | **按调用方，见下** |
| A-1 | `StorefrontProductController` L61 商品列表 | ✅ 必须 |
| A-2 | `StorefrontSearchController` L47 / L97 搜索、推荐 | ✅ 必须 |
| A-3 | `StorefrontMerchantController` L123 / L147 店铺内商品 | ✅ 必须 |
| A-4 | `MerchantApiController` L81（低库存）/ L116（商家商品列表） | ❌ 商家要看到自己全部四档 |
| A-5 | `AdminApiController` L274 后台商品列表 | ❌ 按前端传入的 `status` 过滤，缺省 `=all` 不过滤 |
| **B** | `ProductMapper.selectById` —— 买家侧详情 | ✅ 非 active 返回 **404**；后台/商家侧不判 |
| **C** | `ProductMapper.list()` / `ProductServiceImpl` L60 `all()` —— 调用方是 `StorefrontProductController` L117/L154/L177 的"同店相关商品" | ✅ 必须 |
| **D** | `ProductMapper.salesVolumeTop(size)` / `salesVolumeTopByShopId(...)`（`ProductServiceImpl` L124/L132；`StorefrontMerchantController` L88 精选商品） | ✅ 必须，否则封禁商品会被推荐出去 |
| **E** | `ProductMapper.selectTypeCount()` / `selectTypeCountByShopId()`（分类计数看板） | 建议**计入 active**，让看板反映真实在售结构 |
| **F** | `StorefrontCheckoutController` L58 的 `selectById` —— **成交路径** | ✅ 必须 |
| **G** | `ShoppingCartServiceImpl` L134 / `ProductOrderServiceImpl` L105 的 `selectById` | ✅ 必须（购物车里可能躺着早已下架的商品） |

**F 和 G 最容易被漏** —— 它们不是展示路径，是**下单路径**。

**实现建议（不要写死 `status='active'`）**：

```xml
<!-- ProductMapper.xml 的 queryConditions 内 -->
<if test="query.status != null and query.status != ''">
    AND product.status = #{query.status}
</if>
```

由各 Controller 决定传不传。**在 `queryConditions` 里写死 `status='active'` 会让后台和商家端一起瞎。**

---

## 6. V9 与索引补齐

### 6.1 V9：看板聚合时间索引

| 索引 | 服务的查询 | 为什么现有索引不够 |
|---|---|---|
| `product_order.idx_create_time(create_time)` | `GET /admin/dashboard/revenue-chart`（按日分桶）、`stats` 的近 7/30 天 GMV、商家看板同款 | V4 的 `idx_status_create_time(status, create_time)` **只在带 status 前导时可用**。收入趋势图那条 `WHERE create_time BETWEEN ? GROUP BY DATE(create_time)` 按最左前缀用不上它 |
| `product_browsing_history.idx_create_time(create_time)` | 看板 "Active Now"：近 N 分钟内有浏览行为的去重用户数 | V4 的 `idx_user_id(user_id)` 只在"限定单个用户"时有用，对"限定时间窗口、跨所有用户"的聚合同样用不上 |

**为什么不加更多**：

- 不为 `product_order.total_money` / `product.sales_volume` 建索引 —— 只出现在 `SUM`/`ORDER BY` 的**聚合结果**里，不作过滤条件，建了不被使用。
- 不为 `product.name` 建索引 —— `LIKE '%kw%'` 是前导通配，索引无效；全文检索是 ES 的活，不该用索引硬凑。
- 不建覆盖索引 —— 随列变更失效，维护成本高于收益。

### 6.2 V10 的索引

| 索引 | 服务的查询 |
|---|---|
| `product.idx_shop_status(shop_id, status)` | 商家/店铺列表"按商家 + 按状态"双条件过滤。低基数的 `status` 单列索引选择性差，复合后才有区分度 |
| `product.idx_status_id(status, id)` | 后台列表 `WHERE status=? ORDER BY id DESC LIMIT 100`。把 `id` 放进第二列才能**同时**满足过滤与排序，避免 filesort |
| `shipping_address.idx_user_default(user_id, is_default)` | `ShippingAddressMapper` 对 `user_id` **此前完全没有索引**（全库唯一没有索引的过滤列）；地址列表与"取默认地址"都走它 |

### 6.3 H2 侧补齐 V4 遗留索引 —— **可选项，不是测试必需**

原 `schema-h2.sql` 缺 V4 的二级索引。**这不影响测试正确性**（H2 只是内存库，数据量与执行计划与生产无关）。本次补齐的目的是**让 H2 与 MySQL 行为一致，避免"本地测过、MySQL 上执行计划不同"的隐蔽问题**。

已在 H2 侧建（**全部标记为 `[对齐]`，将来删掉也不会让测试挂**）：

```
idx_ord_user_id, idx_ord_shop_id, idx_ord_status_ctime   -- product_order
idx_prod_shop_id, idx_prod_type_id                        -- product
idx_pay_user_id, idx_pay_status                          -- payment
idx_pbh_user_id, idx_pbh_product_id                      -- product_browsing_history
idx_poe_user_id, idx_poe_product_id, idx_poe_order_id,
idx_poe_review_status_time                                -- product_order_evaluate
idx_cpn_status                                           -- coupon
idx_rr_user_id                                           -- return_request
idx_notif_role_user                                      -- notification
idx_msg_conv_ctime                                       -- message
```

### 6.4 ⚠️ H2 索引命名的**硬性差异**（改之前先读完）

> MySQL 的索引名是**表内唯一**，H2 是 **schema 内全局唯一**。
>
> 若照抄 MySQL 的 `idx_user_id`（它在 MySQL 里挂在 5 张表上），
> `CREATE INDEX IF NOT EXISTS` 会让**第二张之后的表静默拿不到索引** ——
> H2 看到"同名索引已存在"就跳过，而它属于**另一张表**。不报错、不告警，索引就是没建。
>
> 所以 `schema-h2.sql` 里的二级索引**一律加表名前缀**，与 MySQL 侧名字**故意不同**。
> 唯一键（`UNIQUE`）用表内约束，H2 自动命名，不冲突 —— 无需加前缀。

### 6.5 `is_default` 唯一约束的预留硬化方案（本期不实施）

若将来要把"一个用户至多一个默认地址"下沉到 DB，正确写法是**生成列 + 唯一索引**（非默认行取 NULL，唯一索引允许多 NULL）：

```sql
ALTER TABLE shipping_address
  ADD COLUMN user_id_if_default INT GENERATED ALWAYS AS
    (CASE WHEN is_default = 1 THEN user_id ELSE NULL END) VIRTUAL,
  ADD UNIQUE KEY uk_user_one_default (user_id_if_default);
```

本期不做的原因：MySQL 与 H2 `MODE=MySQL` 对生成列的支持需分别验证，而 V4 既定做法就是"DB 约束 + 应用层事务"双保险。

---

## 7. 迁移与回滚的组织方式

### 7.1 回滚脚本为什么在子目录 —— **刻意的，别放错位置**

`docker/entrypoint.sh` L146 会 **glob 导入 `sql/migrations/*.sql`（非递归）**。回滚脚本若与迁移同级，会在首次建库时被当成一个待应用的迁移**自动执行**，把刚建好的表/列/索引立刻删掉。

因此全部回滚脚本放在 `sql/migrations/rollback/`：

```
sql/migrations/
├── V6__merchant_wallet.sql                    ← 迁移(会被 glob)
├── V7__platform_settings.sql
├── V8__review_moderation.sql
├── V9__dashboard_aggregate_indexes.sql
├── V10__product_status_and_default_address.sql
└── rollback/                                  ← 刻意子目录(不会被 glob)
    ├── V6__merchant_wallet.sql
    ├── V7__platform_settings.sql
    ├── V8__review_moderation.sql
    ├── V9__dashboard_aggregate_indexes.sql
    └── V10__product_status_and_default_address.sql
```

> 仓库既有的 `rollback/V2`、`V3`、`V4`、`V5` 已遵循同一约定；`rollback/V1__security.sql` **历史缺失**（V1 只改数据不改结构，回滚只需把那三行 UPDATE 改回去），**本次未补**——不在本次变更范围，且补它对结构无影响。

### 7.2 新迁移对**已有库**不会自动生效

`entrypoint.sh` 只在首次建库时导入 `migrations/`（靠 `${DATA_DIR}/.schema-imported` 标记，该文件在 MySQL 数据卷里，容器重建后依然存在）。**手工应用**：

```bash
docker exec nexus-dev bash -lc '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 \
    template_v3 < /workspace/sql/migrations/V6__merchant_wallet.sql'
# 回滚
docker exec nexus-dev bash -lc '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 \
    template_v3 < /workspace/sql/migrations/rollback/V6__merchant_wallet.sql'
```

**必须带 `--default-character-set=utf8mb4`**，否则含中文的注释与默认值会双重编码乱码。

### 7.3 幂等性分级

| 迁移 | 可重复执行？ | 原因 |
|---|:-:|---|
| V6 / V7 | ✅ 可以 | `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` 种子 |
| V8 / V9 / V10 | ❌ 不可以 | MySQL 8 的 `ADD COLUMN`/`ADD KEY` 没有 `IF NOT EXISTS`，重复执行报 1060/1061/1062。要重跑**先执行回滚** |

每个迁移脚本头部都带「执行后验证」查询，末尾附 `mvn -B clean test` 闸门提示。

### 7.4 回滚的破坏性提示（全部已写进脚本头部）

| 回滚 | 破坏性 | 丢什么 |
|---|---|---|
| `V6` | ⚠️ 丢数据 | 全部钱包流水与余额快照 —— **丢的是资金流水，不可逆** |
| `V7` | ⚠️ 丢数据 | 管理员改过的设置值（运营手输，不可重算） |
| `V8` | ⚠️ 丢信息 | 审核记录（谁/何时/为何隐藏）—— 评价正文不丢 |
| `V9` | 纯结构 | 不丢数据，仅看板聚合退化 |
| `V10` | ⚠️ 丢信息 | `product.status` 丢失 ⇒ **已下架商品立刻重新对买家可见**；`is_default` 丢失 ⇒ 退回无默认地址 |

每个破坏性回滚都附了 `mysqldump` 备份命令。

---

## 8. H2 同步与验证结果

### 8.1 同步内容（`src/test/resources/schema-h2.sql`）

| 类别 | 内容 | 标注 |
|---|---|---|
| **必需** | `merchant_wallet`、`merchant_wallet_transaction`、`admin_setting`、`merchant_setting` 四张表 | 缺了后端测试直接报表不存在 |
| **必需** | `product_order_evaluate` 的 4 个 `review_*` 列 | 同上 |
| **必需** | `product.status`、`shipping_address.is_default` | 同上 |
| **必需** | Phase 3 种子：2 个钱包行、1 行 `admin_setting`、2 行 `merchant_setting` | |
| 对齐 | 新表的 4 条 `idx_wtxn_*` 索引 | 可选 |
| 对齐 | `product`/`shipping_address` 的 3 条 V10 索引 | 可选 |
| 对齐 | 15 条 V4 遗留二级索引 | 可选 |

### 8.2 实际跑通验证（不是"看着像对"）

用 Spring Boot 3.2 实际依赖的 **H2 2.2.224**（`com.h2database:h2`，版本由 BOM 管理），在与 `application-test.yaml` **完全一致**的连接串下执行：

```
jdbc:h2:mem:testdb;MODE=MySQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=USER,VALUE
```

```
RUNSCRIPT_EXIT=0                       -- 整个 schema 一次跑通,无语法错误
(27 rows)                              -- 表:23 原有 + 4 新增
INDEXES=68                             -- 含原有 UNIQUE 与本次全部新增索引
```

抽样核对：

```
SHOW COLUMNS FROM product_order_evaluate;
  REVIEW_STATUS   | CHARACTER VARYING(20) | NO |     | 'visible'
  REVIEWER_ID     | INTEGER                | YES|     | NULL
  REVIEW_TIME     | TIMESTAMP              | YES|     | NULL
  REVIEW_REMARK   | CHARACTER VARYING(500) | YES|     | NULL

SHOW COLUMNS FROM product;
  STATUS          | CHARACTER VARYING(20)  | NO |     | 'active'

SHOW COLUMNS FROM shipping_address;
  IS_DEFAULT      | TINYINT                | NO |     | 0

SHOW TABLES;  → ADMIN_SETTING / MERCHANT_SETTING / MERCHANT_WALLET /
                MERCHANT_WALLET_TRANSACTION  均已建出
```

**H2 兼容要点**（本次全部规避）：

- 无 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=...`（H2 文件里不写）
- 无 `INSERT IGNORE`（H2 侧用普通 `INSERT`，与该文件既有种子风格一致）
- 标识符避开 H2 保留字：`NON_KEYWORDS=USER,VALUE` 已覆盖 `user`/`value`，本次新增列（`type`/`status`/`direction`/`description`/`location`/`singleton`/`direction` 等）经查证**均不在** H2 2.x 保留字表内
- `notification.role` 沿用文件既有的反引号写法
- `DECIMAL(14,2)` / `DECIMAL(7,4)` 两库语法一致

### 8.3 一个已知的既有行为（不是本次引入）

`schema-h2.sql` 的种子是**普通 INSERT 带显式 id**，不幂等。`mem:testdb` 带 `DB_CLOSE_DELAY=-1`，同一 JVM 内若 Spring 上下文被重建并重跑 schema，种子会撞主键。**这是该文件既有行为，本次未改动也未加重**（本次新增种子沿用同一风格）。若将来出现上下文重建导致的种子冲突，正确修法是给种子加 `MERGE INTO ... KEY(...)`，而不是改本次 SQL。

---

## 9. `return_request` 审批流转 —— **预留说明，本期不实施**

> 总控明确指示：**本期不动**，避免与后端退款逻辑改动撞车。以下仅作设计备案。

### 9.1 问题

`AuthzRules.java` L68 的 `/returns/**` **仅放行 USER**，SHOP 与 ADMIN 均为 403。`return_request` 表虽有 `status` 列（`pending`/`approved`/`rejected`/`refunded`）和 `updated_time`，但**没有任何审批端点**：

- 买家能 `GET`/`POST`，商家与管理员**无法审批**
- 因此"退货"永远不会触发实际退款（注意：**取消订单的退款是真实执行的**，走 `ProductOrderServiceImpl.cancelRows` 按 `payment.channel` 分流，与退货流程无关）

### 9.2 若要做审批流转，需要的字段

`return_request` **现有列已够用**：`status`、`updated_time`、`refund_amount`。建议补的可空列（全部纯增量）：

| 列 | 类型 | 语义 |
|---|---|---|
| `shop_id` | INT NULL | 归属商家（现在只能靠 `order_id` 反查，多一次查询） |
| `reviewer_id` | INT NULL | 审批人（ADMIN 或对应 `shop.id`） |
| `review_remark` | VARCHAR(500) NULL | 同意/驳回理由 |
| `reviewed_at` | DATETIME NULL | 审批时刻（与 `updated_time` 区分：后者是任意更新时间） |
| `refund_channel` | VARCHAR(20) NULL | 实际退款渠道（`balance`/`card` 等），与 `payment.channel` 对齐 |
| `refunded_at` | DATETIME NULL | 退款完成时刻（幂等判据） |

配套索引：`(shop_id, status)`、`(status, created_time)`。

### 9.3 流转约束（**必须由应用层事务保证，不是 DB 能管的**）

```
pending ──approve──> approved ──confirmReceived/refund──> refunded
   │
   └──reject──> rejected
```

关键不变式：

1. **`pending → approved` 必须幂等** —— 用条件 UPDATE 抢占行所有权（仿 `ProductOrderServiceImpl.cancelRows` 的做法）：`UPDATE ... SET status='approved' WHERE id=? AND status='pending'`，受影响行数为 0 即已被处理，直接返回当前状态。
2. **`refunded` 只能由支付侧驱动** —— 退款金额上限必须以该订单实付金额为准由服务端算（现有 `ReturnRequestCreateDTO` 已是这个口径，审批环节不得放宽）。
3. **退款必须与 `merchant_wallet` 对账** —— `refund` 类型流水（`direction='expense'`）在真正退款时才写，与 `return_request.refunded_at` 同事务。
4. **越权防护** —— 商家只能审批 `shop_id = 自己的 shop.id` 的单；管理员可审批全部。归属不匹配返 **403**，不存在返 **404**（对齐 `AuthorizationBaselineTest` 约定）。

### 9.4 为什么本期不做

涉退款，属审计标记的高风险批次；且需要同时改 `AuthzRules` 放行 SHOP/ADMIN、新增审批端点、改退款链路 —— 与 TASK-000-D 的钱包/设置改造撞车。**排在钱包与设置落地、回归稳定之后。**

---

## 10. 遗留与交接

### 10.1 给后端 Agent（消费本产出）的清单

1. **实体需加字段**：`Product.status`、`ShippingAddress.isDefault`、`ProductOrderEvaluate` 的 4 个 `review*`。
2. **Mapper 需加字段**：对应 XML 的 `insert`/`updateById` 的 `<if>` 列表（否则新列永远写不进去）。
3. **`ProductMapper.queryConditions` 加可选 `status` 条件** —— 不要写死，见 §5.3。
4. **钱包写入必须单事务 + 条件 UPDATE**，见 §3.3。
5. **钱包流水出参必须转带符号金额**，否则提现会显示成绿色 "+$500" 而不是红色 "-$500"，见 §2.3。
6. **`GET /merchant/settings` 需合并 `shop` 行与 `merchant_setting` 行**，见 §4.3。
7. **新端点必须在 `config/AuthzRules` 显式登记**，否则默认拒绝 403。
8. **金额一律服务端按 DB 价格计算**，不信任前端传入值。

### 10.2 本次未做、但已知的缺口（不在本次范围）

| 项 | 来源 | 状态 |
|---|---|---|
| 库存扣减/回补**流水表** | REQUIREMENTS-GAP §3.6 | 未做。与 §3 的钱包流水是不同语义（一个记钱、一个记货），本期钱包优先 |
| SPU/SKU 规格拆分 | REQUIREMENTS-GAP §3.1 | 未做，属 Phase 2~3 独立批次 |
| `audit_log` 操作审计 | REQUIREMENTS-GAP §6 合规基线 | 未做，无端点消费，建了也是死表 |
| 搜索 trending/facets 的专用表 | REQUIREMENTS-GAP §3.1 | 未做。facets 可由 `product` 现有列聚合得出；trending 建议先从 `product_browsing_history` 聚合，量级上来再考虑专表 |
| `rollback/V1__security.sql` | 仓库历史缺失 | 未补（V1 只改数据不改结构） |

**不建"没人用的表"** —— 上面每一项都缺一个消费它的端点，先建表只会制造死结构。

---

## 11. 自检记录

| 检查项 | 结果 |
|---|:-:|
| 新增表是否三处同步（`sql/` + H2 + migrations） | ✅ 4 张表全部 |
| 新增列是否三处同步 | ✅ 6 个列全部 |
| 每个迁移是否有配套 rollback | ✅ 6/6 |
| rollback 是否都在 `sql/migrations/rollback/` 子目录 | ✅ |
| 是否有破坏性变更（删表/删列/改类型/改主键） | ✅ **无**（全部为 CREATE / ADD COLUMN / ADD KEY） |
| 金额是否全部 DECIMAL、零 float/double | ✅ |
| SQL 文件是否 utf8mb4 | ✅ 含中文注释，导入命令均标注 `--default-character-set=utf8mb4` |
| H2 schema 是否实跑验证 | ✅ H2 2.2.224，`RUNSCRIPT_EXIT=0`，**27 表 / 73 索引** |
| 是否触碰 Java / Vue 代码 | ✅ 未触碰（只读引用） |
| 是否有唯一键/索引无设计依据 | ✅ 每条索引都在迁移脚本注释里指向具体查询形状 |

---

## 12. 与后端 `04b-SCHEMA-REQUIREMENTS.md` 的交叉核对（第二轮）

> 后端 Agent 的《04b-Schema 需求校准清单》在我第一轮交付**之后**才落地。
> 按总控「先做一版、后续校准」的指示，逐条核对了 6 项。结果如下。

| # | 后端提的需求 | 核对结果 |
|---|---|---|
| P0-1 | `product.status` 列 | ✅ **已覆盖**（V10），DDL 与其建议**逐字一致**。见下方 ⚠️1 |
| P0-2 | `shipping_address.is_default` 列 | ✅ **已覆盖**（V10），DDL 逐字一致；其建议的「生成列 + UNIQUE」我列为**预留硬化方案**（§6.5），本期按应用层事务实现 —— 与总控已批的 YAGNI 口径一致 |
| P1-3 | 订单发货快递单号 `trackingNumber` | ✅ **不需要 database 动手**。`product_order.tracking_number` 列**早已存在**，缺的只是 `MerchantOrderStatusDTO` 的入参 —— 纯 DTO + 校验，是你们的活 |
| P1-4 | `product_order` 三条聚合索引 | ⚠️ **部分缺口 → 已补 V11**。详见下方 ⚠️2 |
| P2-5 | `product_order_evaluate(product_id)` | ✅ **V4 早已建**（`idx_product_id`），且已在 H2 侧补上 `idx_poe_product_id`。**本条可省** |
| P3-6 | 搜索日志表（可选） | ❌ **仍不建**，理由见 §10.2（无消费端点 = 死结构）。其字段草案合理，若将来要建，唯一要改的是 `id` 应用 `INT` 而非其草案里的 `BIGINT` —— 全库 id 一律 `INT` |

### ⚠️1 `product.status` 的枚举取值：后端清单少了一个值

后端 §1.2 写的是三值 `active` / `draft` / `archived`。**实际前端契约是四值**，多一个 `banned`：

```ts
// web/src/api/modules/adminProducts.ts:9
status: 'active' | 'draft' | 'archived' | 'banned'
// web/src/api/modules/merchantProducts.ts:10
status: 'active' | 'draft' | 'archived'
```

我按**前端实际声明的并集**取了四值（V10 注释里列了对照）。`banned` 对应 `DELETE /admin/products/:id/ban` —— 后端 §1.3 也确认了这个端点要「改 `status='archived'`，不再动 stock」。

**这意味着需要后端做一个产品口径决定**：ban 之后能否恢复？
- 若允许恢复 → `banned` 与 `archived` 必须分开（`archived` 商家可自助、`banned` 管理员单向）
- 若不允许恢复 → 统一用 `archived`，`banned` 不用

**我倾向保留 `banned` 四值**，因为 `adminProducts.ts` 已经把 `banned` 写进类型了，砍掉它前端要改类型定义。**这条需要你或总控拍板**，我的默认值是四值、不改动。

### ⚠️2 V11 补的是哪两条，为什么不是三条

后端 §4 要三条。我先按它给的形状**重算**了一遍 `product_order` 的现有索引，发现其中一条**V4 早就建过**：

| 后端要的 | 实际情况 |
|---|---|
| `idx_order_status_time(status, create_time)` | ✅ **V4 L53 已建**，名 `idx_status_create_time`。不必重复建 |
| `idx_order_shop_status(shop_id, status, create_time)` | ❌ 缺 → **V11 补** |
| `idx_order_user_time(user_id, create_time)` | ❌ 缺 → **V11 补** |

缺的原因对照 `AnalyticsMapper.xml` 真实 SQL 就能看出来 —— `paidOrderFilter`（L13-21）是：

```sql
AND product_order.status IN ('待发货', '待收货', '已完成')
[AND product_order.shop_id = #{shopId}]     -- ← 一旦带上这条,最左前缀就失效了
[AND product_order.create_time >= #{since}]
```

不带 `shop_id` 时 `idx_status_create_time` 够用；**一带上 `shop_id`，它就废了**，只剩单列 `idx_shop_id` —— 商家订单量越大退化越明显。V11 的 `idx_ord_shop_status_time` 让 MySQL 能在 `(shop_id, status)` 定位后**对 `create_time` 做范围扫描**。

第二条服务 `countDistinctOrderingUsers`（L149-156）的 `COUNT(DISTINCT user_id) + create_time >= ?`：让 `user_id` 作前导列去重、`create_time` 作第二列承载区间，MySQL 可做 **loose index scan**，免去全表扫 + 临时去重。

另外，后端 §4 L156 写「`schema-h2.sql` 里 `product_order` **只有 `idx_order_no` 一个索引`**」—— **这条已过时**，我第一轮就把 V4 的遗留索引在 H2 侧补齐了，现在 `product_order` 在 H2 里有 7 条索引（已实跑核对）。

### ⚠️3 `order_no` 存量为 NULL：建议**不回填列**，在查询里兜底

后端 §7.3 问「是否要为存量行回填 `order_no`」。**我的答复是：不要回填。**

理由：`order_no` 为 NULL 本身就是有意义的语义 —— V3 迁移注释写明「存量行(order_no NULL)**各自成组**」，NULL 表达的正是「这是一笔独立的旧订单」。回填成 `CONCAT('legacy-', id)` 会把同一批历史订单**焊成一组**，反而改变了它们原本的分组语义。

`AnalyticsMapper` 已经用了正确的解法（L73-74）：

```sql
COUNT(DISTINCT COALESCE(product_order.order_no, CONCAT('legacy-', product_order.id)))
```

**在查询层兜底，而不是在存储层改写。** 这样历史口径永远稳定，也不必担心回填脚本在生产库跑一半失败留下半成品。**无需 database 出迁移。**