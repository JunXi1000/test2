-- ============================================================================
-- V11 回滚:删除 product_order 的两条看板复合索引
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚建好的索引立刻删掉。
--
-- 用法:仅当 V11 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 <db> < sql/migrations/rollback/V11__order_dashboard_indexes.sql
--
-- 注意:删索引是**纯结构回退,不丢任何数据** —— 表内容与回滚前完全一致,
--       没有任何 DELETE / MODIFY / DROP COLUMN。
--       唯一后果是商家看板与活跃用户去重这两条聚合退化:
--         · 商家看板回到「先按 shop_id 取回全部订单行,再逐行过滤 status/create_time」
--         · COUNT(DISTINCT user_id) 回到全表扫 + 临时去重
--       功能与数据**完全不受影响**,只是变慢。
--
-- ⚠️ V4 建的 idx_user_id / idx_shop_id / idx_status_create_time 一律**不动** ——
--    本脚本只删 V11 自己加的两条。
-- ============================================================================

ALTER TABLE `product_order` DROP INDEX `idx_ord_user_time`;

ALTER TABLE `product_order` DROP INDEX `idx_ord_shop_status_time`;

-- ─────────────────────────── 回滚后验证 ───────────────────────────
--   SHOW INDEX FROM product_order;
--   -- 应回到 5 条:idx_order_no / idx_user_id / idx_shop_id
--   --             / idx_status_create_time / idx_create_time
--   -- 不应再有 idx_ord_shop_status_time 与 idx_ord_user_time