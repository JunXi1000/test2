-- ============================================================================
-- V10 回滚:移除 product.status / shipping_address.is_default 与四个索引
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚加的列立刻删掉。
--
-- 用法:仅当 V10 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 <db> < sql/migrations/rollback/V10__product_status_and_default_address.sql
--
-- ⚠️ **破坏性警告** —— 本脚本执行 DROP COLUMN,是**不可逆的信息丢失**:
--   1. product.status 丢失 ⇒ 所有「哪些商品是 draft / archived / banned」的记录消失。
--      后果不只是列没了:商家已经手动下架的商品会**立刻重新对买家可见**
--      (因为列表回到「无过滤」状态),而后台再也无法把它们隐藏回去。
--      回滚前务必先备份当前状态值:
--        SELECT id, name, status FROM product WHERE status <> 'active';
--      并把结果留在工单里;必要时可据此手工重建。
--   2. shipping_address.is_default 丢失 ⇒ 用户设过的默认地址退回「无默认」,
--      结算页重新要求用户手选。**不丢地址本身**,只是丢「哪条是默认」这个标记。
--
-- 执行前请确认:
--   · 已备份 product 中 status <> 'active' 的行(上面那条 SELECT)
--   · 应用层(Product.status / ShippingAddress.isDefault 两个实体字段、
--     以及 ProductMapper.xml 里按 status 的过滤条件)也一并回退
--
-- 顺序说明:先 DROP INDEX 再 DROP COLUMN。
--   MySQL 允许先删列再删索引,但那样在部分 8.0 小版本上会留下悬空索引,
--   先删索引可保证任何中断点都不处于「索引指向已不存在列」的中间态。
-- ============================================================================

-- 一、先删索引
ALTER TABLE `shipping_address` DROP INDEX `idx_user_default`;

ALTER TABLE `product` DROP INDEX `idx_status_id`;
ALTER TABLE `product` DROP INDEX `idx_shop_status`;

-- 二、再删列
ALTER TABLE `shipping_address` DROP COLUMN `is_default`;

ALTER TABLE `product` DROP COLUMN `status`;

-- ─────────────────────────── 回滚后验证 ───────────────────────────
--   SHOW COLUMNS FROM product LIKE 'status';              -- 应返回 0 行
--   SHOW COLUMNS FROM shipping_address LIKE 'is_default'; -- 应返回 0 行
--   SHOW INDEX FROM product;            -- 不应再有 idx_shop_status / idx_status_id
--   SHOW INDEX FROM shipping_address;   -- 不应再有 idx_user_default
--   -- V4 建的 idx_shop_id / idx_product_type_id 必须仍在
--   SELECT COUNT(*) FROM product;                -- 商品行数不变(只是列没了)
--   SELECT COUNT(*) FROM shipping_address;       -- 地址行数不变(只是列没了)