-- H2-compatible schema for integration tests (MySQL MODE)
-- Mirrors sql/schema.sql + sql/chat.sql

CREATE TABLE IF NOT EXISTS admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255),
  password VARCHAR(255),
  nickname VARCHAR(255),
  avatar_url VARCHAR(255),
  tel VARCHAR(255),
  email VARCHAR(255),
  status VARCHAR(128),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255),
  password VARCHAR(255),
  nickname VARCHAR(255),
  avatar_url VARCHAR(255),
  tel VARCHAR(255),
  email VARCHAR(255),
  status VARCHAR(128),
  balance DECIMAL(10,2) DEFAULT 0.00,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS shop (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255),
  password VARCHAR(255),
  nickname VARCHAR(255),
  avatar_url VARCHAR(255),
  tel VARCHAR(255),
  email VARCHAR(255),
  status VARCHAR(128),
  name VARCHAR(255),
  fans_count INT DEFAULT 0,
  aptitude_imgs VARCHAR(500),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS product_type (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- status 取值 active(已上架)/ draft(草稿)/ archived(归档)/ banned(封禁),
-- 与前端 adminProducts.ts:9 / merchantProducts.ts:10 的并集逐字一致。
-- NOT NULL DEFAULT 'active' ⇒ 存量行全部在架,买家侧可见性不变;
-- 且一旦出现 NULL,`WHERE status='active'` 会静默漏行 —— 那正是本次要修的缺陷。
CREATE TABLE IF NOT EXISTS product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  main_img VARCHAR(500),
  img_list VARCHAR(1000),
  product_type_id INT,
  price DECIMAL(10,2) DEFAULT 0.00,
  stock INT DEFAULT 0,
  sales_volume INT DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  intro TEXT,
  shop_id INT,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_order (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64),
  product_id INT,
  product_name VARCHAR(255),
  shop_id INT,
  shop_name VARCHAR(255),
  total_money DECIMAL(10,2) DEFAULT 0.00,
  quantity INT DEFAULT 1,
  user_id INT,
  username VARCHAR(255),
  status VARCHAR(50) DEFAULT '待支付',
  consignee_name VARCHAR(255),
  consignee_tel VARCHAR(255),
  consignee_address VARCHAR(500),
  tracking_number VARCHAR(255),
  remark VARCHAR(500),
  order_evaluate_id INT,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_no ON product_order (order_no);

CREATE TABLE IF NOT EXISTS payment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL,
  user_id INT,
  amount DECIMAL(10,2) DEFAULT 0.00,
  channel VARCHAR(20) DEFAULT 'card',
  transaction_no VARCHAR(64),
  status VARCHAR(20) DEFAULT '待支付',
  paid_time TIMESTAMP,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (order_no)
);

