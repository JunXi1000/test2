-- ============================================================
-- V2 金额精度加固:DOUBLE/FLOAT -> DECIMAL(10,2)
-- 日期: 2026-08-10  (与 Phase A-9 配套)
--
-- 说明: 幂等性弱(重复执行会报错或重复加约束),生产库仅执行一次。
-- ============================================================

ALTER TABLE `user` MODIFY COLUMN `balance` DECIMAL(10,2) DEFAULT 0.00 COMMENT '余额';
ALTER TABLE `product` MODIFY COLUMN `price` DECIMAL(10,2) DEFAULT 0.00 COMMENT '价格';
ALTER TABLE `product_order` MODIFY COLUMN `total_money` DECIMAL(10,2) DEFAULT 0.00 COMMENT '总金额';
