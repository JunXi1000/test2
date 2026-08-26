-- ============================================================
-- 基础建表脚本(MySQL 8.x)
-- 说明:
--   * 本文件 = 「迁移前」基线库:不含 payment 表、product_order 不含 order_no,
--     这两项由 migrations/V3__phase2_order_payment.sql 增量添加。
--   * conversation/message 由 chat.sql 负责;通知/优惠 6 表由
--     migration-2026-08-08-phase1.sql 负责。
--   * admin 账号种子行内联于下方(密码 BCrypt,与 user/shop 种子一致)。
--   * 演示账号密码统一 123456(DB 存 BCrypt 哈希),V1__security.sql 幂等兜底。
--   * 含中文,导入必须带 --default-character-set=utf8mb4,否则双重编码乱码。
-- 幂等性: CREATE TABLE IF NOT EXISTS + 显式 id 种子,可安全重复执行。
-- ============================================================

-- ----------------------------
-- 后台管理员
-- ----------------------------
CREATE TABLE IF NOT EXISTS `admin` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '密码(BCrypt)',
  `nickname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '昵称',
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像',
  `tel` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `status` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '状态',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='后台管理员';

-- admin 种子账号:admin / 123456(BCrypt 哈希,与 user/shop 一致)
INSERT INTO `admin` (`id`, `username`, `password`, `nickname`, `avatar_url`, `tel`, `email`, `status`) VALUES
(1, 'admin', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', '管理员', 'http://localhost:1000/file/8826e8c280cb3bec6a4fbeb61514ee74.png', '123456', '123456@javadh.com', '启用');

-- ----------------------------
-- 商城用户
-- ----------------------------
CREATE TABLE IF NOT EXISTS `user` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '密码(BCrypt)',
  `nickname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '昵称',
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像',
  `tel` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `status` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '状态',
  `balance` decimal(10,2) DEFAULT 0.00 COMMENT '余额',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商城用户';

-- ----------------------------
-- 商家
-- ----------------------------
CREATE TABLE IF NOT EXISTS `shop` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '登录用户名',
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '密码(BCrypt)',
  `nickname` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店长昵称',
  `avatar_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像',
  `tel` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号',
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱',
  `status` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '状态',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店铺名称',
  `fans_count` int DEFAULT 0 COMMENT '粉丝数',
  `aptitude_imgs` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '资质图片',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家';

-- ----------------------------
-- 商品分类
-- ----------------------------
CREATE TABLE IF NOT EXISTS `product_type` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '分类名称',
  `remark` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '备注',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类';

-- ----------------------------
-- 商品
-- ----------------------------
CREATE TABLE IF NOT EXISTS `product` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品名称',
  `main_img` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '主图',
  `img_list` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '轮播图',
  `product_type_id` int DEFAULT NULL COMMENT '分类id',
  `price` decimal(10,2) DEFAULT 0.00 COMMENT '价格',
  `stock` int DEFAULT 0 COMMENT '库存',
  `sales_volume` int DEFAULT 0 COMMENT '销量',
  `intro` text COMMENT '商品介绍',
  `shop_id` int DEFAULT NULL COMMENT '所属商家id',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品';

-- ----------------------------
-- 订单(扁平,每行一单;order_no 分组字段由 V3 增量添加)
-- ----------------------------
CREATE TABLE IF NOT EXISTS `product_order` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` int DEFAULT NULL COMMENT '商品id',
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品名称',
  `shop_id` int DEFAULT NULL COMMENT '商家id',
  `shop_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店铺名称',
  `total_money` decimal(10,2) DEFAULT 0.00 COMMENT '总金额',
  `quantity` int DEFAULT 1 COMMENT '数量',
  `user_id` int DEFAULT NULL COMMENT '买家id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '买家用户名',
  `status` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '待支付' COMMENT '状态',
  `consignee_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货人',
  `consignee_tel` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货人电话',
  `consignee_address` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货地址',
  `tracking_number` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '物流单号',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '订单备注',
  `order_evaluate_id` int DEFAULT NULL COMMENT '评价id',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单';

