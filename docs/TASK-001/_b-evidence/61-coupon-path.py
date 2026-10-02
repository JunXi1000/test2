#!/usr/bin/env python3
# 61-coupon-path.py — 券链路完整实证:promo/summary 400 + payments/create 带 code
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

NU = tok("newuser")
M = json.load(open(f"{L}/out/main.json"))
NEWID = M["newid"]

print("=" * 74)
print("1) 已领券状态(DB)")
print("=" * 74)
print("user_coupon:", sql(f"select uc.id,uc.user_id,uc.coupon_id,uc.status,c.code,c.value,c.min_order,c.max_discount from user_coupon uc join coupon c on c.id=uc.coupon_id where uc.user_id={NEWID};"))

print("\n" + "=" * 74)
print("2) /checkout/promo 带 token(已领 WELCOME10, subtotal=198 满足 min_order=0)")
print("=" * 74)
st, bd, _ = req("POST", "/checkout/promo", token=NU, body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="COUPON-promo")
print(f"  -> HTTP {st} {bd.strip()}")

print("\n" + "=" * 74)
print("3) /checkout/summary 带 code + token")
print("=" * 74)
st, bd, _ = req("POST", "/checkout/summary", token=NU, body=json.dumps({"items": [{"productId": 1, "quantity": 2}], "code": "WELCOME10"}), cid="COUPON-summary")
print(f"  -> HTTP {st} {bd.strip()}")

print("\n" + "=" * 74)
print("4) /payments/create 带已领且未用的 code(服务端应能核销)")
print("=" * 74)
before = sql(f"select status from user_coupon where user_id={NEWID} and coupon_id=1;")
print("  下单前 user_coupon.status =", before)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps({
    "items": [{"productId": 1, "quantity": 2}], "channel": "card", "code": "WELCOME10",
    "shipping": {"name": "CPN", "tel": "1", "address": "a", "city": "b"}}), cid="COUPON-create")
d = J(bd) or {}
print(f"  -> HTTP {st} {bd.strip()}")
ON = (d.get("data") or {}).get("paymentId")
print("  DB payment:", sql(f"select order_no,amount,status from payment where order_no='{ON}';"))
print("  DB Σorder:", sql(f"select sum(total_money) from product_order where order_no='{ON}';"))
print("  下单后 user_coupon.status =", sql(f"select status from user_coupon where user_id={NEWID} and coupon_id=1;"))

print("\n" + "=" * 74)
print("5) 同一张券再用一次(应 409/400 已使用)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps({
    "items": [{"productId": 1, "quantity": 1}], "channel": "card", "code": "WELCOME10",
    "shipping": {"name": "CPN2", "tel": "1", "address": "a", "city": "b"}}), cid="COUPON-create2")
print(f"  -> HTTP {st} {bd.strip()}")

print("\n" + "=" * 74)
print("6) 未领取的券 code 直接下单(SAVE20 未领)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps({
    "items": [{"productId": 1, "quantity": 2}], "channel": "card", "code": "SAVE20",
    "shipping": {"name": "CPN3", "tel": "1", "address": "a", "city": "b"}}), cid="COUPON-create3")
print(f"  -> HTTP {st} {bd.strip()}")

print("\n" + "=" * 74)
print("7) 匿名 /checkout/promo(白名单)")
print("=" * 74)
st, bd, _ = req("POST", "/checkout/promo", body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="COUPON-promo-anon")
print(f"  -> HTTP {st} {bd.strip()}")

print("\n结论:promo/summary 的 userId 恒为 null(白名单路径不经 LoginInterceptor);")
print("     /payments/create 的 userId 来自 token(User 实体无余额字段,故用 card 渠道测券核销)。")
