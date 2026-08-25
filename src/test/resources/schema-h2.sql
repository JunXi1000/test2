-- H2-compatible schema for integration tests (MySQL MODE)
-- Mirrors sql/templatev3_s.sql + sql/chat.sql

CREATE TABLE IF NOT EXISTS admin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255),
  password VARCHAR(255),
  nickname VARCHAR(255),
  avatar_url VARCHAR(255),
  tel VARCHAR(255),
  email VARCHAR(255),
  status VARCHAR(128),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_type (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  remark VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  main_img VARCHAR(500),
  img_list VARCHAR(1000),
  product_type_id INT,
  price DECIMAL(10,2) DEFAULT 0.00,
  stock INT DEFAULT 0,
  sales_volume INT DEFAULT 0,
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
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipping_address (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  tel VARCHAR(255),
  address VARCHAR(500),
  user_id INT,
  username VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  user_id INT,
  quantity INT DEFAULT 1,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_collect (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT,
  product_name VARCHAR(255),
  user_id INT,
  username VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_collect (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT,
  shop_name VARCHAR(255),
  shop_avatar VARCHAR(500),
  user_id INT,
  user_name VARCHAR(255),
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  value DOUBLE DEFAULT 0,
  min_order DOUBLE DEFAULT 0,
  max_discount DOUBLE,
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
  refund_amount DOUBLE DEFAULT 0,
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
