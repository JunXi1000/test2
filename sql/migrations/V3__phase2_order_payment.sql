-- ============================================================
-- V3 Phase 2 主链路:product_order 加 order_no 分组字段 + payment 支付表
-- 日期: 2026-08-25  (与 Phase 2「结算→支付→订单→购物车」配套)
--
-- 说明: 一次性 ALTER,生产库仅执行一次。导入需 --default-character-set=utf8mb4
--       (否则中文默认值/注释双重编码乱码)。
-- ============================================================

-- 订单分组号:扁平 product_order 每行一单,同一结算批次共享一个 order_no;
-- 存量行(order_no NULL)各自成组,后台/商家订单管理不受影响。
ALTER TABLE product_order ADD COLUMN order_no VARCHAR(64) NULL AFTER id;
ALTER TABLE product_order ADD INDEX idx_order_no (order_no);

-- 支付单:一次结算一张,order_no 唯一(幂等兜底)。
-- status: 待支付 -> 已支付 / 已取消 / 已超时
CREATE TABLE IF NOT EXISTS payment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL,
  user_id INT,
  amount DECIMAL(10,2) DEFAULT 0.00,
  channel VARCHAR(20) DEFAULT 'card',
  transaction_no VARCHAR(64),
  status VARCHAR(20) DEFAULT '待支付',
  paid_time DATETIME,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_order_no (order_no)
) COMMENT '支付记录(Phase 2 模拟网关)';
