-- ============================================================================
-- V3 回滚:删除 product_order.order_no 与 payment 表
--
-- ⚠️ 位置说明:同 V4/V5,刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把 Phase 2 的主链路结构立刻删掉。
--
-- 用法:仅当 V3 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 template_v3 < sql/migrations/rollback/V3__phase2_order_payment.sql
--
-- ⚠️⚠️ 回滚顺序:必须按 V5 → V4 → V3 → V2 倒序。
--    先回滚 V3 会出问题:V4 在 payment 上建了 idx_user_id / idx_status,
--    而 DROP TABLE payment 会把这两个索引一起带走,使 V4 变成「半应用」状态。
--
-- ⚠️ 本回滚**会丢数据**,执行前必须确认:
--     1. payment 整张表被删,支付记录全部消失。order_no 是**订单与支付的唯一关联**,
--        删掉后已支付订单再也无法核对收款。
--     2. product_order.order_no 承载 Phase 2 的「一次结算 = 一个 order_no 分组」。
--        删列后订单无法再按批次分组(前端订单列表 / 商家后台 / 管理端订单都依赖它),
--        且每行只剩 id,原分组关系无法还原。
--     执行前请先跑:
--       SELECT COUNT(*) FROM payment;
--       SELECT COUNT(*) FROM product_order WHERE order_no IS NOT NULL;
--     任一非 0 就先导出,再决定是否继续。
--
-- ⚠️ 回滚必须同时回滚应用层:Payment 实体 / PaymentMapper / PaymentServiceImpl、
--    OrderTimeoutTask(按 order_no 推进状态)、ProductOrderServiceImpl 的分组查询
--    均依赖这两处结构。只回滚本脚本会让后端启动或运行时报错。
--
-- 幂等性:**不可重复执行**。MySQL 没有 DROP INDEX IF EXISTS,
--    重复执行会在 DROP INDEX / DROP COLUMN 上报 1091(索引或列不存在)。
-- ============================================================================

-- 一、删支付表(连带 uk_order_no、idx_user_id、idx_status)
DROP TABLE IF EXISTS `payment`;

-- 二、撤销 order_no 的索引与列(按 V3 建立时的反序)
ALTER TABLE product_order DROP INDEX idx_order_no;
ALTER TABLE product_order DROP COLUMN order_no;