-- review_status / reviewer_id / review_time / review_remark 四列为
-- V8__review_moderation.sql 的内容(mirrors sql/migrations/V8__review_moderation.sql)。
-- 取值约定:review_status ∈ {visible, hidden};后三列未审核时为 NULL。
CREATE TABLE IF NOT EXISTS product_order_evaluate (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(255),
  user_avatar VARCHAR(500),
  product_id INT,
  product_name VARCHAR(255),
  product_order_id INT,
  content TEXT,
  rate INT DEFAULT 5,
  review_status VARCHAR(20) NOT NULL DEFAULT 'visible',
  reviewer_id INT,
  review_time TIMESTAMP,
  review_remark VARCHAR(500),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- is_default:0=非默认 / 1=默认。一个用户至多一个默认地址的**不变式由应用层事务保证**
-- (先 SET is_default=0 WHERE user_id=? 再 SET is_default=1 WHERE id=? AND user_id=?),
-- DB 不建唯一键 —— 理由与生成列方案见 sql/migrations/V10 的注释第五节。
-- 存量行全为 0:本迁移不替用户猜默认地址,由首次 PUT /addresses/{id}/default 确定。
CREATE TABLE IF NOT EXISTS shipping_address (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  tel VARCHAR(255),
  address VARCHAR(500),
  user_id INT,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  username VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  user_id INT,
  quantity INT DEFAULT 1,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS product_collect (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  product_name VARCHAR(255),
  user_id INT,
  username VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS shop_collect (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT,
  shop_name VARCHAR(255),
  shop_avatar VARCHAR(500),
  user_id INT,
  user_name VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, shop_id)
);

CREATE TABLE IF NOT EXISTS product_browsing_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  product_name VARCHAR(255),
  user_id INT,
  username VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS slideshow (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255),
  main_img VARCHAR(500),
  link VARCHAR(500),
  sort INT,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS advertising (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position VARCHAR(255),
  title VARCHAR(255),
  link VARCHAR(500),
  main_img VARCHAR(500),
  sort INT,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  shop_id INT NOT NULL,
  product_id INT,
  last_message VARCHAR(500),
  last_message_time TIMESTAMP,
  user_unread_count INT DEFAULT 0,
  shop_unread_count INT DEFAULT 0,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, shop_id)
);

CREATE TABLE IF NOT EXISTS message (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  sender_type VARCHAR(10) NOT NULL,
  content TEXT,
  type VARCHAR(20) DEFAULT 'text',
  file_name VARCHAR(255),
  file_url VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data for tests
-- 演示账号统一密码 123456,DB 中存 BCrypt 哈希
INSERT INTO admin (id, username, password, nickname, status) VALUES (1, 'admin', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', 'Admin', '启用');
INSERT INTO user (id, username, password, nickname, email, tel, status) VALUES (1, 'user1', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', 'Test User', 'user@test.com', '13800000001', '启用');
INSERT INTO user (id, username, password, nickname, email, tel, status) VALUES (2, 'user2', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', 'User Two', 'user2@test.com', '13800000002', '启用');
INSERT INTO shop (id, username, password, nickname, name, status, email) VALUES (1, 'shop1', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', 'Store One', 'Test Store', '启用', 'shop@test.com');
INSERT INTO shop (id, username, password, nickname, name, status, email) VALUES (2, 'shop2', '$2b$10$XgIBI2rnaZ.4I4rWj27B1uXkCX6L9xuJ.0jLkevXa0Scgvczw.mbW', 'Store Two', 'Another Store', '启用', 'shop2@test.com');
INSERT INTO product_type (id, name) VALUES (1, 'Electronics');
INSERT INTO product_type (id, name) VALUES (2, 'Clothing');
INSERT INTO product (id, name, main_img, product_type_id, price, stock, sales_volume, shop_id) VALUES (1, 'Test Product 1', '/img/p1.jpg', 1, 99.00, 50, 10, 1);
INSERT INTO product (id, name, main_img, product_type_id, price, stock, sales_volume, shop_id) VALUES (2, 'Test Product 2', '/img/p2.jpg', 2, 149.00, 30, 5, 1);
INSERT INTO product (id, name, main_img, product_type_id, price, stock, sales_volume, shop_id) VALUES (3, 'Test Product 3', '/img/p3.jpg', 1, 199.00, 20, 3, 2);
INSERT INTO product_order (id, product_id, product_name, shop_id, shop_name, total_money, quantity, user_id, username, status, create_time) VALUES (1, 1, 'Test Product 1', 1, 'Test Store', 99.00, 1, 1, 'Test User', '已完成', CURRENT_TIMESTAMP);
INSERT INTO shipping_address (id, name, tel, address, user_id, username) VALUES (1, 'Home', '1234567890', '123 Main St', 1, 'Test User');

-- ── Phase 1 tables (mirrors sql/ migration-2026-08-08-phase1.sql) ─────────
CREATE TABLE IF NOT EXISTS user_notification_pref (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  email_order TINYINT(1) DEFAULT 1,
  email_promo TINYINT(1) DEFAULT 0,
  sms_order TINYINT(1) DEFAULT 1,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS coupon (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  description VARCHAR(500),
  type VARCHAR(20) DEFAULT 'percent',
  value DECIMAL(10,2) DEFAULT 0.00,
  min_order DECIMAL(10,2) DEFAULT 0.00,
  max_discount DECIMAL(10,2),
  category VARCHAR(64),
  expires_at TIMESTAMP,
  total INT DEFAULT 1000,
  claimed INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'enabled',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS user_coupon (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  coupon_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'unused',
  claimed_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_time TIMESTAMP,
  UNIQUE (user_id, coupon_id)
);

CREATE TABLE IF NOT EXISTS return_request (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  order_id VARCHAR(64),
  product_title VARCHAR(255),
  product_image VARCHAR(500),
  reason VARCHAR(255),
  detail TEXT,
  refund_amount DECIMAL(10,2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'pending',
  created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_time TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_alert (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  product_title VARCHAR(255),
  product_image VARCHAR(500),
  email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS notification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT 0,
  `role` VARCHAR(20),
  title VARCHAR(255),
  content VARCHAR(1000),
  type VARCHAR(30) DEFAULT 'info',
  is_read TINYINT(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Phase 1 seed data (coupons + a welcome notification per role)
INSERT INTO coupon (code, title, description, type, value, min_order, max_discount, category, expires_at, total, claimed, status) VALUES
('WELCOME10', 'New User Discount', '10% off your first order', 'percent', 10, 0, 20, NULL, '2026-09-07 00:00:00', 1000, 0, 'enabled'),
('SAVE20', '$20 Off Orders Over $100', 'Flat $20 discount on orders $100+', 'fixed', 20, 100, NULL, NULL, '2026-08-22 00:00:00', 1000, 0, 'enabled'),
('VIP15', 'VIP 15% Off', '15% off sitewide, max $50 discount', 'percent', 15, 50, 50, NULL, '2026-08-15 00:00:00', 1000, 0, 'enabled'),
('FREESHIP', 'Free Shipping', 'Free shipping on any order', 'shipping', 100, 0, NULL, NULL, '2026-10-07 00:00:00', 1000, 0, 'enabled'),
('PHONE8', '8% Off Phones', 'Extra 8% off all phones & accessories', 'percent', 8, 0, 30, 'Phones', '2026-08-18 00:00:00', 1000, 0, 'enabled'),
('AUDIO15', '15% Off Audio', 'Take 15% off any audio product', 'percent', 15, 0, 40, 'Audio', '2026-08-29 00:00:00', 1000, 0, 'enabled'),
('OFFICE10', '$10 Off Office Supplies', 'Flat $10 off office & desk products', 'fixed', 10, 50, NULL, 'Office', '2026-08-22 00:00:00', 1000, 0, 'enabled');

INSERT INTO notification (user_id, `role`, title, content, type, is_read) VALUES
(0, 'ADMIN', '欢迎使用管理后台', '平台管理后台已就绪, 可在左侧菜单管理商家/商品/订单。', 'info', 0),
(0, 'SHOP', '欢迎使用商家后台', '欢迎回来! 请及时处理待发货订单与买家消息。', 'info', 0),
(0, 'USER', '欢迎加入商城', '完成邮箱验证后即可使用通知偏好与优惠券功能。', 'info', 0);


-- ============================================================================
-- Phase 3 tables (mirrors sql/migrations/V6 ~ V9)
--
-- ⚠️ 索引命名的**硬性差异**(改之前先读完):
--   MySQL 的索引名是「表内唯一」,H2 是「schema 内全局唯一」。
--   若照抄 MySQL 的 idx_user_id(idx_user_id 在 MySQL 里挂在 5 张表上),
--   `CREATE INDEX IF NOT EXISTS` 会让**第二张之后的表静默拿不到索引**
--   —— 因为 H2 看到「同名索引已存在」就直接跳过,而它属于另一张表。
--   所以本文件的二级索引一律加表名前缀,与 MySQL 侧名字**故意不同**,
--   对应关系见每组注释。唯一键(UNIQUE)用表内约束,H2 自动命名,不冲突。
--
-- 标注含义:
--   [必需]   测试跑通必须有(表/列存在),缺了后端测试直接报表不存在
--   [对齐]   可选。补它只为让 H2 与 MySQL 的索引/执行计划一致,
--            避免「本地测过、MySQL 上计划不同」。不影响测试结果。
-- ============================================================================

-- ── V6:商家钱包 ────────────────────────────────────────────────────────────
-- 金额一律 DECIMAL(14,2);balance/total_income 是累计量,不能用单据级的 (10,2)。
-- amount 恒为正,收支方向由 direction(income/expense)表达。
-- idempotency_key 唯一 = 提现幂等的落点:重复提交撞唯一键,余额不变、流水不新增。
CREATE TABLE IF NOT EXISTS merchant_wallet (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  pending_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_income DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_withdraw DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP,
  UNIQUE (shop_id)
);

CREATE TABLE IF NOT EXISTS merchant_wallet_transaction (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_id INT NOT NULL,
  shop_id INT NOT NULL,
  txn_no VARCHAR(64) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'adjustment',
  direction VARCHAR(10) NOT NULL DEFAULT 'income',
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance_before DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  ref_type VARCHAR(30),
  ref_no VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  description VARCHAR(255),
  idempotency_key VARCHAR(128),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP,
  UNIQUE (txn_no),
  UNIQUE (idempotency_key)
);

-- [对齐] MySQL: idx_wtxn_shop_time / idx_wtxn_wallet_time / idx_wtxn_ref / idx_wtxn_status
-- 这些名字在 H2 里本就全局唯一,可直接沿用。
-- 查询形状:「按商家+时间倒序分页」「按钱包对账」「按单据反查」「筛 pending 提现」
CREATE INDEX IF NOT EXISTS idx_wtxn_shop_time ON merchant_wallet_transaction (shop_id, create_time);
CREATE INDEX IF NOT EXISTS idx_wtxn_wallet_time ON merchant_wallet_transaction (wallet_id, create_time);
CREATE INDEX IF NOT EXISTS idx_wtxn_ref ON merchant_wallet_transaction (ref_type, ref_no);
CREATE INDEX IF NOT EXISTS idx_wtxn_status ON merchant_wallet_transaction (status, create_time);

-- ── V7:设置持久化(强字段结构,不是 KV)──────────────────────────────────────
-- admin_setting 是**单行表**:singleton 唯一键保证全表只有一行,读法固定 WHERE singleton = 1。
-- 列默认值刻意与 AdminApiController.getSettings() 旧的硬编码返回逐字一致
-- (Nexus Market / 关闭维护 / 允许注册 / 5%),迁移本身不改变接口行为。
CREATE TABLE IF NOT EXISTS admin_setting (
  id INT AUTO_INCREMENT PRIMARY KEY,
  singleton TINYINT NOT NULL DEFAULT 1,
  site_name VARCHAR(255) NOT NULL DEFAULT 'Nexus Market',
  maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
  allow_registrations TINYINT(1) NOT NULL DEFAULT 1,
  commission_rate DECIMAL(7,4) NOT NULL DEFAULT 5.0000,
  contact_email VARCHAR(255),
  update_by INT,
  update_time TIMESTAMP,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (singleton)
);

-- merchant_setting 每店一行。storeName/description/logo/email 复用 shop 已有列,
-- 本表只存 shop 没有的字段,不做冗余复制(避免两处漂移)。
CREATE TABLE IF NOT EXISTS merchant_setting (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  location VARCHAR(255),
  response_time VARCHAR(64),
  shipping_policy TEXT,
  return_policy TEXT,
  notify_email TINYINT(1) NOT NULL DEFAULT 1,
  notify_push TINYINT(1) NOT NULL DEFAULT 0,
  notify_sms TINYINT(1) NOT NULL DEFAULT 1,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP,
  UNIQUE (shop_id)
);

-- ── V9:看板聚合时间索引 ────────────────────────────────────────────────────
-- [对齐] MySQL 侧 product_order.idx_create_time。
-- 现有 idx_status_create_time(status, create_time) 只在带 status 前导时可用;
-- 收入趋势图那条 `WHERE create_time BETWEEN ? GROUP BY DATE(create_time)`
-- 按最左前缀用不上它,故另建一条纯 create_time 索引。
CREATE INDEX IF NOT EXISTS idx_ord_create_time ON product_order (create_time);

-- [对齐] MySQL 侧 product_browsing_history.idx_create_time。
-- 服务的查询:近 N 分钟内有浏览行为的去重用户数(看板 "Active Now")。
CREATE INDEX IF NOT EXISTS idx_pbh_create_time ON product_browsing_history (create_time);

-- ── V10:product 上架状态 / shipping_address 默认地址 ───────────────────────
-- [必需] V10 带的列(非索引):product.status 与 shipping_address.is_default。
--   缺这两列,后端 Product.status / ShippingAddress.isDefault 两个实体字段
--   在 H2 测试里会直接报表不存在。
--   product.status / shipping_address.is_default 两张表的 CREATE 已在文件上方改好。

-- [对齐] MySQL 侧 V10 的索引。名字加表前缀,理由见文件上方「索引命名的硬性差异」。
--   idx_shop_status: 商家/店铺列表「按商家 + 按状态」过滤
CREATE INDEX IF NOT EXISTS idx_prod_shop_status ON product (shop_id, status);
--   idx_status_id  : 后台列表 `WHERE status=? ORDER BY id DESC LIMIT 100`,
--                    id 放索引第二列才能同时满足过滤与排序,避免 filesort
CREATE INDEX IF NOT EXISTS idx_prod_status_id ON product (status, id);
--   idx_user_default: ShippingAddressMapper 对 user_id 此前**完全没有索引**,
--                     地址列表与「取默认地址」都走它
CREATE INDEX IF NOT EXISTS idx_addr_user_default ON shipping_address (user_id, is_default);

-- ── V11:product_order 看板复合索引 ──────────────────────────────────────────
-- [对齐] 查询形状取自 AnalyticsMapper.xml(后端 D1 新增):
--   · paidOrderFilter = `status IN ('待发货','待收货','已完成')` + 可选 shop_id + 可选 create_time
--     → idx_ord_shop_status_time 解决「叠加 shop_id 后最左前缀失效」,
--       能在 (shop_id, status) 定位后对 create_time 做范围扫描
--   · countDistinctOrderingUsers = COUNT(DISTINCT user_id) + create_time >= ?
--     → idx_ord_user_time 让 user_id 作前导列去重、create_time 作第二列承载区间,
--       MySQL 可做 loose index scan
-- 后端 04b 清单 §4 要的 idx_order_status_time(status, create_time)
-- 已由下面的 idx_ord_status_ctime 覆盖(V4 建过),不重复建。
CREATE INDEX IF NOT EXISTS idx_ord_shop_status_time ON product_order (shop_id, status, create_time);
CREATE INDEX IF NOT EXISTS idx_ord_user_time ON product_order (user_id, create_time);

-- ── V4 遗留索引在 H2 侧的对齐(全部 [对齐],不影响测试结果)─────────────────────
-- MySQL 侧 V4 建了这些二级索引,原 H2 schema 没跟。凡语义与上条索引重复的
-- (可由已有索引的最左前缀覆盖),本文件不重复建,并在注释里标出。
-- 注:idx_ord_user_id / idx_ord_shop_id 虽然是 V11 两条复合索引的最左前缀,仍保留 ——
--     单列索引更窄,简单过滤(计数、归属校验)走它更省,理由同 V11 回滚脚本第三节。

-- product_order:V4 idx_user_id / idx_shop_id / idx_status_create_time(idx_order_no 已在上面)
CREATE INDEX IF NOT EXISTS idx_ord_user_id ON product_order (user_id);
CREATE INDEX IF NOT EXISTS idx_ord_shop_id ON product_order (shop_id);
CREATE INDEX IF NOT EXISTS idx_ord_status_ctime ON product_order (status, create_time);

-- product:V4 idx_shop_id / idx_product_type_id
CREATE INDEX IF NOT EXISTS idx_prod_shop_id ON product (shop_id);
CREATE INDEX IF NOT EXISTS idx_prod_type_id ON product (product_type_id);

-- payment:V4 idx_user_id / idx_status(uk_order_no 已内联为 UNIQUE)
CREATE INDEX IF NOT EXISTS idx_pay_user_id ON payment (user_id);
CREATE INDEX IF NOT EXISTS idx_pay_status ON payment (status);

-- product_browsing_history:V4 idx_user_id / idx_product_id(idx_create_time 见上)
CREATE INDEX IF NOT EXISTS idx_pbh_user_id ON product_browsing_history (user_id);
CREATE INDEX IF NOT EXISTS idx_pbh_product_id ON product_browsing_history (product_id);

-- product_order_evaluate:V4 idx_user_id / idx_product_id / idx_product_order_id
-- + V8 idx_review_status_time(审核列表按状态过滤、按审核时间排序)
CREATE INDEX IF NOT EXISTS idx_poe_user_id ON product_order_evaluate (user_id);
CREATE INDEX IF NOT EXISTS idx_poe_product_id ON product_order_evaluate (product_id);
CREATE INDEX IF NOT EXISTS idx_poe_order_id ON product_order_evaluate (product_order_id);
CREATE INDEX IF NOT EXISTS idx_poe_review_status_time ON product_order_evaluate (review_status, review_time);

-- coupon:V4 idx_status(uk_code 已内联为 UNIQUE)
CREATE INDEX IF NOT EXISTS idx_cpn_status ON coupon (status);

-- return_request:V4 idx_user_id
CREATE INDEX IF NOT EXISTS idx_rr_user_id ON return_request (user_id);

-- notification:V4 idx_role_user
CREATE INDEX IF NOT EXISTS idx_notif_role_user ON notification (`role`, user_id);

-- message:V4 idx_conversation(conversation_id) 与 idx_conv_time(conversation_id, create_time)。
-- 前者被后者**完全覆盖**(最左前缀),故只建复合索引一条,行为与 MySQL 侧等价。
CREATE INDEX IF NOT EXISTS idx_msg_conv_ctime ON message (conversation_id, create_time);

-- ── Phase 3 种子数据 ───────────────────────────────────────────────────────
-- 与 MySQL 侧 V6/V7 的 INSERT IGNORE ... SELECT 等价:H2 每次启动是全新内存库,
-- 直接 INSERT 即可(与本文件既有的种子风格一致)。
INSERT INTO merchant_wallet (shop_id, balance, pending_amount, total_income, total_withdraw, currency) VALUES
(1, 0.00, 0.00, 0.00, 0.00, 'USD'),
(2, 0.00, 0.00, 0.00, 0.00, 'USD');

INSERT INTO admin_setting (id, singleton, site_name, maintenance_mode, allow_registrations, commission_rate, contact_email) VALUES
(1, 1, 'Nexus Market', 0, 1, 5.0000, '123456@javadh.com');

INSERT INTO merchant_setting (shop_id, location, response_time, notify_email, notify_push, notify_sms) VALUES
(1, 'Unknown', '< 1 hour', 1, 0, 1),
(2, 'Unknown', '< 1 hour', 1, 0, 1);
