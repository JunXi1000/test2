# TASK-000-D1 · Schema 需求校准清单（交给 database Agent）

> 作者：backend Agent · 2026-09-27
> **定位已变更**：本清单不再是「等 database 开工的需求」—— 总控已批准 database 的 P0 设计
> （`merchant_wallet` / `merchant_wallet_transaction` / `admin_setting` / `merchant_setting`
> 四张新表 + `product_order_evaluate` 加审核列）。本文件是**校准材料**：
> 记录 D1 实现过程中新发现、database 那版设计**尚未覆盖**的需求。
>
> ⚠️ 我**没有写任何 SQL**，也没有改 schema。以下每条都需要 database 落地后我才能继续实现。
> 破坏性变更（改既有表）已单独标注，需要总控二次批准。

---

## 0. 优先级速览

> **v2 修订（2026-09-27，database 交叉核对后）**：
> 下面 §1.2 / §1.4 / §4 / §5 的结论已被 database 回 DDL 逐条核对并修正，
> **以本文末尾的「v2 勘误」小节为准**。保留原文是为了留痕，不要据原文派工。

| # | 需求 | 类型 | 破坏性 | 阻塞了什么 | 优先级 |
|---|------|------|--------|------------|--------|
| 1 | `product.status` 列 + 全链路过滤 | 改既有表 | **是** | 管理端/商家端商品状态筛选、下架语义 | P0 |
| 2 | `shipping_address.is_default` 列 | 改既有表 | **是** | `PUT /addresses/:id/default`（现为 no-op） | P0 |
| 3 | 订单发货快递单号 | DTO（非表） | 否 | `PUT /merchant/orders/:id/status` 的 shipped 分支 | P1 |
| 4 | ~~搜索日志表（可选）~~ | 新增表 | 否 | 已被 database 归为后续批次 | P3 |

---

## 1. P0 · `product.status` —— 下架/封禁的语义载体

### 1.1 问题

`DELETE /admin/products/{id}/ban`（`AdminApiController`）当前用 `product.setStock(0)` 充当下架，
而**所有商品列表都不按 stock 过滤**，结果是：

- 被「封禁」的商品**仍然出现在买家前台**（`GET /products`、`GET /merchants/:id/products`、搜索）
- 管理端「Active / Draft / Archived」下拉是摆设（`status` 列不存在，前端三个取值无法落库）
- 库存 0 的正常售罄商品与被封禁的商品无法区分

### 1.2 需要的列

```sql
ALTER TABLE product ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
```

> **v2 勘误（2026-09-27，总控裁定 + database 核对）**：
> 取值域是**四值**，不是三值 ——
>
> | 取值 | 含义 | 谁下的架 |
> |------|------|-----------|
> | `active` | 在售 | — |
> | `draft` | 草稿 | 商家 |
> | `archived` | 商家自主下架 | 商家 |
> | `banned` | 平台处罚封禁，**可申诉恢复** | 平台 |
>
> 依据：前端 `web/src/api/modules/adminProducts.ts:9` 声明
> `'active' | 'draft' | 'archived' | 'banned'`。
> `banned` 与 `archived` **语义不同**（平台处罚 vs 商家自主下架），
> 合并会丢失「谁下的架」这个审计信息。
>
> **由此产生的硬要求（落在 backend 身上）**：必须实现 **ban 与 unban 两个动作**。
> 当前 `banProduct` 用 `setStock(0)` 充当下架，有两个问题：
> ① 语义混淆（与 `archived` 分不开）；② **永久丢失真实库存** ——
> 下架商品的 stock 应该还在，只是不可见；改成 `stock=0` 会让「下架」与「售罄」不可区分。
>
> **改造要求：只改 `status`，不再动 `stock`。**

- MySQL 8 的 ADD COLUMN 带 DEFAULT 不锁表大改，回滚脚本就是 `DROP COLUMN status`

### 1.3 需要同步的过滤点（D1 已把参数接上，缺的是列）

| 端点 | 需要加的过滤 | 当前 D1 的行为 |
|------|-------------|--------------|
| `GET /products` | `status = 'active'` | 返回全部 |
| `GET /products/category-counts` | 计数只算 active | 计数含全部 |
| `GET /products/sales-top/:size` | `status = 'active'` | 返回全部 |
| `GET /products/:id/related` `bought-together` `complete-the-look` | `status = 'active'` | 返回全部 |
| `POST /search` + facets | `status = 'active'` | 返回全部 |
| `GET /merchants/:id/profile` featuredProducts | `status = 'active'` | 返回全部 |
| `GET /merchants/:id/products` | `status = 'active'` | 返回全部 |
| `GET /merchant/products` | 按 `?status=` 真正过滤 | active 返回全部，draft/archived 返回空集 |
| `GET /admin/products` | 按 `?status=` 真正过滤 | 同上 |
| `DELETE /admin/products/:id/ban` | 改 `status='banned'`（**不再**动 stock） | 仍 `setStock(0)` |
| `POST /admin/products/:id/unban`（**新增端点**） | 改回 `status='active'`，**不恢复 stock**（stock 本就没被动过） | 不存在 |

