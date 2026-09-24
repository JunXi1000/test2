-- ============================================================================
-- V5 回滚:把四列金额类型改回 DOUBLE
--
-- ⚠️ 位置说明:同 V4,刻意放在 sql/migrations/rollback/ 子目录,
--    避免被 docker/entrypoint.sh 的 sql/migrations/*.sql glob 当成迁移自动执行。
--
-- ⚠️ 回滚必须同时回滚应用层:Java 侧这四列的类型已改为 BigDecimal,
--    若只把库改回 DOUBLE 而代码仍是 BigDecimal,MyBatis 仍能映射,但**精度保障丢失**。
--    正确做法是连同 Coupon / ReturnRequest 实体与 CouponServiceImpl 的改动一起回退。
--
-- 注意:DECIMAL(10,2) → DOUBLE 对已存的两-位小数值是无损的(如 10.00 可精确表示),
--       但此后重新写入的金额会重新暴露浮点误差风险。
-- ============================================================================

ALTER TABLE coupon
  MODIFY COLUMN `value` DOUBLE NULL DEFAULT 0 COMMENT '折扣值(百分比或金额)';

ALTER TABLE coupon
  MODIFY COLUMN min_order DOUBLE NULL DEFAULT 0 COMMENT '最低消费门槛';

ALTER TABLE coupon
  MODIFY COLUMN max_discount DOUBLE NULL DEFAULT NULL COMMENT '最大优惠金额';

ALTER TABLE return_request
  MODIFY COLUMN refund_amount DOUBLE NULL DEFAULT 0 COMMENT '退款金额';
