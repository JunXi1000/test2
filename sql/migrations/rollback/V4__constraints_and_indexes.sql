-- ============================================================================
-- V4 回滚:删除 V4 建立的唯一约束与索引
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚建好的约束立刻删掉。
--
-- 用法:仅当 V4 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 template_v3 < sql/migrations/rollback/V4__constraints_and_indexes.sql
--
-- 注意:删索引/唯一键是**纯结构回退**,不丢数据。但回退后「先查后插」的并发重复行风险会回归,
--       所以回退应同时回退对应的应用层改动(Phase 2c 之后不应单独回退本脚本)。
-- ============================================================================

-- 一、撤销唯一约束
ALTER TABLE shopping_cart   DROP INDEX uk_user_product;
ALTER TABLE product_collect DROP INDEX uk_user_product;
ALTER TABLE shop_collect    DROP INDEX uk_user_shop;
ALTER TABLE user            DROP INDEX uk_username;
ALTER TABLE shop            DROP INDEX uk_username;
ALTER TABLE admin           DROP INDEX uk_username;

-- 二、撤销索引
ALTER TABLE product_order DROP INDEX idx_user_id;
ALTER TABLE product_order DROP INDEX idx_shop_id;
ALTER TABLE product_order DROP INDEX idx_status_create_time;

ALTER TABLE product DROP INDEX idx_shop_id;
ALTER TABLE product DROP INDEX idx_product_type_id;

ALTER TABLE payment DROP INDEX idx_user_id;
ALTER TABLE payment DROP INDEX idx_status;

ALTER TABLE product_browsing_history DROP INDEX idx_user_id;
ALTER TABLE product_browsing_history DROP INDEX idx_product_id;

ALTER TABLE product_order_evaluate DROP INDEX idx_user_id;
ALTER TABLE product_order_evaluate DROP INDEX idx_product_id;
ALTER TABLE product_order_evaluate DROP INDEX idx_product_order_id;

ALTER TABLE coupon DROP INDEX idx_status;
