-- ============================================================================
-- V2 回滚:把三列金额类型改回 DOUBLE
--
-- ⚠️ 位置说明:同 V4/V5,刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚转好的金额类型立刻改回去。
--
-- 用法:仅当 V2 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 template_v3 < sql/migrations/rollback/V2__money_decimal.sql
--
-- ⚠️ 这里的 DOUBLE 是**迁移前的真实定义**,取自 git 历史里 V2 引入提交的父提交
--    (c528a5a^:docker/mysql/init/01-schema.sql):
--      `balance` DOUBLE DEFAULT 0 / `price` DOUBLE DEFAULT 0 / `total_money` DOUBLE DEFAULT 0
--    注意**不能参照 sql/schema.sql** —— 那份文件建立于 V2 之后,里面已经是 DECIMAL(10,2),
--    照它写会得到一个「回滚到自己」的空操作。
--
-- ⚠️ 回滚必须同时回滚应用层:Java 侧这三列已改为 BigDecimal,
--    若只把库改回 DOUBLE 而代码仍是 BigDecimal,MyBatis 仍能映射,但**精度保障丢失**。
--
-- 注意:DECIMAL(10,2) → DOUBLE 对已存的两位小数值是无损的(如 10.00 可精确表示),
--       但此后重新写入的金额会重新暴露浮点误差风险 —— 那正是 V2 要修的问题。
--
-- 幂等性:MODIFY COLUMN 可重复执行,重复运行结果一致。
-- ============================================================================

-- 原始定义不含 COMMENT;这里保留 COMMENT,与 rollback/V5 的处理一致 ——
-- 回滚的是类型(有语义的那部分),注释属有用信息,不回退。
ALTER TABLE `user`
  MODIFY COLUMN `balance` DOUBLE DEFAULT 0 COMMENT '余额';

ALTER TABLE `product`
  MODIFY COLUMN `price` DOUBLE DEFAULT 0 COMMENT '价格';

ALTER TABLE `product_order`
  MODIFY COLUMN `total_money` DOUBLE DEFAULT 0 COMMENT '总金额';
