-- ============================================================================
-- V8 回滚:移除 product_order_evaluate 的四个审核列
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚加的审核列立刻删掉。
--
-- 用法:仅当 V8 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 <db> < sql/migrations/rollback/V8__review_moderation.sql
--
-- ⚠️ **破坏性警告**:DROP COLUMN 会**永久丢失所有审核记录**
--   (谁在什么时候隐藏了哪条评价、备注写了什么)。
--   评价正文与评分(rate/content 等)不受影响,只是「审核状态」这一层信息消失。
--   若已有真实审核操作,回滚前先备份:
--     mysqldump --default-character-set=utf8mb4 -u<user> -p<pwd> <db> \
--       product_order_evaluate > evaluate_backup.sql
--
-- ⚠️ 本脚本是**破坏性变更**(删列),只允许由人工在明确知情下执行,
--    不得由任何自动化流程触发。删列后表结构回到 V7 之后的状态。
--
-- 注意:回滚只影响库结构。应用层(ProductOrderEvaluate 实体的四个新字段、
--       PUT /admin/reviews/{id} 的落库逻辑)也必须一并回退,
--       否则 MyBatis 会在 SELECT * 映射时因「实体有字段、结果集无该列」而报错。
-- ============================================================================

ALTER TABLE `product_order_evaluate` DROP INDEX `idx_review_status_time`;

ALTER TABLE `product_order_evaluate`
  DROP COLUMN `review_remark`,
  DROP COLUMN `review_time`,
  DROP COLUMN `reviewer_id`,
  DROP COLUMN `review_status`;

-- ─────────────────────────── 回滚后验证 ───────────────────────────
--   SHOW COLUMNS FROM product_order_evaluate LIKE 'review%';
--     -- 应返回 0 行
--   SELECT COUNT(*) FROM product_order_evaluate;  -- 评价总行数应与回滚前一致(正文未丢)