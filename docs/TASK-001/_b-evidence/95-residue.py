#!/usr/bin/env python3
# 95-residue.py — 残留数据清单 + 超时任务观察窗口
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, req, J

print("=" * 74)
print("残留数据清单(TASK-002-D 通过 API 产生)")
print("=" * 74)
print("tables:", sql("select count(*) from information_schema.tables where table_schema='template_v3';"), "(V6~V11 未应用)")
print("user 总数:", sql("select count(*) from user;"))
print("  QA 测试用户:", repr(sql("select id,username from user where username like 'qa_%' or username like 'test@%' or username in ('user1','user2') order by id;")))
print("product:", sql("select id,name,stock,sales_volume from product order by id;"))
print("product_order 总数:", sql("select count(*) from product_order;"))
print("  状态分布:", repr(sql("select status,count(*),coalesce(sum(total_money),0) from product_order group by status;")))
print("payment 总数:", sql("select count(*) from payment;"))
print("  状态分布:", repr(sql("select status,count(*),sum(amount) from payment group by status;")))
print("user_coupon:", repr(sql("select id,user_id,coupon_id,status from user_coupon;")))
print("shipping_address:", repr(sql("select id,user_id,name from shipping_address;")))
print("shopping_cart:", repr(sql("select id,user_id,product_id,quantity from shopping_cart;")))
print("return_request:", repr(sql("select id,user_id,status from return_request;")))
print("stock_alert:", repr(sql("select id,user_id,product_id from stock_alert;")))
print("user_notification_pref:", repr(sql("select * from user_notification_pref;")))
print("payment 表是否存在 V6~V11 表:", repr(sql("select table_name from information_schema.tables where table_schema='template_v3' and table_name in ('merchant_wallet','admin_setting','merchant_setting','merchant_wallet_transaction');")))

print("\n" + "=" * 74)
print("30min 超时任务观察窗口(OrderTimeoutTask)")
print("=" * 74)
print("最早待支付单:", repr(sql("select order_no,create_time,timestampdiff(minute,create_time,now()) as age_min from product_order where status='待支付' order by create_time limit 1;")))
print("最早订单:", repr(sql("select order_no,create_time,timestampdiff(minute,create_time,now()) as age_min from product_order order by create_time limit 1;")))
print("now:", sql("select now();"))
print("→ 结论:最老订单 age 远小于 30min(本轮所有订单都在 21:12~22:2x 之间创建),")
print("  故超时自动取消**无可观察窗口**,该用例本轮仍标 BLOCKED(与 TASK-001 相同)。")
