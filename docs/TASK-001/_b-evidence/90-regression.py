#!/usr/bin/env python3
# 90-regression.py — task-10 第 5 步:无新增失败的关键路径回归(真实验收线)
import sys, json, threading, time
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

U1 = tok("user1"); U2 = tok("user2"); AD = tok("admin"); SH = tok("shop1")
PASS = []; FAIL = []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}  {detail}")


print("=" * 78)
print("A) 授权矩阵(期望来自 AuthzRules + 白名单)")
print("=" * 78)
CASES = [
    ("GET", "/orders", (401, 200, 403, 403)),
    ("GET", "/merchant/dashboard/stats", (401, 403, 200, 403)),
    ("GET", "/admin/dashboard/stats", (401, 403, 403, 200)),
    ("POST", "/checkout/summary", (401, 200, 403, 403)),      # C0 新增
    ("POST", "/checkout/promo", (401, 200, 403, 403)),        # C0 新增
    ("GET", "/shoppingCart/list", (401, 403, 403, 403)),
    ("GET", "/admin-accounts/list", (401, 403, 403, 403)),
]
TOK = {"anon": None, "USER": U1, "SHOP": SH, "ADMIN": AD}
for m, p, exp in CASES:
    got = []
    for who in ("anon", "USER", "SHOP", "ADMIN"):
        # summary/promo 需要 body,否则 400 会掩盖鉴权结果 ⇒ 带最小 body
        body = None
        if p == "/checkout/summary":
            body = json.dumps({"items": [{"productId": 1, "quantity": 1}]})
        if p == "/checkout/promo":
            body = json.dumps({"code": "WELCOME10", "subtotal": 100})
        st, bd, _ = req(m, p, token=TOK[who], body=body, cid=f"REG-AUTHZ-{p.replace('/','_')}-{who}")
        got.append(st)
    check(f"{m} {p}", tuple(got) == exp, f"exp={exp} got={tuple(got)}")

print("\n" + "=" * 78)
print("B) 买家主链路(下单→支付→幂等→取消→库存回补)")
print("=" * 78)
nu = f"qa_reg_{int(time.time())}"
req("PUT", "/common/register", body=json.dumps(
    {"type": "USER", "username": nu, "password": "123456", "nickname": "QA回归", "email": f"{nu}@t.com"}), cid="REG-reg")
st, bd, _ = req("POST", "/common/login", body=json.dumps({"username": nu, "password": "123456", "type": "USER"}), cid="REG-login")
NT = (J(bd) or {}).get("data")

s_before = int(sql("select stock from product where id=1;"))
st, bd, _ = req("POST", "/payments/create", token=NT, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 2}], "channel": "card",
     "shipping": {"name": "QA回归", "tel": "1", "address": "a", "city": "b"}}), cid="REG-create")
on = (J(bd) or {}).get("data", {}).get("paymentId")
check("下单 200", st == 200 and on, f"HTTP {st} orderNo={on}")
check("库存原子扣减", int(sql("select stock from product where id=1;")) == s_before - 2,
      f"{s_before} -> {sql('select stock from product where id=1;')}")
st, bd, _ = req("POST", "/payments/confirm", token=NT, body=json.dumps({"paymentId": on}), cid="REG-confirm")
p1 = sql(f"select status from payment where order_no='{on}';")
check("支付 200 且 payment=已支付", st == 200 and p1 == "已支付", f"HTTP {st} payment={p1}")
for i in (2, 3):
    req("POST", "/payments/confirm", token=NT, body=json.dumps({"paymentId": on}), cid=f"REG-confirm-{i}")
p2 = sql(f"select status from payment where order_no='{on}';")
check("confirm 幂等", p1 == p2, f"after3={p2}")
st, bd, _ = req("POST", f"/orders/{on}/cancel", token=NT, cid="REG-cancel")
o_st = sql(f"select status from product_order where order_no='{on}';")
s_after = int(sql("select stock from product where id=1;"))
check("取消 200 且回补库存", st == 200 and o_st == "已取消" and s_after == s_before,
      f"HTTP {st} status={o_st} stock={s_after}")
for i in (2, 3):
    req("POST", f"/orders/{on}/cancel", token=NT, cid=f"REG-cancel-{i}")
check("取消幂等(库存只回补一次)", int(sql("select stock from product where id=1;")) == s_before,
      f"after3={sql('select stock from product where id=1;')}")
st, bd, _ = req("POST", f"/orders/{on}/cancel", token=U2, cid="REG-cancel-other")
check("越权取消 403", st == 403, f"HTTP {st}")

print("\n" + "=" * 78)
print("C) 边界:库存不足 / 篡改金额")
print("=" * 78)
s3 = int(sql("select stock from product where id=3;"))
st, bd, _ = req("POST", "/payments/create", token=NT, body=json.dumps(
    {"items": [{"productId": 3, "quantity": s3 + 5}], "channel": "card",
     "shipping": {"name": "x", "tel": "1", "address": "a", "city": "b"}}), cid="REG-oos")
