#!/usr/bin/env python3
# 20-main.py — 买家主链路端到端 + 金额诚信(B-3) + 幂等 + 库存回补 + DB 交叉验证
import sys, json, time
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J, show

OUT = {}

print("=" * 72)
print("STEP 0 — 基线 DB 快照")
print("=" * 72)
print("product (id,price,stock):")
print(sql("select id,price,stock from product order by id;"))
print("user1 cart:", sql("select id,user_id,product_id,quantity from shopping_cart where user_id=1;"))
print("user1 row count:", sql("select count(*) from product_order where user_id=1;"))

# ---------------------------------------------------------------- AUTH
print("\n" + "=" * 72)
print("AUTH 认证")
print("=" * 72)
nu = f"qa_b_{int(time.time())}"
print(f"注册新买家 username={nu}")
st, bd, _ = req("PUT", "/common/register", body=json.dumps(
    {"type": "USER", "username": nu, "password": "123456", "nickname": "QA验收用户", "email": f"{nu}@test.com"}),
    cid="AUTH-06")
show("AUTH-06", st, bd, "注册新买家")
print("  DB:", sql(f"select id,username,nickname,email,status,left(password,4) from user where username='{nu}';"))

st, bd, _ = req("PUT", "/common/register", body=json.dumps(
    {"type": "USER", "username": nu, "password": "123456", "nickname": "dup", "email": "x@y.z"}), cid="AUTH-08")
show("AUTH-08", st, bd, "重复用户名注册(应 409)")
print("  DB count:", sql(f"select count(*) from user where username='{nu}';"))

st, bd, _ = req("POST", "/common/login", body=json.dumps({"username": nu, "password": "123456", "type": "USER"}), cid="AUTH-06-login")
d = J(bd) or {}
NTOK = d.get("data") if isinstance(d.get("data"), str) else None
print(f"  [AUTH-06-login] HTTP {st} code={d.get('code')} token_len={len(NTOK) if NTOK else 0}")
if not NTOK:
    print("FATAL: 新用户 token 为空"); sys.exit(1)
open(f"{L}/tokens/newuser.txt", "w").write(NTOK)
NEWID = sql(f"select id from user where username='{nu}';")
print(f"  新用户 id={NEWID} balance={sql(f'select balance from user where id={NEWID};')}")

U1, U2 = tok("user1"), tok("user2")

for cid, body, note in [("AUTH-04", {"username": "user1", "password": "wrong", "type": "USER"}, "错误密码(应 409)"),
                        ("AUTH-05", {"username": "nosuch_zz", "password": "x", "type": "USER"}, "不存在用户(应 409)"),
                        ("AUTH-13", None, "畸形 JSON")]:
    if body is None:
        st, bd, _ = req("POST", "/common/login", body="{", cid=cid)
    else:
        st, bd, _ = req("POST", "/common/login", body=json.dumps(body), cid=cid)
    show(cid, st, bd, note)
st, bd, _ = req("GET", "/common/currentUser", token=U1, cid="AUTH-09")
show("AUTH-09", st, bd, "currentUser(user1)")
st, bd, _ = req("GET", "/common/currentUser", cid="AUTH-12")
show("AUTH-12", st, bd, "匿名 currentUser(应 401)")
st, bd, _ = req("GET", "/common/login", cid="AUTH-14")
show("AUTH-14", st, bd, "GET 方法不支持(应 405)")

# ---------------------------------------------------------------- PAY 金额诚信
print("\n" + "=" * 72)
print("PAY 结算金额诚信(B-3 核心)")
print("=" * 72)
st, bd, _ = req("POST", "/checkout/summary", body=json.dumps({"items": [{"productId": 1, "quantity": 2}]}), cid="PAY-01")
d = show("PAY-01", st, bd, "干净 items 2x99=198")
PAY01 = d.get("data") if d else None

tm = {"items": [{"productId": 1, "quantity": 2, "price": 0.01}], "total": 0.02, "amount": 0.02}
st, bd, _ = req("POST", "/checkout/summary", body=json.dumps(tm), cid="PAY-02")
d = show("PAY-02", st, bd, "篡改 price=0.01/total=0.02", json.dumps(tm))
PAY02 = d.get("data") if d else None

for cid, body, note in [
    ("PAY-04", {"items": []}, "空 items(应 400)"),
    ("PAY-05", {"items": [{"productId": 1, "quantity": 0}]}, "quantity=0(应 400)"),
    ("PAY-05b", {"items": [{"productId": 1, "quantity": -3}]}, "quantity=-3(应 400)"),
    ("PAY-06", {"items": [{"productId": 1}]}, "缺 quantity(应 400)"),
    ("PAY-07", {"items": [{"productId": 999999, "quantity": 1}]}, "商品不存在(应 404)"),
    ("PAY-08", {"items": [{"id": 1, "quantity": 1}]}, "兼容 id 回落(应 200)"),
]:
    st, bd, _ = req("POST", "/checkout/summary", body=json.dumps(body), cid=cid)
    show(cid, st, bd, note)