> ⚠️ 语义提醒：`ban` 不应再把 `stock` 清零。当前清零会**永久丢失真实库存**，
> 且与「售罄」不可区分。改成只翻 `status` 后，库存回补逻辑不受影响。

### 1.4 索引

- `product(status, shop_id)` —— 商家端与管理端列表都按 `shop_id + status` 过滤
- 若 `product.shop_id` 尚无索引，一并补（见 `sql/migrations/V4__constraints_and_indexes.sql` 的现状核对）

---

## 2. P0 · `shipping_address.is_default` —— 「设为默认」无处落库

### 2.1 问题

`PUT /addresses/:id/{id}/default`（`StorefrontAddressController`）是一个**静默 no-op**：
接收请求 → 什么都不做 → 返回 200。前端 `setDefaultAddress()` 因此永远「成功」，
但刷新后默认地址纹丝不动。

`shipping_address` 表只有 `id/name/tel/address/user_id/username/create_time`，**没有默认标记列**。

### 2.2 需要的列

```sql
ALTER TABLE shipping_address ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0;
```

### 2.3 约束需求（重要）

- **一个用户至多一个默认地址**。MySQL 没有 partial unique index，建议：
  - 应用层用事务保证（`UPDATE shipping_address SET is_default=0 WHERE user_id=?` 之后
    `UPDATE ... SET is_default=1 WHERE id=? AND user_id=?`）
  - 或加生成列 `default_flag = IF(is_default=1, user_id, NULL)` + `UNIQUE(default_flag)`
    （MySQL 唯一索引忽略 NULL，天然满足「每用户至多一条」）
- 需要索引：`shipping_address(user_id, is_default)`

### 2.4 连带影响

- `GET /addresses` 的响应要能带出 `isDefault`（前端 `Address` 接口已有该字段）
- `POST /addresses` / `PUT /addresses/:id` 收到 `isDefault: true` 时也要应用同样的规则
  （前端 mock 分支已经这么做了，真实分支目前完全不处理）

---

## 3. P1 · 订单发货快递单号 —— DTO 缺字段（**非表，无需 database 参与**）

> **v2 勘误（2026-09-27，database 核对）**：
> `product_order.tracking_number` **列早已存在**，缺的只是 DTO 入参。
> 这条**不需要 database 动手**，是纯 DTO + 校验改动，已归入 TASK-000-D2 的 backend 工作量。
> 原文把它列为「需要 database 配合」是错的。

### 3.1 问题

`PUT /merchant/orders/:id/status` 的 `shipped` 分支当前是：

```java
case "shipped" -> {
    order.setStatus("待收货");
    order.setTrackingNumber("");   // ← 置空串
}
```

REQ 3.7 要求商家发货时**填写快递单号**。`product_order.tracking_number` 列**已经存在**，
缺的是入参：`MerchantOrderStatusDTO` 只有 `status` 一个字段。

D1 已做的最小修复：**不再擦除已有单号**（原值非 null 时保留）。
但真正的解法是让商家能写入单号。

### 3.2 需要加的字段

```java
// dto/MerchantOrderStatusDTO.java
private String trackingNumber;   // 仅 status=shipped 时有意义
```

配套规则（建议，由 D2 实现）：

- `status=shipped` 且未带 `trackingNumber` → 400「发货必须填写快递单号」
- 长度上限（如 64），超长 400
- 只更新 `tracking_number` 这一列，**不覆盖** `status` 之外的任何字段

> 这条**不需要 database 动手**，是纯 DTO + 校验改动。我按总控指示「DTO 若没有这个字段，
> 不要自己加」写在这里，等 D2 处理。

---

## 4. P1 · `product_order` 聚合索引 —— 看板会全表扫描

### 4.1 问题

D1 新增的看板聚合（`AnalyticsMapper`）全部打在 `product_order` 上：

| SQL | 条件 |
|-----|------|
| `sumPaidRevenue` | `status IN (...)` + 可选 `shop_id` + 可选 `create_time >= ?` |
| `countPaidOrders` | 同上 |
| `sumRevenueByDay` | 同上 + `GROUP BY DATE(create_time)` |
| `countDistinctOrderingUsers` | `create_time >= ?` + `COUNT(DISTINCT user_id)` |