-- ----------------------------
-- 订单评价
-- ----------------------------
CREATE TABLE IF NOT EXISTS `product_order_evaluate` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` int DEFAULT NULL COMMENT '用户id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `user_avatar` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '头像',
  `product_id` int DEFAULT NULL COMMENT '商品id',
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品名称',
  `product_order_id` int DEFAULT NULL COMMENT '订单id',
  `content` text COMMENT '评价内容',
  `rate` int DEFAULT 5 COMMENT '评分',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单评价';

-- ----------------------------
-- 收货地址
-- ----------------------------
CREATE TABLE IF NOT EXISTS `shipping_address` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '收货人',
  `tel` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '电话',
  `address` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '地址',
  `user_id` int DEFAULT NULL COMMENT '用户id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收货地址';

-- ----------------------------
-- 购物车
-- ----------------------------
CREATE TABLE IF NOT EXISTS `shopping_cart` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` int DEFAULT NULL COMMENT '商品id',
  `user_id` int DEFAULT NULL COMMENT '用户id',
  `quantity` int DEFAULT 1 COMMENT '数量',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='购物车';

-- ----------------------------
-- 商品收藏
-- ----------------------------
CREATE TABLE IF NOT EXISTS `product_collect` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` int DEFAULT NULL COMMENT '商品id',
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品名称',
  `user_id` int DEFAULT NULL COMMENT '用户id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品收藏';

-- ----------------------------
-- 店铺收藏
-- ----------------------------
CREATE TABLE IF NOT EXISTS `shop_collect` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `shop_id` int DEFAULT NULL COMMENT '店铺id',
  `shop_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店铺名称',
  `shop_avatar` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '店铺头像',
  `user_id` int DEFAULT NULL COMMENT '用户id',
  `user_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='店铺收藏';

-- ----------------------------
-- 商品浏览历史
-- ----------------------------
CREATE TABLE IF NOT EXISTS `product_browsing_history` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `product_id` int DEFAULT NULL COMMENT '商品id',
  `product_name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '商品名称',
  `user_id` int DEFAULT NULL COMMENT '用户id',
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户名',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品浏览历史';

-- ----------------------------
-- 轮播图
-- ----------------------------
CREATE TABLE IF NOT EXISTS `slideshow` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题',
  `main_img` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图片',
  `link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '链接',
  `sort` int DEFAULT NULL COMMENT '排序',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='轮播图';

-- ----------------------------
-- 广告
-- ----------------------------
CREATE TABLE IF NOT EXISTS `advertising` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'id',
  `position` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '位置',
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标题',
  `link` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '链接',
  `main_img` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '图片',
  `sort` int DEFAULT NULL COMMENT '排序',
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='广告';

-- ============================================================
-- 演示种子数据(密码统一 123456,BCrypt 哈希)
-- ============================================================
INSERT INTO `user` (`id`, `username`, `password`, `nickname`, `email`, `tel`, `status`, `balance`) VALUES
(1, 'user1', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', '体验用户一', 'user@test.com', '13800000001', '启用', 1000.00),
(2, 'user2', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', '体验用户二', 'user2@test.com', '13800000002', '启用', 500.00),
-- e2e 凭据账号:username=email=test@example.com,密码 password123(与前端 e2e/mock 约定一致,真实后端也可登录)
(3, 'test@example.com', '$2b$10$yLqKTLeZFhlQebmYtW2IL.Jo4j3mxzMbHd0fW.Z2dBp20XkVtvnVe', '测试用户', 'test@example.com', '13800000000', '启用', 1000.00);

INSERT INTO `shop` (`id`, `username`, `password`, `nickname`, `name`, `email`, `status`) VALUES
(1, 'shop1', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', '店长一号', '一号数码旗舰店', 'shop@test.com', '启用'),
(2, 'shop2', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', '店长二号', '二号潮流服饰店', 'shop2@test.com', '启用');

INSERT INTO `product_type` (`id`, `name`, `remark`) VALUES
(1, '数码产品', '电子产品类'),
(2, '服装', '服饰类');

INSERT INTO `product` (`id`, `name`, `main_img`, `img_list`, `product_type_id`, `price`, `stock`, `sales_volume`, `intro`, `shop_id`) VALUES
(1, '无线蓝牙耳机', '/img/p1.jpg', '/img/p1.jpg', 1, 99.00, 50, 10, '主动降噪,30 小时续航,入耳舒适', 1),
(2, '简约纯棉T恤', '/img/p2.jpg', '/img/p2.jpg', 2, 149.00, 30, 5, '100% 纯棉,舒适透气,百搭款', 1),
(3, '智能运动手表', '/img/p3.jpg', '/img/p3.jpg', 1, 199.00, 20, 3, '心率监测,50 米防水,超长续航', 2);

INSERT INTO `shipping_address` (`id`, `name`, `tel`, `address`, `user_id`, `username`) VALUES
(1, '体验用户一', '13800000001', '上海市浦东新区测试路 1 号', 1, '体验用户一');
