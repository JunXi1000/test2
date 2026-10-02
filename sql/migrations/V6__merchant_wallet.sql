-- ============================================================================
-- V6: 商家钱包(余额) + 钱包流水
-- 日期: 2026-09-28  (与 Phase 3「商家钱包真实化」配套 / 总控 TASK-000-C P0-1)
--
-- 目标端点(此前全部是硬编码 $0 / 空列表,见 MerchantApiController L185-197):
--   GET  /merchant/wallet              → merchant_wallet.balance / pending_amount / currency
--   GET  /merchant/wallet/transactions → merchant_wallet_transaction 分页
--   POST /merchant/wallet/withdraw     → 写 withdrawal 流水 + 扣减 balance
--
-- ── 设计依据 ──────────────────────────────────────────────────────────────
-- 1. 不建物理外键。仓库既有 23 张表**一个 FOREIGN KEY 都没有**(见 sql/schema.sql),
--    关联一律靠「列 + 索引 + 应用层校验」表达。此处沿用同一约定,理由:
--      · 关联基数已由 uk_shop_id(钱包) / uk_txn_no(流水) 唯一键表达,FK 不提供额外信息;
--      · 测试侧 H2 与 MockMvc 反复建表/清表,FK 会引入与业务无关的失败;
--      · 混用会让「本库是否真的一致」变得不可预测。
--    逻辑关联(应用层必须保证):
--      merchant_wallet.shop_id            → shop.id
--      merchant_wallet_transaction.wallet_id → merchant_wallet.id
--      merchant_wallet_transaction.shop_id   → shop.id(冗余列,便于按商家直接聚合,
--                                             省掉一次 join;由写入方保证与 wallet_id 一致)
--
-- 2. 金额一律 DECIMAL(14,2),**不用 FLOAT/DOUBLE**。
--    为什么是 (14,2) 而不是沿用单据级的 (10,2):
--      balance / total_income / total_withdraw 是**累计量**,不是单笔金额。
--      DECIMAL(10,2) 上限 99,999,999.99(约 1 亿),单个商家的累计收入超这一量级就会
--      在加法时溢出报错。amount / balance_before / balance_after 同宽,便于同列比较
--      (balance_after = balance_before ± amount 在同精度下不会出现 DECIMAL 截断)。
--
-- 3. 幂等(总控要求:同一笔提现重复提交不得重复扣款):
--    merchant_wallet_transaction.idempotency_key 上的唯一索引 uk_idempotency_key 是
--    幂等的落点。约定 **key = f(type, ref_type, ref_no)**(如 withdrawal:withdraw:W20260928001)。
--      · 首次提交插入成功并扣款;
--      · 重复提交撞 1062 → 应用层捕获 DuplicateKeyException,按 idempotency_key
--        查出原流水**原样返回**,余额不变、流水不新增。
--    该列 NULL 时不受唯一约束约束(MySQL 唯一索引允许多行 NULL),
--    所以只有显式带幂等键的写才受保护;纯余额变更(如调账)可留 NULL。
--    建议应用层对**所有**类型都构造幂等键,只有调账才允许 NULL。
--
-- 4. 流水 amount 恒为**正数**,收支方向由 direction(income/expense)表达。
--    不用带符号金额,是为了让 SUM/聚合不必按符号分支,也让「退款 0.00」这类
--    边界值仍然有明确方向。
--
--    ⚠️ **但后端出参必须转成带符号**,这是硬性契约,照做否则页面显示反了:
--      前端 web/src/pages/merchant/Wallet.vue
--        L115  :class="row.amount >= 0 ? 'text-emerald-600' : 'text-red-600'"
--        L120  {{ row.amount >= 0 ? '+' : '' }}${{ Math.abs(row.amount).toFixed(2) }}
--      即前端**完全依赖 amount 的正负号**判断收支与着色。
--      若直接返回库里的正数 amount,一笔提现会渲染成**绿色的「+$500.00」**而不是红色的「-$500.00」。
--      DTO 组装必须写成:
--        signedAmount = "income".equals(direction) ? amount : amount.negate()
--      本表的 type 与前端 WalletTransaction.type 严格对齐
--      (web/src/api/modules/merchantWallet.ts:12 的 'sale'|'withdrawal'|'refund'|'fee'),
--      type ↔ direction 映射见下方建表注释,一一对应不会出现自相矛盾的行。
--
-- 5. balance_before / balance_after 冗余存储:
--    对账时能直接看出「这笔为什么让余额变成这样」,也是测试 Agent 断言
--    「重复提现余额不变」的抓手。写入方必须在同一事务里
--    先 UPDATE merchant_wallet 再 INSERT 流水(且 UPDATE 带 balance >= amount 条件,
--    仿 ProductMapper.deductStock 的防超扣写法)。
--
-- ── 幂等性与执行方式 ──────────────────────────────────────────────────────
-- 本脚本可重复执行:CREATE TABLE IF NOT EXISTS + INSERT IGNORE 种子。
--   mysql --default-character-set=utf8mb4 -u<user> -p<pwd> <db> < sql/migrations/V6__merchant_wallet.sql
-- ⚠️ 表/列注释含中文,必须带 --default-character-set=utf8mb4,否则双重编码乱码。
-- 回滚:sql/migrations/rollback/V6__merchant_wallet.sql
-- ============================================================================

