-- ============================================================================
-- V9 回滚:删除两条看板聚合时间索引
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚建好的索引立刻删掉。
--
-- 用法:仅当 V9 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 <db> < sql/migrations/rollback/V9__dashboard_aggregate_indexes.sql
--
-- 注意:删索引是**纯结构回退,不丢任何数据**,回滚后表内容与回滚前完全一致。
--       唯一后果是看板的时间窗口聚合退化为全表扫 + filesort,
--       数据量上来后会变慢(功能不受影响,只是慢)。
--       V4 建的 idx_status_create_time 不动 —— 它服务于 OrderTimeoutTask,
--       那是独立且**必须保留**的索引。
-- ============================================================================

ALTER TABLE `product_browsing_history` DROP INDEX `idx_create_time`;

ALTER TABLE `product_order` DROP INDEX `idx_create_time`;

-- ─────────────────────────── 回滚后验证 ───────────────────────────
--   SHOW INDEX FROM product_order;              -- 不应再有 idx_create_time
--   SHOW INDEX FROM product_browsing_history;   -- 不应再有 idx_create_time
--   -- 但两表的 idx_status_create_time / idx_user_id 必须仍在(那是 V4 建的)