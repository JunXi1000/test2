-- ============================================================
-- 会议白板助手 / 商城系统 MySQL 初始化脚本
-- 由 docker/mysql 容器自动执行 (docker-entrypoint-initdb.d)
-- 表结构对齐 sql/templatev3_s.sql + sql/chat.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS `template_v3` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `template_v3`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `message`;
DROP TABLE IF EXISTS `conversation`;
DROP TABLE IF EXISTS `advertising`;
DROP TABLE IF EXISTS `slideshow`;
DROP TABLE IF EXISTS `product_browsing_history`;
DROP TABLE IF EXISTS `shop_collect`;
DROP TABLE IF EXISTS `product_collect`;
DROP TABLE IF EXISTS `shopping_cart`;
DROP TABLE IF EXISTS `shipping_address`;
DROP TABLE IF EXISTS `product_order_evaluate`;
DROP TABLE IF EXISTS `product_order`;
DROP TABLE IF EXISTS `product`;
DROP TABLE IF EXISTS `product_type`;
DROP TABLE IF EXISTS `shop`;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS `admin`;

-- ----------------------------
-- 管理员
-- ----------------------------
CREATE TABLE `admin` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `username` VARCHAR(255) COMMENT '用户名称',
  `password` VARCHAR(255) COMMENT '密码',
  `nickname` VARCHAR(255) COMMENT '昵称',
  `avatar_url` VARCHAR(255) COMMENT '头像',
  `tel` VARCHAR(255) COMMENT '手机号',
  `email` VARCHAR(255) COMMENT '邮箱',
  `status` VARCHAR(128) COMMENT '状态',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 普通用户
-- ----------------------------
CREATE TABLE `user` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `username` VARCHAR(255) COMMENT '用户名称',
  `password` VARCHAR(255) COMMENT '密码',
  `nickname` VARCHAR(255) COMMENT '昵称',
  `avatar_url` VARCHAR(255) COMMENT '头像',
  `tel` VARCHAR(255) COMMENT '手机号',
  `email` VARCHAR(255) COMMENT '邮箱',
  `status` VARCHAR(128) COMMENT '状态',
  `balance` DOUBLE DEFAULT 0 COMMENT '余额',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 商家 / 店铺
-- ----------------------------
CREATE TABLE `shop` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `username` VARCHAR(255) COMMENT '登录用户名',
  `password` VARCHAR(255) COMMENT '密码',
  `nickname` VARCHAR(255) COMMENT '联系人昵称',
  `avatar_url` VARCHAR(255) COMMENT '头像',
  `tel` VARCHAR(255) COMMENT '手机号',
  `email` VARCHAR(255) COMMENT '邮箱',
  `status` VARCHAR(128) COMMENT '状态',
  `name` VARCHAR(255) COMMENT '店铺名称',
  `fans_count` INT DEFAULT 0 COMMENT '粉丝数',
  `aptitude_imgs` VARCHAR(500) COMMENT '资质图片',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 商品分类
-- ----------------------------
CREATE TABLE `product_type` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` VARCHAR(255) COMMENT '分类名称',
  `remark` VARCHAR(255) COMMENT '备注',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 商品
-- ----------------------------
CREATE TABLE `product` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` VARCHAR(255) COMMENT '商品名称',
  `main_img` VARCHAR(500) COMMENT '主图',
  `img_list` VARCHAR(1000) COMMENT '图片列表',
  `product_type_id` INT COMMENT '分类id',
  `price` DOUBLE DEFAULT 0 COMMENT '价格',
  `stock` INT DEFAULT 0 COMMENT '库存',
  `sales_volume` INT DEFAULT 0 COMMENT '销量',
  `intro` TEXT COMMENT '商品介绍',
  `shop_id` INT COMMENT '店铺id',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 订单
