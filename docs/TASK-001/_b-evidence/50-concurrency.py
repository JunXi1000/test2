#!/usr/bin/env python3
# 50-concurrency.py — 并发不超卖 + 并发 confirm 幂等 + 重复取消幂等
import sys, json, threading, time
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

NU = tok("newuser")
M = json.load(open(f"{L}/out/main.json"))
NEWID = M["newid"]

print("=" * 74)
print("EX-13 并发下单不超卖(product 3)")
print("=" * 74)
s3 = int(sql("select stock from product where id=3;"))
print("  stock before =", s3)
N = 8
QTY = 2   # 8 线程 x 2 = 16 < 20,改为超过库存:s3=20 → 用 QTY=3 => 24 > 20
QTY = 3
print(f"  {N} 线程 x {QTY} 件 = {N*QTY} > stock {s3}")
res = [None] * N
lock = threading.Lock()


def worker(i):
    st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps({
        "items": [{"productId": 3, "quantity": QTY}], "channel": "card",
        "shipping": {"name": f"CC{i}", "tel": "1", "address": "a", "city": "b"}}), cid=f"CONC-{i}")
    with lock:
        res[i] = (st, bd[:160])


ts = [threading.Thread(target=worker, args=(i,)) for i in range(N)]
t0 = time.time()
for t in ts: t.start()
for t in ts: t.join()
dt = time.time() - t0
ok = sum(1 for r in res if r and r[0] == 200)
fail = N - ok
print(f"  耗时 {dt:.2f}s  成功={ok} 失败={fail}")
for i, r in enumerate(res):
    print(f"   #{i}: {r[0]} {r[1]}")
s3_after = int(sql("select stock from product where id=3;"))
print(f"  stock: {s3} -> {s3_after}  (理论成功件数 <= {s3})")
print(f"  成功件数 = {ok*QTY}  期望 <= {s3}")
print(f"  是否超卖: {'NO(OK)' if ok*QTY <= s3 and s3_after >= 0 else 'YES(BUG)'}")
print("  DB product3 订单行数:", sql(f"select count(*) from product_order where product_id=3 and user_id={NEWID};"))
print("  DB product3 stock:", sql("select stock from product where id=3;"))

print("\n" + "=" * 74)
print("EX-07 并发 confirm 幂等(同一支付单 6 线程)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps({
    "items": [{"productId": 2, "quantity": 1}], "channel": "card",
    "shipping": {"name": "CONF", "tel": "1", "address": "a", "city": "b"}}), cid="CONC-CONF-create")
d = J(bd) or {}
ON = (d.get("data") or {}).get("paymentId")
print("  单号:", ON, " DB payment:", sql(f"select order_no,status,coalesce(transaction_no,'NULL') from payment where order_no='{ON}';"))
N2 = 6
r2 = [None] * N2


def w2(i):
    st, bd, _ = req("POST", "/payments/confirm", token=NU, body=json.dumps({"paymentId": ON}), cid=f"CONC-CONF-{i}")
    with lock:
        r2[i] = (st, bd[:120])


ts = [threading.Thread(target=w2, args=(i,)) for i in range(N2)]
for t in ts: t.start()
for t in ts: t.join()
print("  并发 confirm 结果:", [r[0] for r in r2])
print("  DB payment:", sql(f"select order_no,status,coalesce(transaction_no,'NULL'),coalesce(paid_time,'NULL') from payment where order_no='{ON}';"))
print("  DB 订单行数(应 1):", sql(f"select count(*) from product_order where order_no='{ON}';"))
print("  DB 订单状态:", sql(f"select id,status from product_order where order_no='{ON}';"))
print("  DB stock p2:", sql("select stock from product where id=2;"))

print("\n" + "=" * 74)
print("EX-09 并发取消幂等(balance 单,存量余额可回补需 balance>0 → 用 card 单验证库存只回补一次)")
print("=" * 74)
st, bd, _ = req("POST", "/payments/create", token=NU, body=json.dumps({
    "items": [{"productId": 2, "quantity": 2}], "channel": "card",
    "shipping": {"name": "CANC", "tel": "1", "address": "a", "city": "b"}}), cid="CONC-CANC-create")
d = J(bd) or {}
ONC = (d.get("data") or {}).get("paymentId")
print("  单号:", ONC, " stock(2)=", sql("select stock from product where id=2;"))
req("POST", "/payments/confirm", token=NU, body=json.dumps({"paymentId": ONC}), cid="CONC-CANC-confirm")
print("  confirm 后 stock(2)=", sql("select stock from product where id=2;"), " payment=", sql(f"select status from payment where order_no='{ONC}';"))
N3 = 5
r3 = [None] * N3


def w3(i):
    st, bd, _ = req("POST", f"/orders/{ONC}/cancel", token=NU, cid=f"CONC-CANC-{i}")
    with lock:
        r3[i] = (st, bd[:80])


ts = [threading.Thread(target=w3, args=(i,)) for i in range(N3)]
for t in ts: t.start()
for t in ts: t.join()
print("  并发 cancel 状态码:", [r[0] for r in r3])
print("  stock(2) after =", sql("select stock from product where id=2;"))
print("  payment =", sql(f"select status from payment where order_no='{ONC}';"))
