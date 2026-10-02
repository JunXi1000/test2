-- ============================================================================
-- V7: 设置持久化 —— admin 全局设置 + merchant 店铺设置
-- 日期: 2026-09-28  (与 Phase 3「设置真实化」配套 / 总控 TASK-000-C P0-2)
--
-- 目标端点(此前 GET 硬编码、PUT 是 no-op 仍返回 200,见 AdminApiController L327-342
-- 与 MerchantApiController L209-232):
--   GET/PUT /admin/settings     → admin_setting(单行表)
--   GET/PUT /merchant/settings  → merchant_setting(每店一行)+ shop 已有列
--
-- ── 决策:强字段结构,不是 KV(key-value)通用表 ───────────────────────────
-- 已与总控确认并获批。这里把理由写死,避免将来有人以「更灵活」为由改回 KV:
--   1. **字段集合已被前端契约钉死**,不是开放集合:
--        admin    : siteName / maintenanceMode / allowRegistrations / commissionRate
--        merchant : storeName / description / logo / email(这 4 个复用 shop 已有列)
--                    + location / responseTime / policies{shipping,returns}
--                    + notifications{email,push,sms}
--      web/src/api/modules/adminSettings.ts、merchantSettings.ts 按这些字段名取值,
--      改成 KV 后每个字段都要在应用层做一次「取字符串 → 转 bool/number → 兜默认值」,
--      **收益为零,却把编译期类型检查换成运行期转换**。
--   2. **嵌套结构本来就得拆列**:policies/notifications 是对象,KV 也要拆成
--      `policies.shipping` 这类扁平键,并不比拆列更省事,反而丢了类型。
--   3. **默认值无处安放**:强字段可以写 DEFAULT '',0,1;KV 表必须每行自带 value,
--      新增字段时容易出现「键不存在」的半初始化状态。
--   4. 商城的「设置」天然是低基数、强约束的运营参数,不是用户自定义配置。
--   反过来说,KV 唯一合适的场景是「插件式、运营可自增的任意配置」,本项目没有这个需求。
--
-- ── 其他设计依据 ──────────────────────────────────────────────────────────
-- · 不建物理外键(与全库既有约定一致,理由同 V6 注释)。
-- · admin_setting 用 `singleton TINYINT` + 唯一键表达「单行表」:
--   比「约定只插一行」可靠(应用层写错也不会产生第二行),又不需要
--   MySQL 无 CHECK 约束 / H2 语义不同的 CHECK(id=1)。
--   读法固定:SELECT ... WHERE singleton = 1。
-- · merchant_setting 与 shop 是 1:1,由 uk_shop_id 表达。
-- · commission_rate 用 DECIMAL(7,4) 而非 (10,2):
--   前端现有硬编码值是 5.0(百分数),但比例制写法 0.05 也可能出现,
--   (7,4) 两种都能精确存下;(10,2) 会把 0.05 舍成 0.05 之外的值。
--   本表**没有**金额参与乘除,只是费率,故不套 (14,2)。
-- · shop 已有列(名称/简介/头像/邮箱)不做迁移、不做冗余复制,
--   GET /merchant/settings 由应用层合并「shop 行 + merchant_setting 行」返回。
--   理由:这 4 个值在别处(商家列表、商品卡片)也在用,复制成第二份必然漂移。
--
-- ── 幂等性与执行方式 ──────────────────────────────────────────────────────
-- 本脚本可重复执行:CREATE TABLE IF NOT EXISTS + INSERT IGNORE 种子。
--   mysql --default-character-set=utf8mb4 -u<user> -p<pwd> <db> < sql/migrations/V7__platform_settings.sql
-- ⚠️ 表/列注释含中文,必须带 --default-character-set=utf8mb4。
-- 回滚:sql/migrations/rollback/V7__platform_settings.sql
-- ============================================================================

