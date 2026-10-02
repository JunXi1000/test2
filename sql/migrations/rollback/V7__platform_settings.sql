-- ============================================================================
-- V7 回滚:删除平台设置与商家设置两张表
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚建好的设置表立刻删掉。
--
-- 用法:仅当 V7 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 <db> < sql/migrations/rollback/V7__platform_settings.sql
--
-- ⚠️ **破坏性警告**:DROP TABLE 会**永久丢失管理员在后台改过的设置值**
--   (admin_setting 的站点名/维护模式/注册开关/佣金率,merchant_setting 的店铺资料)。
--   这些是运营手输的数据,不可从其他表重算。回滚前先备份:
--     mysqldump --default-character-set=utf8mb4 -u<user> -p<pwd> <db> \
--       admin_setting merchant_setting > settings_backup.sql
--
-- 注意:merchant_setting 里**不含** storeName/description/logo/email ——
--       那 4 个值存在 shop 表,本脚本不动 shop,故不会波及商家主页与商品卡片。
--
-- 注意:回滚只影响库结构。应用层(GET/PUT /admin/settings 与 /merchant/settings
--       的 Service / Mapper / 实体)也必须一并回退,否则接口会退回到 500(表不存在)。
--       删表是 DROP TABLE IF EXISTS,可重复执行。
-- ============================================================================

DROP TABLE IF EXISTS `merchant_setting`;
DROP TABLE IF EXISTS `admin_setting`;

-- ─────────────────────────── 回滚后验证 ───────────────────────────
--   SELECT COUNT(*) FROM information_schema.TABLES
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('admin_setting','merchant_setting');
--     -- 应为 0
--   SELECT COUNT(*) FROM shop;   -- shop 表不受影响,行数应与回滚前一致