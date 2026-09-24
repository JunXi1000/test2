-- ============================================================================
-- V5: 金额字段全面改用 DECIMAL(10,2) —— 补齐 V2 漏掉的四列
--
-- 背景:V2__money_decimal.sql 只把 user.balance / product.price /
--   product_order.total_money 改成 DECIMAL(10,2),而下列四列仍是 DOUBLE:
--     coupon.value            折扣值(百分比或金额)
--     coupon.min_order        最低消费门槛
--     coupon.max_discount     最大优惠金额
--     return_request.refund_amount  退款金额
--   DOUBLE 存金额会在累加/取整时引入二进制浮点误差(应用层此前靠
--   Math.round(x*100)/100.0 掩盖,现已在 Java 侧改为 BigDecimal 精确运算)。
--
-- 执行前的数据风险核查(2026-09-24,对 template_v3 实测):
--   coupon.value / return_request.refund_amount 中**没有任何**行带超过 2 位小数,
--   return_request 表为空 —— 因此 DECIMAL(10,2) 的收窄**不会舍入任何现有值**。
--   换库执行前请重跑文件末尾的自检查询。
--
-- 应用方式:手工执行(同 V4,见 docs/DEVELOPMENT.md「数据库 schema 维护约定」)。
-- 幂等性:MODIFY COLUMN 可重复执行,重复运行结果一致。
-- ============================================================================

-- 可空性与默认值严格保持原样(实测:均 nullable,max_discount 无默认值,其余默认 0)

ALTER TABLE coupon
  MODIFY COLUMN `value` DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '折扣值(百分比或金额)';

ALTER TABLE coupon
  MODIFY COLUMN min_order DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '最低消费门槛';

ALTER TABLE coupon
  MODIFY COLUMN max_discount DECIMAL(10,2) NULL DEFAULT NULL COMMENT '最大优惠金额';

ALTER TABLE return_request
  MODIFY COLUMN refund_amount DECIMAL(10,2) NULL DEFAULT 0.00 COMMENT '退款金额';

-- ─────────────────────────── 执行前自检(建议先跑) ───────────────────────────
-- 若以下任一查询返回非 0,说明有会被舍入的值,先与业务确认再执行:
--
--   SELECT COUNT(*) AS rows_needing_rounding FROM coupon
--     WHERE `value` <> ROUND(`value`, 2) OR min_order <> ROUND(min_order, 2)
--        OR (max_discount IS NOT NULL AND max_discount <> ROUND(max_discount, 2));
--   SELECT COUNT(*) AS rows_needing_rounding FROM return_request
--     WHERE refund_amount <> ROUND(refund_amount, 2);

-- ─────────────────────────── 执行后验证 ───────────────────────────
--   SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND ((TABLE_NAME='coupon' AND COLUMN_NAME IN ('value','min_order','max_discount'))
--        OR (TABLE_NAME='return_request' AND COLUMN_NAME='refund_amount'));
--   -- 四行的 COLUMN_TYPE 应均为 decimal(10,2)
-- 再跑一次应用闸门(mvn -B clean test)确认无回归。
--
-- ⚠️ 应用层必须同步:Java 侧这四列对应的类型已从 Double 改为 BigDecimal
--    (Coupon.value/minOrder/maxDiscount、ReturnRequest.refundAmount,
--     以及 CouponServiceImpl.applyByCode 的 BigDecimal 运算)。
--     只改库不改代码、或只改代码不改库,都会造成精度语义不一致。
