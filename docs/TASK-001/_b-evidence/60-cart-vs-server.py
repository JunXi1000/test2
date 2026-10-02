#!/usr/bin/env python3
# 60-cart-vs-server.py — B-4:购物车页价 vs 结算页价 vs 实扣额(用真实 cart 行)
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

U1 = tok("user1")
print("=" * 74)
print("购物车当前内容(user1)")
print("=" * 74)
rows = sql("select sc.id,sc.product_id,p.name,p.price,sc.quantity from shopping_cart sc join product p on p.id=sc.product_id where sc.user_id=1;")
print(rows)
items, cart_ids = [], []
subtotal = 0.0
for line in rows.splitlines():
    if not line.strip():
        continue
    rid, pid, name, price, qty = line.split("\t")
    items.append({"productId": int(pid), "quantity": int(qty)})
    cart_ids.append(int(rid))
    subtotal += float(price) * int(qty)
print("  小计(前端 cartStore.subtotal 应为):", round(subtotal, 2))

FREE_SHIPPING_THRESHOLD = 200   # Cart.vue 常量(见源码)
SHIPPING_FEE = 12
TAX_RATE = 0.08
shipping = 0 if subtotal >= FREE_SHIPPING_THRESHOLD else SHIPPING_FEE
tax = round(subtotal * TAX_RATE, 2)
TIERS = [(100, 10), (200, 30), (300, 60)]
tiered = max([d for th, d in TIERS if subtotal >= th], default=0)
cart_total = round(subtotal + shipping + tax - tiered, 2)
print(f"  Cart.vue 口径: shipping={shipping} tax={tax} tieredDiscount={tiered} => total={cart_total}")

print("\n" + "=" * 74)
print("服务端结算口径")
print("=" * 74)
st, bd, _ = req("POST", "/checkout/summary", body=json.dumps({"items": items}), cid="PAY-CART-summary")
d = J(bd) or {}
print(f"  POST /checkout/summary -> HTTP {st} {bd.strip()}")
srv_sub = (d.get("data") or {}).get("subtotal")
srv_total = (d.get("data") or {}).get("total")

print("\n" + "=" * 74)
print("实际扣款(/payments/create)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=U1, body=json.dumps({
    "items": items, "channel": "card", "cartItemIds": cart_ids,
    "shipping": {"name": "user", "tel": "13800000001", "address": "上海市浦东新区测试路 1 号", "city": "上海"}}), cid="PAY-CART-create")
d = J(bd) or {}
order_no = (d.get("data") or {}).get("paymentId")
amount = (d.get("data") or {}).get("amount")
print(f"  /payments/create -> HTTP {st} orderNo={order_no} amount={amount}")
print("  DB payment.amount:", sql(f"select amount,channel,status from payment where order_no='{order_no}';"))
print("  DB Σproduct_order.total_money:", sql(f"select sum(total_money) from product_order where order_no='{order_no}';"))

print("\n" + "=" * 74)
print("三方对拍")
print("=" * 74)
print(f"  购物车页显示 total = {cart_total}")
print(f"  结算页摘要 total   = {srv_total}   (subtotal={srv_sub})")
print(f"  实际扣款 amount    = {amount}")
print(f"  差异(购物车 - 实扣) = {round(cart_total - float(amount), 2)}")
print(f"  差异(购物车 - 结算页) = {round(cart_total - float(srv_total), 2)}")
print("  购物车页多显示的行:", [k for k, v in (("shipping", shipping), ("tax", tax), ("tieredDiscount", tiered)) if v])
print("\n  /checkout/summary 响应体字段:", sorted((d.get('data') or {}).keys()))