-- ----------------------------
CREATE TABLE `product_order` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` INT COMMENT '商品id',
  `product_name` VARCHAR(255) COMMENT '商品名称',
  `shop_id` INT COMMENT '店铺id',
  `shop_name` VARCHAR(255) COMMENT '店铺名称',
  `total_money` DOUBLE DEFAULT 0 COMMENT '总金额',
  `quantity` INT DEFAULT 1 COMMENT '数量',
  `user_id` INT COMMENT '用户id',
  `username` VARCHAR(255) COMMENT '用户名',
  `status` VARCHAR(50) DEFAULT '待支付' COMMENT '状态',
  `consignee_name` VARCHAR(255) COMMENT '收货人姓名',
  `consignee_tel` VARCHAR(255) COMMENT '收货人电话',
  `consignee_address` VARCHAR(500) COMMENT '收货人地址',
  `tracking_number` VARCHAR(255) COMMENT '快递单号',
  `remark` VARCHAR(500) COMMENT '备注',
  `order_evaluate_id` INT COMMENT '评价id',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 评价
-- ----------------------------
CREATE TABLE `product_order_evaluate` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` INT COMMENT '用户id',
  `username` VARCHAR(255) COMMENT '用户名',
  `user_avatar` VARCHAR(500) COMMENT '用户头像',
  `product_id` INT COMMENT '商品id',
  `product_name` VARCHAR(255) COMMENT '商品名称',
  `product_order_id` INT COMMENT '订单id',
  `content` TEXT COMMENT '评价内容',
  `rate` INT DEFAULT 5 COMMENT '评分',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 收货地址
-- ----------------------------
CREATE TABLE `shipping_address` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` VARCHAR(255) COMMENT '收货人姓名',
  `tel` VARCHAR(255) COMMENT '电话',
  `address` VARCHAR(500) COMMENT '地址',
  `user_id` INT COMMENT '用户id',
  `username` VARCHAR(255) COMMENT '用户名',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 购物车
-- ----------------------------
CREATE TABLE `shopping_cart` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` INT COMMENT '商品id',
  `user_id` INT COMMENT '用户id',
  `quantity` INT DEFAULT 1 COMMENT '数量',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 商品收藏
-- ----------------------------
CREATE TABLE `product_collect` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` INT COMMENT '商品id',
  `product_name` VARCHAR(255) COMMENT '商品名称',
  `user_id` INT COMMENT '用户id',
  `username` VARCHAR(255) COMMENT '用户名',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 店铺收藏
-- ----------------------------
CREATE TABLE `shop_collect` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `shop_id` INT COMMENT '店铺id',
  `shop_name` VARCHAR(255) COMMENT '店铺名称',
  `shop_avatar` VARCHAR(500) COMMENT '店铺头像',
  `user_id` INT COMMENT '用户id',
  `user_name` VARCHAR(255) COMMENT '用户名',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 浏览历史
-- ----------------------------
CREATE TABLE `product_browsing_history` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` INT COMMENT '商品id',
  `product_name` VARCHAR(255) COMMENT '商品名称',
  `user_id` INT COMMENT '用户id',
  `username` VARCHAR(255) COMMENT '用户名',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 轮播图
-- ----------------------------
CREATE TABLE `slideshow` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `title` VARCHAR(255) COMMENT '标题',
  `main_img` VARCHAR(500) COMMENT '图片',
  `link` VARCHAR(500) COMMENT '链接',
  `sort` INT COMMENT '排序',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 广告位
-- ----------------------------
CREATE TABLE `advertising` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT 'id',
  `position` VARCHAR(255) COMMENT '位置',
  `title` VARCHAR(255) COMMENT '标题',
  `link` VARCHAR(500) COMMENT '链接',
  `main_img` VARCHAR(500) COMMENT '图片',
  `sort` INT COMMENT '排序',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 聊天会话
-- ----------------------------
CREATE TABLE `conversation` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '会话id',
  `user_id` INT NOT NULL COMMENT '用户id',
  `shop_id` INT NOT NULL COMMENT '店铺id',
  `product_id` INT DEFAULT NULL COMMENT '关联商品',
  `last_message` VARCHAR(500) COMMENT '最后一条消息',
  `last_message_time` TIMESTAMP NULL COMMENT '最后消息时间',
  `user_unread_count` INT DEFAULT 0 COMMENT '用户未读数',
  `shop_unread_count` INT DEFAULT 0 COMMENT '商家未读数',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_shop` (`user_id`, `shop_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------
