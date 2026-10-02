#!/usr/bin/env python3
# 70-final-snapshot.py — 最终状态快照(报告用)
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

print("=" * 74)
print("FINAL DB 快照")
print("=" * 74)
print("tables:", sql("select count(*) from information_schema.tables where table_schema='template_v3';"))
print("product:", sql("select id,name,price,stock,sales_volume from product order by id;"))
print("product_order count:", sql("select count(*) from product_order;"))
print("订单状态分布:", repr(sql("select status,count(*),coalesce(sum(total_money),0) from product_order group by status;")))
print("payment:", sql("select order_no,amount,channel,status,coalesce(transaction_no,'-') from payment order by id;"))
print("user_coupon:", sql("select id,user_id,coupon_id,status from user_coupon;"))
print("user:", sql("select id,username,status,balance from user order by id;"))
print("shop:", sql("select id,name,status from shop;"))
print("shopping_cart:", repr(sql("select id,user_id,product_id,quantity from shopping_cart;")))
print("shipping_address:", sql("select id,user_id,name from shipping_address;"))
print("return_request:", sql("select id,user_id,order_id,status,refund_amount from return_request;"))
print("stock_alert:", repr(sql("select id,user_id,product_id from stock_alert;")))

print("\n" + "=" * 74)
print("关键证据复核(直接打印原始 http 文件)")
print("=" * 74)
for f, label in [("PAY-02", "篡改 price 的 summary"),
                 ("ORD-01b", "篡改 price/amount 的 create"),
                 ("COUPON-promo", "promo 带 token 400"),
                 ("COUPON-create", "payments/create 带 code 成功核销"),
                 ("ORD-11", "越权取消 403"),
                 ("CONC-CANC-2", "并发取消中的一次")]:
    try:
        raw = open(f"{L}/resp/{f}.http").read()
        print(f"\n--- {f} ({label}) ---")
        print(raw[:700])
    except Exception as e:
        print(f"--- {f}: {e}")

print("\n" + "=" * 74)
print("运行态/环境")
print("=" * 74)
import subprocess
for cmd in ["ps -o lstart= -p $(pgrep -f '[P]rojectManagement' | head -1)",
            "ls -l --time-style=full-iso /workspace/src/main/java/com/project/platform/controller/StorefrontCheckoutController.java"]:
    p = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
    print(" ", p.stdout.strip() or p.stderr.strip())