-- ─────────────────────────── 一、商家钱包 ───────────────────────────
CREATE TABLE IF NOT EXISTS `merchant_wallet` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `shop_id` INT NOT NULL COMMENT '商家id(merchant_wallet.shop_id → shop.id,逻辑外键)',
  `balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '可用余额(可提现)',
  `pending_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '待结算/冻结金额(尚不可提现)',
  `total_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '累计入账(只增不减,含已被提现部分)',
  `total_withdraw` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '累计提现(只增不减)',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'USD' COMMENT '币种(ISO 4217,前端 Wallet.currency)',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT NULL COMMENT '最后变更时间',
  PRIMARY KEY (`id`),
  -- 一个商家至多一个钱包:这是「1:1」的唯一性依据,同时兜住并发建钱包
  UNIQUE KEY `uk_wallet_shop_id` (`shop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家钱包';

-- ─────────────────────────── 二、钱包流水 ───────────────────────────
-- type 与前端契约严格对齐(web/src/api/modules/merchantWallet.ts):
--   sale       订单结算入账   direction=income
--   withdrawal 商家提现       direction=expense
--   refund     订单退款出账   direction=expense
--   fee        平台佣金/手续费 direction=expense
--   adjustment 人工调账       income / expense 皆可
CREATE TABLE IF NOT EXISTS `merchant_wallet_transaction` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `wallet_id` INT NOT NULL COMMENT '钱包id(→ merchant_wallet.id,逻辑外键)',
  `shop_id` INT NOT NULL COMMENT '商家id(冗余,便于按商家聚合;须与 wallet_id 对应一致)',
  `txn_no` VARCHAR(64) NOT NULL COMMENT '流水号(全局唯一,对外展示用)',
  `type` VARCHAR(20) NOT NULL DEFAULT 'adjustment' COMMENT '类型 sale/withdrawal/refund/fee/adjustment',
  `direction` VARCHAR(10) NOT NULL DEFAULT 'income' COMMENT '方向 income=入账 / expense=出账',
  `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '金额(恒为正;符号由 direction 表达)',
  `balance_before` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '变动前可用余额',
  `balance_after` DECIMAL(14,2) NOT NULL DEFAULT 0.00 COMMENT '变动后可用余额',
  `ref_type` VARCHAR(30) DEFAULT NULL COMMENT '关联单据类型 order/withdraw/manual',
  `ref_no` VARCHAR(64) DEFAULT NULL COMMENT '关联单据号(如 product_order.order_no)',
  `status` VARCHAR(20) NOT NULL DEFAULT 'completed' COMMENT '状态 completed/pending/failed(对齐前端)',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '描述(前端展示用)',
  `idempotency_key` VARCHAR(128) DEFAULT NULL COMMENT '幂等键=type:ref_type:ref_no;唯一索引防重复扣款',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
  `update_time` DATETIME DEFAULT NULL COMMENT '最后变更时间(pending→completed/failed 时回写)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_txn_no` (`txn_no`),
  UNIQUE KEY `uk_idempotency_key` (`idempotency_key`),
  -- 索引依据(GET /merchant/wallet/transactions 的真实查询形状):
  --   ① 按商家 + 时间倒序分页   → idx_wtxn_shop_time
  --   ② 对账:按钱包取全部流水   → idx_wtxn_wallet_time
  --   ③ 按单据反查(退款幂等)   → idx_wtxn_ref
  --   ④ 后台筛 pending 提现     → idx_wtxn_status
  KEY `idx_wtxn_shop_time` (`shop_id`, `create_time`),
  KEY `idx_wtxn_wallet_time` (`wallet_id`, `create_time`),
  KEY `idx_wtxn_ref` (`ref_type`, `ref_no`),
  KEY `idx_wtxn_status` (`status`, `create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家钱包流水';

-- ─────────────────────────── 三、种子:为存量商家补钱包 ──────────────
-- INSERT IGNORE 依赖 uk_wallet_shop_id,重复执行不会重复插入。
-- 存量 shop 的订单金额**不回填**为余额 —— 那属于历史对账口径,需与业务确认后再补;
-- 本次只保证「每个商家都有钱包行」,余额从 0.00 起由流水累加。
INSERT IGNORE INTO `merchant_wallet`
  (`shop_id`, `balance`, `pending_amount`, `total_income`, `total_withdraw`, `currency`)
SELECT `id`, 0.00, 0.00, 0.00, 0.00, 'USD' FROM `shop`;

-- ─────────────────────────── 四、执行后验证 ───────────────────────────
--   SELECT TABLE_NAME FROM information_schema.TABLES
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'merchant_wallet%';
--     -- 应有 merchant_wallet / merchant_wallet_transaction 两行
--   SELECT w.shop_id, w.balance, w.pending_amount
--     FROM merchant_wallet w ORDER BY w.shop_id;
--     -- 每个 shop.id 恰好一行,余额全为 0.00
--   SELECT wallet_id, COUNT(*) FROM merchant_wallet_transaction GROUP BY wallet_id;
--     -- 空表,0 行
-- 再跑一次应用闸门(mvn -B clean test)确认无回归。