check("超库存 → 4xx 且库存不变", st >= 400 and int(sql("select stock from product where id=3;")) == s3,
      f"HTTP {st} stock={sql('select stock from product where id=3;')}")

print("\n" + "=" * 78)
print("D) 并发:下单不超卖 + confirm 幂等")
print("=" * 78)
s2 = int(sql("select stock from product where id=2;"))
N = 6
res = [None] * N
lk = threading.Lock()


def w(i):
    st, bd, _ = req("POST", "/payments/create", token=NT, body=json.dumps(
        {"items": [{"productId": 2, "quantity": 3}], "channel": "card",
         "shipping": {"name": f"C{i}", "tel": "1", "address": "a", "city": "b"}}), cid=f"REG-CONC-{i}")
    with lk:
        res[i] = st


ts = [threading.Thread(target=w, args=(i,)) for i in range(N)]
for t in ts: t.start()
for t in ts: t.join()
ok = sum(1 for r in res if r == 200)
s2a = int(sql("select stock from product where id=2;"))
check("并发不超卖(stock>=0 且成功数×3<=原库存)", s2a >= 0 and ok * 3 <= s2 + ok * 3 and s2a == s2 - ok * 3,
      f"成功={ok} stock {s2}->{s2a} 期望={s2 - ok * 3}")

st, bd, _ = req("POST", "/payments/create", token=NT, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 1}], "channel": "card",
     "shipping": {"name": "CC", "tel": "1", "address": "a", "city": "b"}}), cid="REG-CONC-CONF-create")
onc = (J(bd) or {}).get("data", {}).get("paymentId")
r2 = [None] * 5


def w2(i):
    st, bd, _ = req("POST", "/payments/confirm", token=NT, body=json.dumps({"paymentId": onc}), cid=f"REG-CONC-CONF-{i}")
    with lk:
        r2[i] = st


ts = [threading.Thread(target=w2, args=(i,)) for i in range(5)]
for t in ts: t.start()
for t in ts: t.join()
rows = sql(f"select count(*) from product_order where order_no='{onc}';")
pay = sql(f"select status from payment where order_no='{onc}';")
check("并发 confirm 幂等", all(x == 200 for x in r2) and rows == "1" and pay == "已支付",
      f"codes={r2} rows={rows} pay={pay}")

print("\n" + "=" * 78)
print("E) 后台真实聚合端点(与 DB 交叉验证)")
print("=" * 78)
st, bd, _ = req("GET", "/admin/dashboard/stats", token=AD, cid="REG-ADM-stats")
d = J(bd) or {}
vals = {i["label"]: i["value"] for i in (d.get("data") or [])}
db_rev = sql("select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成');")
check("admin stats Total Revenue == DB 聚合", vals.get("Total Revenue") == f"${float(db_rev):.2f}",
      f"api={vals.get('Total Revenue')} db={db_rev}")
st, bd, _ = req("GET", "/merchant/dashboard/stats", token=SH, cid="REG-MER-stats")
d = J(bd) or {}
mvals = {i["label"]: i["value"] for i in (d.get("data") or [])}
db_shop = sql("select coalesce(sum(total_money),0) from product_order where shop_id=1 and status in ('待发货','待收货','已完成');")
check("merchant stats Total Sales == DB 聚合", mvals.get("Total Sales") == f"${float(db_shop):.2f}",
      f"api={mvals.get('Total Sales')} db={db_shop}")
st, bd, _ = req("GET", "/products/category-counts", cid="REG-catcounts")
d = J(bd) or {}
dball = int(sql("select count(*) from product;"))
check("category-counts All == DB 商品数", (d.get("data") or {}).get("All") == dball,
      f"api={(d.get('data') or {}).get('All')} db={dball}")
st, bd, _ = req("GET", "/admin/dashboard/revenue-chart?days=7", token=AD, cid="REG-rev")
d = J(bd) or {}
today = time.strftime("%Y-%m-%d")
val_today = [p["value"] for p in (d.get("data") or []) if p["date"] == today]
db_today = sql("select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成') and date(create_time)=curdate();")
check("revenue-chart 今日 == DB 今日", bool(val_today) and float(val_today[0]) == float(db_today),
      f"api={val_today} db={db_today}")

print("\n" + "=" * 78)
print(f"汇总: PASS={len(PASS)}  FAIL={len(FAIL)}")
if FAIL:
    print("失败项:")
    for f in FAIL:
        print("  -", f)
print("=" * 78)
json.dump({"pass": PASS, "fail": FAIL}, open(f"{L}/out/regression.json", "w"), ensure_ascii=False, indent=2)