-- 聊天消息
-- ----------------------------
CREATE TABLE `message` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '消息id',
  `conversation_id` INT NOT NULL COMMENT '会话id',
  `sender_id` INT NOT NULL COMMENT '发送者id',
  `sender_type` VARCHAR(10) NOT NULL COMMENT '发送者类型 USER/SHOP',
  `content` TEXT COMMENT '消息内容',
  `type` VARCHAR(20) DEFAULT 'text' COMMENT '消息类型',
  `file_name` VARCHAR(255) COMMENT '文件名',
  `file_url` VARCHAR(500) COMMENT '文件地址',
  `is_read` TINYINT(1) DEFAULT 0 COMMENT '已读标记',
  `create_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  PRIMARY KEY (`id`),
  INDEX `idx_conversation` (`conversation_id`),
  INDEX `idx_conv_time` (`conversation_id`, `create_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 种子数据 (演示用账号密码均为 123456)
-- 管理员: admin / 123456
-- 买家:   user1 / 123456
-- 商家:   shop1 / 123456
-- ============================================================

INSERT INTO `admin` (`id`, `username`, `password`, `nickname`, `email`, `status`) VALUES
(1, 'admin', '123456', '平台管理员', 'admin@test.com', '启用');

INSERT INTO `user` (`id`, `username`, `password`, `nickname`, `email`, `status`, `balance`) VALUES
(1, 'user1', '123456', '小明', 'user1@test.com', '启用', 9999),
(2, 'user2', '123456', '小红', 'user2@test.com', '启用', 5000);

INSERT INTO `shop` (`id`, `username`, `password`, `nickname`, `name`, `email`, `status`, `fans_count`) VALUES
(1, 'shop1', '123456', '店主老王', '数码优选旗舰店', 'shop1@test.com', '启用', 128),
(2, 'shop2', '123456', '店主小李', '时尚服饰馆', 'shop2@test.com', '启用', 86);

INSERT INTO `product_type` (`id`, `name`, `remark`) VALUES
(1, '数码电子', '手机、电脑、配件'),
(2, '服饰鞋包', '衣服、鞋子、箱包'),
(3, '食品生鲜', '零食、水果、生鲜'),
(4, '家居生活', '家具、日用、收纳');

INSERT INTO `product` (`id`, `name`, `main_img`, `img_list`, `product_type_id`, `price`, `stock`, `sales_volume`, `intro`, `shop_id`) VALUES
(1, '无线蓝牙耳机 Pro', 'http://localhost:1000/file/01312ea8c4ba396eb2cf481e45e274dd.png', 'http://localhost:1000/file/01312ea8c4ba396eb2cf481e45e274dd.png', 1, 199.00, 100, 320, '主动降噪，超长续航 30 小时。', 1),
(2, '智能手表 S8', 'http://localhost:1000/file/051351df65b8a425f1c32e4cde0e5687.jpg', 'http://localhost:1000/file/051351df65b8a425f1c32e4cde0e5687.jpg', 1, 899.00, 50, 156, '血氧/心率监测，AMOLED 高清屏。', 1),
(3, '纯棉印花T恤', 'http://localhost:1000/file/189df3ec0c9de43fd0d326073ed3ccae.png', 'http://localhost:1000/file/189df3ec0c9de43fd0d326073ed3ccae.png', 2, 79.00, 200, 480, '100% 纯棉，透气舒适，多色可选。', 2),
(4, '轻便运动跑鞋', 'http://localhost:1000/file/1d9953dc3cea5e0cf0eecc63921a7a68.png', 'http://localhost:1000/file/1d9953dc3cea5e0cf0eecc63921a7a68.png', 2, 259.00, 80, 210, '缓震回弹，适合日常跑步。', 2),
(5, '每日坚果大礼包', 'http://localhost:1000/file/1f421455eb98279a221742676e356237.png', 'http://localhost:1000/file/1f421455eb98279a221742676e356237.png', 3, 129.00, 300, 650, '七种坚果混合，独立小包装。', 1),
(6, '北欧实木收纳柜', 'http://localhost:1000/file/236befdd797a9c3b120b37e270cd8abb.jpg', 'http://localhost:1000/file/236befdd797a9c3b120b37e270cd8abb.jpg', 4, 399.00, 40, 89, '多层分区，简约北欧风。', 2);

INSERT INTO `product_order` (`id`, `product_id`, `product_name`, `shop_id`, `shop_name`, `total_money`, `quantity`, `user_id`, `username`, `status`, `consignee_name`, `consignee_tel`, `consignee_address`, `create_time`) VALUES
(1, 1, '无线蓝牙耳机 Pro', 1, '数码优选旗舰店', 199.00, 1, 1, '小明', '待支付', '小明', '13800000001', '北京市朝阳区建国路 88 号', CURRENT_TIMESTAMP),
(2, 3, '纯棉印花T恤', 2, '时尚服饰馆', 158.00, 2, 1, '小明', '已完成', '小明', '13800000001', '北京市朝阳区建国路 88 号', CURRENT_TIMESTAMP);