# ---------------------------------------------------------------- 券
print("\n" + "=" * 72)
print("EXT 优惠券 + PAY-10..16")
print("=" * 72)
st, bd, _ = req("GET", "/coupons", token=NTOK, cid="EXT-07")
d = show("EXT-07", st, bd, "可领券池")
cid10 = None
if d and isinstance(d.get("data"), list):
    for c in d["data"]:
        if c.get("code") == "WELCOME10":
            cid10 = c.get("id")
print(f"  WELCOME10 id={cid10}")

st, bd, _ = req("POST", f"/coupons/{cid10}/claim", token=NTOK, cid="EXT-08")
show("EXT-08", st, bd, "领取 WELCOME10")
print("  DB user_coupon:", sql(f"select id,user_id,coupon_id,status from user_coupon where user_id={NEWID};"))
st, bd, _ = req("POST", f"/coupons/{cid10}/claim", token=NTOK, cid="EXT-09")
show("EXT-09", st, bd, "重复领取(应 409)")
st, bd, _ = req("GET", "/coupons/my-coupons", token=NTOK, cid="EXT-11")
show("EXT-11", st, bd, "我的券")

st, bd, _ = req("POST", "/checkout/promo", token=NTOK, body=json.dumps({"code": "SAVE10", "subtotal": 198}), cid="PAY-13")
show("PAY-13", st, bd, "SAVE10 库中无此码(应 400,不回退)")
st, bd, _ = req("POST", "/checkout/promo", token=NTOK, body=json.dumps({"code": "SAVE20", "subtotal": 150}), cid="PAY-11")
show("PAY-11", st, bd, "未领取 SAVE20(应 400)")
st, bd, _ = req("POST", "/checkout/promo", token=NTOK, body=json.dumps({"subtotal": 100}), cid="PAY-14a")
show("PAY-14a", st, bd, "缺 code(应 400)")
st, bd, _ = req("POST", "/checkout/promo", token=NTOK, body=json.dumps({"code": "X"}), cid="PAY-14b")
show("PAY-14b", st, bd, "缺 subtotal(应 400)")
st, bd, _ = req("POST", "/checkout/promo", body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="PAY-15")
show("PAY-15", st, bd, "匿名 promo(应 400)")
st, bd, _ = req("POST", "/checkout/promo", token=NTOK, body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="PAY-10")
d = show("PAY-10", st, bd, "已领 WELCOME10 (198*10%=19.80)")
PAY10 = d.get("data") if d else None

st, bd, _ = req("POST", "/checkout/summary", body=json.dumps({"items": [{"productId": 1, "quantity": 2}], "code": "WELCOME10"}), cid="PAY-16")
d = show("PAY-16", st, bd, "summary 带 code(匿名)")
PAY16 = d.get("data") if d else None
st, bd, _ = req("POST", "/checkout/summary", token=NTOK, body=json.dumps({"items": [{"productId": 1, "quantity": 2}], "code": "WELCOME10"}), cid="PAY-16b")
d = show("PAY-16b", st, bd, "summary 带 code(新用户,已领券)")
PAY16b = d.get("data") if d else None

# ---------------------------------------------------------------- 下单
print("\n" + "=" * 72)
print("ORD 下单/支付/幂等")
print("=" * 72)
print("  下单前 stock(p1)=", sql("select stock from product where id=1;"), " balance=", sql(f"select balance from user where id={NEWID};"))
cb = {"items": [{"productId": 1, "quantity": 2}], "channel": "card", "remark": "QA-B e2e",
      "shipping": {"name": "QA User", "tel": "13800000001", "address": "测试路1号", "city": "上海", "zip": "200000", "country": "CN"}}
st, bd, _ = req("POST", "/payments/create", token=NTOK, body=json.dumps(cb), cid="ORD-01")
d = show("ORD-01", st, bd, "card 无券下单")
ON_NOC = (d.get("data") or {}).get("paymentId") if d else None
AMT_NOC = (d.get("data") or {}).get("amount") if d else None
print(f"  orderNo={ON_NOC} amount={AMT_NOC}")

tam = {"items": [{"productId": 1, "quantity": 1, "price": 0.01}], "amount": 0.01, "currency": "USD",
       "channel": "card", "shipping": {"name": "QA Tamper", "tel": "1", "address": "测试路2号", "city": "上海"}}