-- ─────────────────────────── 一、admin 全局设置(单行) ─────────────────
-- 字段默认值刻意与 AdminApiController.getSettings() 现在的硬编码返回**逐字一致**
-- (siteName="Nexus Market" / maintenanceMode=false / allowRegistrations=true /
--  commissionRate=5.0),这样迁移一落地,接口返回值不变,不存在「迁移引入行为变化」。
CREATE TABLE IF NOT EXISTS `admin_setting` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `singleton` TINYINT NOT NULL DEFAULT 1 COMMENT '单行表标记,恒为 1;唯一键保证全表仅一行',
  `site_name` VARCHAR(255) NOT NULL DEFAULT 'Nexus Market' COMMENT '站点名称(前端 siteName)',
  `maintenance_mode` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '维护模式 0=关闭 / 1=开启(前端 maintenanceMode)',
  `allow_registrations` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否允许新用户注册 0/1(前端 allowRegistrations)',
  `commission_rate` DECIMAL(7,4) NOT NULL DEFAULT 5.0000 COMMENT '平台佣金率;5.0000 表示 5%(前端 commissionRate)',
  `contact_email` VARCHAR(255) DEFAULT NULL COMMENT '站点联系邮箱',
  `update_by` INT DEFAULT NULL COMMENT '最后修改的管理员id(admin.id)',
  `update_time` DATETIME DEFAULT NULL COMMENT '最后修改时间',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_singleton` (`singleton`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='平台全局设置(单行表)';

-- ─────────────────────────── 二、merchant 店铺设置(每店一行) ───────────
-- 只存「shop 表里没有」的那几个字段;storeName/description/logo/email 复用 shop 列。
CREATE TABLE IF NOT EXISTS `merchant_setting` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `shop_id` INT NOT NULL COMMENT '商家id(merchant_setting.shop_id → shop.id,逻辑外键)',
  `location` VARCHAR(255) DEFAULT NULL COMMENT '店铺所在地(前端 settings.location)',
  `response_time` VARCHAR(64) DEFAULT NULL COMMENT '响应时效文案(前端 settings.responseTime)',
  `shipping_policy` TEXT COMMENT '配送政策(前端 settings.policies.shipping)',
  `return_policy` TEXT COMMENT '退货政策(前端 settings.policies.returns)',
  `notify_email` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '邮件通知开关(前端 settings.notifications.email)',
  `notify_push` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '站内推送开关(前端 settings.notifications.push)',
  `notify_sms` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '短信通知开关(前端 settings.notifications.sms)',
  `create_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT NULL COMMENT '最后修改时间',
  PRIMARY KEY (`id`),
  -- 一个商家至多一份设置:1:1 的唯一性依据,同时兜住并发建设置行
  UNIQUE KEY `uk_merchant_setting_shop_id` (`shop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家店铺设置(每店一行)';

-- ─────────────────────────── 三、种子 ────────────────────────────────
-- ① admin 全局设置:值与旧硬编码一致,保证迁移不改变接口行为。
--    INSERT IGNORE 依赖 uk_singleton,可重复执行。
INSERT IGNORE INTO `admin_setting`
  (`id`, `singleton`, `site_name`, `maintenance_mode`, `allow_registrations`, `commission_rate`, `contact_email`)
VALUES
  (1, 1, 'Nexus Market', 0, 1, 5.0000, '123456@javadh.com');

-- ② 为存量商家补设置行:字段留默认(NULL/0/1),由商家在页面上自行填写。
--    INSERT IGNORE 依赖 uk_merchant_setting_shop_id,可重复执行。
INSERT IGNORE INTO `merchant_setting` (`shop_id`) SELECT `id` FROM `shop`;

-- ─────────────────────────── 四、执行后验证 ───────────────────────────
--   SELECT site_name, maintenance_mode, allow_registrations, commission_rate
--     FROM admin_setting WHERE singleton = 1;
--     -- 恰好 1 行:Nexus Market / 0 / 1 / 5.0000
--   SELECT COUNT(*) AS admin_setting_rows FROM admin_setting;      -- 应为 1
--   SELECT COUNT(*) AS merchant_setting_rows FROM merchant_setting; -- 应等于 shop 行数
--   SELECT s.id, COUNT(ms.id) FROM shop s
--     LEFT JOIN merchant_setting ms ON ms.shop_id = s.id
--    GROUP BY s.id HAVING COUNT(ms.id) <> 1;                          -- 应返回 0 行
-- 再跑一次应用闸门(mvn -B clean test)确认无回归。