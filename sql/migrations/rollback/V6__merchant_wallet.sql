-- ============================================================================
-- V6 回滚:删除商家钱包与钱包流水两张表
--
-- ⚠️ 位置说明:本文件刻意放在 sql/migrations/rollback/ 子目录,而**不是** sql/migrations/ 下。
--    因为 docker/entrypoint.sh 会 glob 导入 sql/migrations/*.sql(非递归),
--    放同级会被当成一个待应用的迁移自动执行,把刚建好的钱包表立刻删掉。
--
-- 用法:仅当 V6 需要回退时手工执行
--   mysql -uroot -p --default-character-set=utf8mb4 <db> < sql/migrations/rollback/V6__merchant_wallet.sql
--
-- ⚠️ **破坏性警告**:本脚本 DROP TABLE 会**永久删除已产生的全部钱包流水**
--   (merchant_wallet_transaction)与余额快照(merchant_wallet)。
--   在 Wallet 已被真实使用(有提现/结算记录)之后回滚 = 丢失资金流水,不可逆。
--   正确顺序:先备份
--     mysqldump --default-character-set=utf8mb4 -u<user> -p<pwd> <db> \
--       merchant_wallet merchant_wallet_transaction > wallet_backup.sql
--   再执行本脚本。
--
-- 注意:回滚只影响库结构。应用层(MerchantApiController 的 /merchant/wallet*
--       端点与对应 Service / Mapper / 实体)也必须一并回退,
--       否则接口会退回到 500(表不存在),而不是回退到「硬编码 $0」的历史行为。
--       删表是 DROP TABLE IF EXISTS,可重复执行。
-- ============================================================================

DROP TABLE IF EXISTS `merchant_wallet_transaction`;
DROP TABLE IF EXISTS `merchant_wallet`;

-- ─────────────────────────── 回滚后验证 ───────────────────────────
--   SELECT COUNT(*) FROM information_schema.TABLES
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'merchant_wallet%';
--     -- 应为 0