INSERT INTO `shipping_address` (`id`, `name`, `tel`, `address`, `user_id`, `username`) VALUES
(1, '小明', '13800000001', '北京市朝阳区建国路 88 号', 1, '小明');

INSERT INTO `slideshow` (`id`, `title`, `main_img`, `link`, `sort`) VALUES
(1, '新品上市', 'http://localhost:1000/file/01312ea8c4ba396eb2cf481e45e274dd.png', '/', 1),
(2, '夏日大促', 'http://localhost:1000/file/189df3ec0c9de43fd0d326073ed3ccae.png', '/', 2);

INSERT INTO `advertising` (`id`, `position`, `title`, `link`, `main_img`, `sort`) VALUES
(1, '首页中部', '数码狂欢', '/products?category=数码电子', 'http://localhost:1000/file/051351df65b8a425f1c32e4cde0e5687.jpg', 1),
(2, '首页底部', '精选好物', '/products?category=家居生活', 'http://localhost:1000/file/236befdd797a9c3b120b37e270cd8abb.jpg', 2);

-- ============================================================
-- Phase 1 新增表 (前端占位功能后端化)
-- ============================================================

-- 用户通知偏好
CREATE TABLE `user_notification_pref` (
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
CREATE TABLE `coupon` (
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
CREATE TABLE `user_coupon` (
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
CREATE TABLE `return_request` (
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
CREATE TABLE `stock_alert` (
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
CREATE TABLE `notification` (
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

-- 优惠券种子数据(与前端 mock 券一一对应)
INSERT INTO `coupon` (`code`, `title`, `description`, `type`, `value`, `min_order`, `max_discount`, `category`, `expires_at`, `total`, `claimed`, `status`) VALUES
('WELCOME10', 'New User Discount', '10% off your first order', 'percent', 10, 0, 20, NULL, DATE_ADD(NOW(), INTERVAL 30 DAY), 1000, 0, 'enabled'),
('SAVE20', '$20 Off Orders Over $100', 'Flat $20 discount on orders $100+', 'fixed', 20, 100, NULL, NULL, DATE_ADD(NOW(), INTERVAL 14 DAY), 1000, 0, 'enabled'),
('VIP15', 'VIP 15% Off', '15% off sitewide, max $50 discount', 'percent', 15, 50, 50, NULL, DATE_ADD(NOW(), INTERVAL 7 DAY), 1000, 0, 'enabled'),
('FREESHIP', 'Free Shipping', 'Free shipping on any order', 'shipping', 100, 0, NULL, NULL, DATE_ADD(NOW(), INTERVAL 60 DAY), 1000, 0, 'enabled'),
('PHONE8', '8% Off Phones', 'Extra 8% off all phones & accessories', 'percent', 8, 0, 30, 'Phones', DATE_ADD(NOW(), INTERVAL 10 DAY), 1000, 0, 'enabled'),
('AUDIO15', '15% Off Audio', 'Take 15% off any audio product', 'percent', 15, 0, 40, 'Audio', DATE_ADD(NOW(), INTERVAL 21 DAY), 1000, 0, 'enabled'),
('OFFICE10', '$10 Off Office Supplies', 'Flat $10 off office & desk products', 'fixed', 10, 50, NULL, 'Office', DATE_ADD(NOW(), INTERVAL 14 DAY), 1000, 0, 'enabled');

-- 系统通知种子数据
INSERT INTO `notification` (`user_id`, `role`, `title`, `content`, `type`, `is_read`) VALUES
(0, 'ADMIN', '欢迎使用管理后台', '平台管理后台已就绪, 可在左侧菜单管理商家/商品/订单。', 'info', 0),
(0, 'SHOP', '欢迎使用商家后台', '欢迎回来! 请及时处理待发货订单与买家消息。', 'info', 0),
(0, 'USER', '欢迎加入商城', '完成邮箱验证后即可使用通知偏好与优惠券功能。', 'info', 0);

SET FOREIGN_KEY_CHECKS = 1;
