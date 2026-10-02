#!/usr/bin/env python3
# 32-verify2.py — 过滤器生效性对拍 + confirm 返回号 vs DB + 余额渠道全链路
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J, show

AD, NU = tok("admin"), tok("newuser")
M = json.load(open(f"{L}/out/main.json"))

print("=" * 74)
print("A) /admin/orders?q= 是否真的过滤(用可区分的收货人)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps(
    {"items": [{"productId": 2, "quantity": 1}], "channel": "card",
     "shipping": {"name": "ZZUNIQUENAME", "tel": "1", "address": "z", "city": "z"}}), cid="ADM-14-setup")
d = J(bd) or {}
ON_UNIQ = (d.get("data") or {}).get("paymentId")
print("  新单(收货人 ZZUNIQUENAME):", ON_UNIQ)
st, bd, _ = req("GET", "/admin/orders?q=ZZUNIQUENAME", token=AD, cid="ADM-14-q1")
d1 = J(bd) or {}
st, bd, _ = req("GET", "/admin/orders?q=不存在关键字xyz", token=AD, cid="ADM-14-q2")
d2 = J(bd) or {}
st, bd, _ = req("GET", "/admin/orders", token=AD, cid="ADM-14-q0")
d0 = J(bd) or {}
print(f"  q=ZZUNIQUENAME -> {len(d1.get('data') or [])} 项: {[o.get('id') for o in (d1.get('data') or [])]}")
print(f"  q=xyz不存在   -> {len(d2.get('data') or [])} 项")
print(f"  无 q          -> {len(d0.get('data') or [])} 项")
print("  DB 全部订单:", sql("select id,order_no,consignee_name,status from product_order order by id;"))

print("\n" + "=" * 74)
print("B) confirm 返回的 orderId vs DB 实际扣款(余额渠道)")
print("=" * 74)
print("  balance before:", sql(f"select balance from user where id={M['newid']};"))
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 1}], "channel": "balance",
     "shipping": {"name": "QA BAL", "tel": "1", "address": "a", "city": "b"}}), cid="ORD-14b-create")
d = show("ORD-14b-create", st, bd, "balance 渠道下单(balance=0)")
ONB = (d.get("data") or {}).get("paymentId") if d else None
print("  DB payment:", sql(f"select order_no,user_id,amount,channel,status from payment where order_no='{ONB}';"))
print("  -- 用 orderId 字段(而非 paymentId)confirm:")
st, bd, _ = req("POST", "/payments/confirm", token=NU, body=json.dumps({"orderId": ONB}), cid="ORD-14b-confirm")
show("ORD-14b-confirm", st, bd, "余额不足应 409")
print("  DB payment after:", sql(f"select order_no,status from payment where order_no='{ONB}';"))
print("  balance after:", sql(f"select balance from user where id={M['newid']};"))
print("  DB order rows:", sql(f"select id,order_no,status,total_money from product_order where order_no='{ONB}';"))

print("\n" + "=" * 74)
print("C) 检查 confirm 是否真会把 payment 置已支付(用 card 单,复核)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 1}], "channel": "card",
     "shipping": {"name": "QA CARD2", "tel": "1", "address": "a", "city": "b"}}), cid="ORD-04b-create")
d = J(bd) or {}
ONC = (d.get("data") or {}).get("paymentId")
print("  单号:", ONC, " DB payment:", sql(f"select order_no,status,coalesce(transaction_no,'NULL'),coalesce(paid_time,'NULL') from payment where order_no='{ONC}';"))
st, bd, _ = req("POST", "/payments/confirm", token=NU, body=json.dumps({"paymentId": ONC}), cid="ORD-04b-confirm")
show("ORD-04b-confirm", st, bd, "confirm")
print("  DB payment:", sql(f"select order_no,status,coalesce(transaction_no,'NULL'),coalesce(paid_time,'NULL') from payment where order_no='{ONC}';"))
print("  DB order:", sql(f"select id,status,total_money from product_order where order_no='{ONC}';"))
print("  DB stock p1:", sql("select stock from product where id=1;"))
print("  user1 balance(必须不变):", sql("select balance from user where id=1;"))

print("\n" + "=" * 74)
print("D) 越权:他人订单详情 / 商家订单详情 / 地址 / 购物车(汇总)")
print("=" * 74)
st, bd, _ = req("GET", f"/merchant/orders/2", token=tok("shop2"), cid="ORD-23")
show("ORD-23", st, bd, "shop2 读 shop1 的订单 id=2")
st, bd, _ = req("PUT", "/merchant/orders/2/status", token=tok("shop2"), body=json.dumps({"status": "shipped"}), cid="ORD-22")
show("ORD-22", st, bd, "shop2 改 shop1 订单状态")
print("  DB 订单 2 状态(应未变):", sql("select id,status from product_order where id=2;"))
st, bd, _ = req("DELETE", "/addresses/1", token=NU, cid="EXT-06")
show("EXT-06", st, bd, "新用户删 user1 的地址 id=1")
print("  DB 地址 1 是否还在:", sql("select count(*) from shipping_address where id=1;"))

print("\n[OK] 32-verify2 完成")