st, bd, _ = req("POST", "/payments/create", token=NTOK, body=json.dumps(tam), cid="ORD-01b")
d = show("ORD-01b", st, bd, "篡改 price/amount 下单")
ON_TAM = (d.get("data") or {}).get("paymentId") if d else None
AMT_TAM = (d.get("data") or {}).get("amount") if d else None
print(f"  orderNo={ON_TAM} amount={AMT_TAM} (DB 价 99 -> 期望 99.00)")

print("  DB 订单行:")
print(sql(f"select order_no,product_id,quantity,total_money,status,consignee_name from product_order where order_no in ('{ON_NOC}','{ON_TAM}');"))
print("  DB payment:")
print(sql(f"select order_no,user_id,amount,channel,status,coalesce(transaction_id,'NULL'),coalesce(paid_at,'NULL') from payment where order_no in ('{ON_NOC}','{ON_TAM}');"))
print("  DB stock:", sql("select stock from product where id=1;"))

st, bd, _ = req("POST", "/payments/confirm", token=NTOK, body=json.dumps({"paymentId": "NOSUCH-ORD"}), cid="ORD-06")
show("ORD-06", st, bd, "confirm 不存在单(应 4xx)")

st, bd, _ = req("POST", "/payments/confirm", token=NTOK, body=json.dumps({"paymentId": ON_NOC}), cid="ORD-04")
show("ORD-04", st, bd, "confirm 真实单")
P1 = sql(f"select order_no,amount,status,coalesce(transaction_id,'NULL'),coalesce(paid_at,'NULL') from payment where order_no='{ON_NOC}';")
print("  payment#1:", P1)
for i in (2, 3):
    st, bd, _ = req("POST", "/payments/confirm", token=NTOK, body=json.dumps({"paymentId": ON_NOC}), cid=f"ORD-05-{i}")
    print(f"  confirm#{i}: HTTP {st} {bd.strip()[:120]}")
P3 = sql(f"select order_no,amount,status,coalesce(transaction_id,'NULL'),coalesce(paid_at,'NULL') from payment where order_no='{ON_NOC}';")
print("  payment#3:", P3)
print("  幂等(payment#1==#3):", P1 == P3)
print("  order rows:", sql(f"select id,status,total_money from product_order where order_no='{ON_NOC}';"))
print("  stock after confirm:", sql("select stock from product where id=1;"))

st, bd, _ = req("POST", "/payments/complete-action", token=NTOK, body=json.dumps({"paymentId": ON_NOC, "transactionId": "t"}), cid="ORD-07")
show("ORD-07", st, bd, "complete-action(幂等)")
print("  payment:", sql(f"select status,coalesce(transaction_id,'NULL') from payment where order_no='{ON_NOC}';"))

st, bd, _ = req("GET", "/orders", token=NTOK, cid="ORD-08")
d = show("ORD-08", st, bd, "新用户订单列表")
st, bd, _ = req("GET", "/orders", token=U1, cid="ORD-10")
d10 = J(bd) or {}
nos = [o.get("orderNo") for o in (d10.get("data") or [])] if isinstance(d10.get("data"), list) else []
print(f"  [ORD-10] user1 orderNo 数={len(nos)} 前6={nos[:6]}")
print(f"  新用户单泄露给 user1: {ON_NOC in nos}")
st, bd, _ = req("GET", "/orders/recent", token=NTOK, cid="ORD-09")
show("ORD-09", st, bd, "recent")

st, bd, _ = req("POST", f"/orders/{ON_NOC}/cancel", token=U2, cid="ORD-11")
show("ORD-11", st, bd, "user2 取消他人订单(应 4xx)")
print("  目标单状态(应未变):", sql(f"select status from product_order where order_no='{ON_NOC}';"))
st, bd, _ = req("POST", "/orders/NOSUCH/cancel", token=NTOK, cid="ORD-16")
show("ORD-16", st, bd, "取消不存在单(应 404)")

# ---------------------------------------------------------------- 库存不足
print("\n" + "=" * 72)
print("ORD-02 库存不足")
print("=" * 72)
s3 = int(sql("select stock from product where id=3;"))
print(f"  product3 stock={s3}, 下单 quantity={s3+5}")
st, bd, _ = req("POST", "/payments/create", token=NTOK, body=json.dumps(
    {"items": [{"productId": 3, "quantity": s3 + 5}], "channel": "card",
     "shipping": {"name": "QA", "tel": "1", "address": "a", "city": "b"}}), cid="ORD-02")