`schema-h2.sql` 里 `product_order` **只有 `idx_order_no` 一个索引**。
数据量上来后，`sumRevenueByDay` 的 `DATE(create_time)` 分组必然走全表扫描。

### 4.2 需要的索引

```sql
-- 看板主路径:状态 + 时间窗
CREATE INDEX idx_order_status_time ON product_order (status, create_time);
-- 商家看板:店铺维度
CREATE INDEX idx_order_shop_status ON product_order (shop_id, status, create_time);
-- 活跃用户去重
CREATE INDEX idx_order_user_time ON product_order (user_id, create_time);
```

MySQL 8 的 `CREATE INDEX` **没有 `IF NOT EXISTS`**，脚本需写成 `information_schema` 先查后建，
或提供 rollback（见 `sql/migrations/rollback/` 的约定）。

---

## 5. P2 · `product_order_evaluate` 索引 —— 店铺评分聚合

店铺页的 `stats`（`avgRating` / `totalReviews` / `satisfactionRate`）现在走：

```sql
FROM product_order_evaluate
JOIN product ON product_order_evaluate.product_id = product.id
WHERE product.shop_id = ?
```

`product_order_evaluate.product_id` 若无索引，每次打开店铺页都要全表扫评价表。

需要：`CREATE INDEX idx_evaluate_product ON product_order_evaluate (product_id);`
（若 database 的审核列迁移里已含此索引，本条可省）

---

## 6. P3 · 搜索日志表（可选，纯新增）

D1 的 `/search/trending` 目前是**用销量近似热门词**：取 `product.sales_volume` 最高的商品名，
不足时用分类名补齐。这能填上「不再返回硬编码数组」这个缺口，但它回答不了
「用户到底在搜什么」。

要真实热门词需要一张搜索日志表（纯新增，无破坏性）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT AUTO_INCREMENT PK | |
| `keyword` | VARCHAR(128) NOT NULL | 归一化后的小写词 |
| `user_id` | INT NULL | 匿名搜索为 NULL |
| `result_count` | INT DEFAULT 0 | 命中数，0 结果的词也值得记 |
| `source` | VARCHAR(20) DEFAULT 'search' | search / suggestion |
| `create_time` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |

- 索引：`(keyword, create_time)` 供热门词聚合
- 保留策略：需要定期清理（如 90 天），否则无限增长
- **合规提醒**：这是用户行为数据，需纳入隐私政策告知范围

---

## 7. 我这轮**没有**提出、但你可能需要知道的既有事实

1. **`shop` 表已有 `fans_count`** —— 店铺页的 `followers` 现在直接读它，不需要新列。
   但**没有任何代码维护它**（`shop_collect` 逻辑随遗留控制器一起删了），
   所以它会长期是建表时的初值 0。这是「真实但不完整」，不是假数据。

2. **`product` 表没有 `rating` 列** —— 商品评分只存在于 `product_order_evaluate.rate`，
   且只挂 `product_id`。所以搜索分面的「4 星及以上」必须 JOIN 评价表去重统计。
   如果未来要做「商品评分排序」，建议在 `product` 上冗余一个 `avg_rating` 聚合列（写时更新）。

3. **`product_order` 是「一行一商品」的扁平表** —— 同一 `order_no` 会有多行。
   D1 的所有订单计数都是**订单行数**而非订单单数。
   如果看板要显示「订单数」（单数），需要 `COUNT(DISTINCT order_no)`，
   且**存量数据里 `order_no` 可能为空**（各自成组），需要 `COALESCE(order_no, CONCAT('legacy-', id))` 兜底。
   请 database 评估是否要为存量行回填 `order_no`。

4. **H2 测试库必须同步** —— 上述每一条 ALTER 都要同步进 `src/test/resources/schema-h2.sql`，
   否则 D2 的测试会报表不存在（`docs/DEVELOPMENT.md` 已明确警告）。
   H2 是 `MODE=MySQL`，`ADD COLUMN` / `CREATE INDEX` 语法与 MySQL 兼容，
   但 MySQL 8 特有的 `IF NOT EXISTS` 判断块不能照搬。

---

## 8. 三处同步的落地位置（database 侧 checklist）

每条变更都要落到这三个地方，缺一不可：

1. `sql/migrations/V6__*.sql` —— 正式库增量脚本（**不可重复执行**，需配 rollback）
2. `sql/migrations/rollback/V6__*.sql` —— 回滚脚本（**放 rollback/ 子目录**，
   否则 `entrypoint.sh` 的 glob 会在首次建库时把它当迁移执行）
3. `src/test/resources/schema-h2.sql` —— H2 测试库（用 `CREATE TABLE IF NOT EXISTS` /
   `CREATE INDEX IF NOT EXISTS` 形式，与 MySQL 迁移脚本分开写）
