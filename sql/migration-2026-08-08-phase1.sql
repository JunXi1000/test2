-- ============================================================
-- Phase 1 增量迁移(对已初始化过的数据库补表)
-- 适用场景: Docker 容器已用旧版 01-schema.sql 初始化过, 无需 docker compose down -v 重灌。
-- 用法(在 mysql 容器内执行, 例如):
--   docker compose exec mysql mysql -uroot -p商城 root 密码 --default-character-set=utf8mb4 platform < sql/migration-2026-08-08-phase1.sql
-- 注意: 本文件含中文种子, 必须加 --default-character-set=utf8mb4, 否则中文会被双重编码成乱码
--       (mysql CLI 客户端默认 latin1, 会把 UTF-8 字节当 latin1 字符读入后再次编码入库)。
-- 幂等性: CREATE TABLE IF NOT EXISTS 可安全重复执行; 优惠券种子用 INSERT IGNORE(coupon.code 唯一);
--         通知种子自带 DELETE 守卫(按标题前缀清理后重插), 可安全重复执行。
-- 全新初始化的库请直接使用 docker/mysql/init/01-schema.sql(已包含本文件全部内容)。
-- ============================================================

-- 用户通知偏好
CREATE TABLE IF NOT EXISTS `user_notification_pref` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` INT NOT NULL COMMENT '用户id',
  `email_order` TINYINT(1) DEFAULT 1 COMMENT '订单邮件通知',
  `email_promo` TINYINT(1) DEFAULT 0 COMMENT '促销邮件通知',
  `sms_order` TINYINT(1) DEFAULT 1 COMMENT '短信通知',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 优惠券(平台统一券池)
CREATE TABLE IF NOT EXISTS `coupon` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `code` VARCHAR(64) NOT NULL COMMENT '优惠码',
  `title` VARCHAR(255) COMMENT '标题',
  `description` VARCHAR(500) COMMENT '描述',
  `type` VARCHAR(20) DEFAULT 'percent' COMMENT '类型 percent/fixed/shipping',
  `value` DOUBLE DEFAULT 0 COMMENT '折扣值(百分比或金额)',
  `min_order` DOUBLE DEFAULT 0 COMMENT '最低消费门槛',
  `max_discount` DOUBLE COMMENT '最大优惠金额',
  `category` VARCHAR(64) COMMENT '适用品类',
  `expires_at` DATETIME COMMENT '有效期',
  `total` INT DEFAULT 1000 COMMENT '发行总量',
  `claimed` INT DEFAULT 0 COMMENT '已领取数量',
  `status` VARCHAR(20) DEFAULT 'enabled' COMMENT '状态 enabled/disabled',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户已领取的优惠券
CREATE TABLE IF NOT EXISTS `user_coupon` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` INT NOT NULL COMMENT '用户id',
  `coupon_id` INT NOT NULL COMMENT '优惠券id',
  `status` VARCHAR(20) DEFAULT 'unused' COMMENT '状态 unused/used',
  `claimed_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '领取时间',
  `used_time` DATETIME COMMENT '使用时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_coupon` (`user_id`, `coupon_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 退换货申请
CREATE TABLE IF NOT EXISTS `return_request` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` INT NOT NULL COMMENT '用户id',
  `order_id` VARCHAR(64) COMMENT '订单号',
  `product_title` VARCHAR(255) COMMENT '商品名称',
  `product_image` VARCHAR(500) COMMENT '商品图片',
  `reason` VARCHAR(255) COMMENT '退货原因',
  `detail` TEXT COMMENT '详情',
  `refund_amount` DOUBLE DEFAULT 0 COMMENT '退款金额',
  `status` VARCHAR(20) DEFAULT 'pending' COMMENT '状态 pending/approved/rejected/refunded',
  `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_time` DATETIME COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 到货订阅
CREATE TABLE IF NOT EXISTS `stock_alert` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` INT NOT NULL COMMENT '用户id',
  `product_id` INT NOT NULL COMMENT '商品id',
  `product_title` VARCHAR(255) COMMENT '商品名称',
  `product_image` VARCHAR(500) COMMENT '商品图片',
  `email` VARCHAR(255) COMMENT '通知邮箱',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT '状态 active/notified',
  `created_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_product` (`user_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统通知(按角色广播或定向投递)
CREATE TABLE IF NOT EXISTS `notification` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` INT DEFAULT 0 COMMENT '目标用户id, 0=广播给该角色全部',
  `role` VARCHAR(20) COMMENT '目标角色 ADMIN/SHOP/USER',
  `title` VARCHAR(255) COMMENT '标题',
  `content` VARCHAR(1000) COMMENT '内容',
  `type` VARCHAR(30) DEFAULT 'info' COMMENT '类型 info/success/warning/error',
  `is_read` TINYINT(1) DEFAULT 0 COMMENT '是否已读',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_role_user` (`role`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 优惠券种子数据(INSERT IGNORE: 重复执行不会重复插入)
INSERT IGNORE INTO `coupon` (`code`, `title`, `description`, `type`, `value`, `min_order`, `max_discount`, `category`, `expires_at`, `total`, `claimed`, `status`) VALUES
('WELCOME10', 'New User Discount', '10% off your first order', 'percent', 10, 0, 20, NULL, DATE_ADD(NOW(), INTERVAL 30 DAY), 1000, 0, 'enabled'),
('SAVE20', '$20 Off Orders Over $100', 'Flat $20 discount on orders $100+', 'fixed', 20, 100, NULL, NULL, DATE_ADD(NOW(), INTERVAL 14 DAY), 1000, 0, 'enabled'),
('VIP15', 'VIP 15% Off', '15% off sitewide, max $50 discount', 'percent', 15, 50, 50, NULL, DATE_ADD(NOW(), INTERVAL 7 DAY), 1000, 0, 'enabled'),
('FREESHIP', 'Free Shipping', 'Free shipping on any order', 'shipping', 100, 0, NULL, NULL, DATE_ADD(NOW(), INTERVAL 60 DAY), 1000, 0, 'enabled'),
('PHONE8', '8% Off Phones', 'Extra 8% off all phones & accessories', 'percent', 8, 0, 30, 'Phones', DATE_ADD(NOW(), INTERVAL 10 DAY), 1000, 0, 'enabled'),
('AUDIO15', '15% Off Audio', 'Take 15% off any audio product', 'percent', 15, 0, 40, 'Audio', DATE_ADD(NOW(), INTERVAL 21 DAY), 1000, 0, 'enabled'),
('OFFICE10', '$10 Off Office Supplies', 'Flat $10 off office & desk products', 'fixed', 10, 50, NULL, 'Office', DATE_ADD(NOW(), INTERVAL 14 DAY), 1000, 0, 'enabled');

-- 系统通知种子数据(幂等: 先清理同名行再插入, 可安全重复执行)
DELETE FROM `notification` WHERE `role` IN ('ADMIN','SHOP','USER') AND `user_id` = 0 AND `title` LIKE '欢迎%';
INSERT INTO `notification` (`user_id`, `role`, `title`, `content`, `type`, `is_read`) VALUES
(0, 'ADMIN', '欢迎使用管理后台', '平台管理后台已就绪, 可在左侧菜单管理商家/商品/订单。', 'info', 0),
(0, 'SHOP', '欢迎使用商家后台', '欢迎回来! 请及时处理待发货订单与买家消息。', 'info', 0),
(0, 'USER', '欢迎加入商城', '完成邮箱验证后即可使用通知偏好与优惠券功能。', 'info', 0);