show("ORD-02", st, bd, "超库存下单(应 4xx)")
print("  stock:", s3, "->", sql("select stock from product where id=3;"))
print("  是否产生订单:", sql(f"select count(*) from product_order where user_id={NEWID} and product_id=3;"))

# ---------------------------------------------------------------- 取消+回补
print("\n" + "=" * 72)
print("ORD-12/15 取消 + 库存回补 + 幂等")
print("=" * 72)
print("  取消前 stock(p1):", sql("select stock from product where id=1;"), " balance:", sql(f"select balance from user where id={NEWID};"))
st, bd, _ = req("POST", f"/orders/{ON_NOC}/cancel", token=NTOK, cid="ORD-12")
show("ORD-12", st, bd, "本人取消已支付 card 单")
print("  order rows:", sql(f"select id,status,total_money from product_order where order_no='{ON_NOC}';"))
print("  payment:", sql(f"select status from payment where order_no='{ON_NOC}';"))
print("  stock after cancel:", sql("select stock from product where id=1;"))
print("  balance(应不变):", sql(f"select balance from user where id={NEWID};"))
for i in (2, 3):
    st, bd, _ = req("POST", f"/orders/{ON_NOC}/cancel", token=NTOK, cid=f"ORD-15-{i}")
    print(f"  cancel#{i}: HTTP {st} {bd.strip()[:100]}")
print("  stock after cancel#3:", sql("select stock from product where id=1;"))
print("  balance after cancel#3:", sql(f"select balance from user where id={NEWID};"))

# ---------------------------------------------------------------- balance 渠道
print("\n" + "=" * 72)
print("ORD-03/14 balance 渠道:余额不足 + 扣款 + 退款")
print("=" * 72)
AD = tok("admin")
st, bd, _ = req("PUT", f"/admin/users/{NEWID}", token=AD, body=json.dumps({"name": "QA验收用户", "email": f"{nu}@test.com"}), cid="ORD-14-setup")
print(f"  [setup] PUT /admin/users/{NEWID} -> HTTP {st} {bd.strip()[:120]}")
print("  balance(期望仍 0):", sql(f"select balance from user where id={NEWID};"))

print("  --- 余额不足场景(balance=0,下单 99)")
st, bd, _ = req("POST", "/payments/create", token=NTOK, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 1}], "channel": "balance",
     "shipping": {"name": "QA", "tel": "1", "address": "a", "city": "b"}}), cid="ORD-03-create")
d = show("ORD-03-create", st, bd, "balance 渠道下单(balance=0)")
ON_BAL = (d.get("data") or {}).get("paymentId") if d else None
if ON_BAL:
    print("  payment:", sql(f"select channel,amount,status from payment where order_no='{ON_BAL}';"))
    st, bd, _ = req("POST", "/payments/confirm", token=NTOK, body=json.dumps({"paymentId": ON_BAL}), cid="ORD-03-confirm")
    show("ORD-03-confirm", st, bd, "余额不足确认支付(应 4xx)")
    print("  payment:", sql(f"select channel,amount,status from payment where order_no='{ON_BAL}';"))
    print("  balance:", sql(f"select balance from user where id={NEWID};"))
    st, bd, _ = req("POST", f"/orders/{ON_BAL}/cancel", token=NTOK, cid="ORD-03-cancel")
    show("ORD-03-cancel", st, bd, "取消该未支付 balance 单")
    print("  balance(应仍 0,不能凭空加钱):", sql(f"select balance from user where id={NEWID};"))

# ---------------------------------------------------------------- 工作树 3 个新端点(带 token)
print("\n" + "=" * 72)
print("STF-08/09/10 工作树新增端点(运行态探针)")
print("=" * 72)
for ep in ("related?limit=3", "bought-together?limit=3", "complete-the-look?limit=3"):
    st, bd, _ = req("GET", f"/products/1/{ep}", token=U1, cid="STF-" + ep.split("?")[0])
    d = J(bd) or {}
    n = len(d.get("data") or []) if isinstance(d.get("data"), list) else "n/a"
    print(f"  /products/1/{ep} -> HTTP {st} items={n}")

OUT.update({"newuser": nu, "newid": NEWID, "on_card": ON_NOC, "on_tamper": ON_TAM, "on_balance": ON_BAL,
            "amt_card": AMT_NOC, "amt_tamper": AMT_TAM, "PAY01": PAY01, "PAY02": PAY02,
            "PAY10": PAY10, "PAY16_anon": PAY16, "PAY16_user": PAY16b})
open(f"{L}/out/main.json", "w").write(json.dumps(OUT, ensure_ascii=False, indent=2))
print("\n[OK] 主链路完成 -> " + f"{L}/out/main.json")
print(json.dumps(OUT, ensure_ascii=False, indent=2))
