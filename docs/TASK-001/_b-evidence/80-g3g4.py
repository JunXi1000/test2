#!/usr/bin/env python3
# 80-g3g4.py — TASK-002-D 验收目标真实 HTTP 实测(G3/G4/C5/C6 + 决定性对照)
import sys, json, time
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

OUT = {}
U1 = tok("user1")
AD = tok("admin")
SH = tok("shop1")


def new_user():
    nu = f"qa_d_{int(time.time())}"
    st, bd, _ = req("PUT", "/common/register", body=json.dumps(
        {"type": "USER", "username": nu, "password": "123456", "nickname": "QA-D 用户", "email": f"{nu}@test.com"}),
        cid="D-AUTH-register")
    print(f"  注册 {nu} -> HTTP {st}")
    st, bd, _ = req("POST", "/common/login", body=json.dumps(
        {"username": nu, "password": "123456", "type": "USER"}), cid="D-AUTH-login")
    d = J(bd) or {}
    token = d.get("data") if isinstance(d.get("data"), str) else None
    uid = sql(f"select id from user where username='{nu}';")
    print(f"  登录 -> HTTP {st} uid={uid} token_len={len(token) if token else 0}")
    return nu, uid, token


def claim(token, code, uid, cid):
    """走真实 HTTP 领券(而非直连写库):GET /coupons 找 id → POST /coupons/{id}/claim"""
    st, bd, _ = req("GET", "/coupons", token=token, cid=f"{cid}-list")
    d = J(bd) or {}
    cidnum = None
    for c in (d.get("data") or []):
        if c.get("code") == code:
            cidnum = c.get("id")
    print(f"  券池里 {code} id={cidnum} (HTTP {st})")
    st, bd, _ = req("POST", f"/coupons/{cidnum}/claim", token=token, cid=f"{cid}-claim")
    print(f"  领取 {code} -> HTTP {st} {bd.strip()[:120]}")
    print("  DB user_coupon:", sql(f"select id,user_id,coupon_id,status from user_coupon where user_id={uid};"))
    return cidnum


print("=" * 78)
print("G3 / BLK-1:券链路(登录 + 已领券 → promo 200;匿名 → 401)")
print("=" * 78)
nu, uid, NTOK = new_user()
claim(NTOK, "WELCOME10", uid, "D-G3")

# 决定性对照:同一 token 打 /addresses 与 /checkout/promo 都应 200
st_addr, bd_addr, _ = req("GET", "/addresses", token=NTOK, cid="D-G3-addresses")
print(f"\n[决定性对照] 同一 token:")
print(f"  GET  /addresses        -> HTTP {st_addr}  {bd_addr.strip()[:90]}")
st_promo, bd_promo, _ = req("POST", "/checkout/promo", token=NTOK,
                            body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="D-G3-promo")
d = J(bd_promo) or {}
print(f"  POST /checkout/promo   -> HTTP {st_promo}  {bd_promo.strip()[:200]}")
OUT["g3_addresses"] = st_addr
OUT["g3_promo"] = st_promo
OUT["g3_promo_data"] = d.get("data")

# 减免正确性:198 * 10% = 19.80
disc = (d.get("data") or {}).get("discount")
print(f"  → discount={disc} (期望 19.80)  {'✅' if disc == 19.8 else '❌'}")

# 匿名 → 401
st_a1, bd_a1, _ = req("POST", "/checkout/promo", body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="D-G3-promo-anon")
print(f"\n  匿名 POST /checkout/promo -> HTTP {st_a1} {bd_a1.strip()[:120]}")
st_a2, bd_a2, _ = req("POST", "/checkout/summary", body=json.dumps({"items": [{"productId": 1, "quantity": 1}]}), cid="D-G3-summary-anon")
print(f"  匿名 POST /checkout/summary -> HTTP {st_a2} {bd_a2.strip()[:120]}")
OUT["g3_promo_anon"] = st_a1
OUT["g3_summary_anon"] = st_a2

print("\n" + "=" * 78)
print("G4 / BLK-4 / BLK-5:金额四方一致(含用券)")
print("=" * 78)


def four_way(label, token, items, code=None, cid=""):
    body = {"items": items}
    if code:
        body["code"] = code
    st, bd, _ = req("POST", "/checkout/summary", token=token, body=json.dumps(body), cid=f"{cid}-summary")
    d = J(bd) or {}
    sdata = d.get("data") or {}
    print(f"\n[{label}] summary -> HTTP {st} {bd.strip()[:200]}")
    st2, bd2, _ = req("POST", "/payments/create", token=token, body=json.dumps(
        {**body, "channel": "card",
         "shipping": {"name": "QA-D", "tel": "13800000001", "address": "测试路 9 号", "city": "上海"}}),
        cid=f"{cid}-create")
    d2 = J(bd2) or {}
    cdata = d2.get("data") or {}
    print(f"[{label}] create  -> HTTP {st2} {bd2.strip()[:200]}")
    on = cdata.get("paymentId")
    pay_amt = sql(f"select amount from payment where order_no='{on}';")
    sum_rows = sql(f"select coalesce(sum(total_money),0) from product_order where order_no='{on}';")
    sub = sdata.get("subtotal")
    tot = sdata.get("total")
    amt = cdata.get("amount")
    print(f"[{label}] 四方: summary.total={tot} | create.amount={amt} | payment.amount={pay_amt} | Σ order.total_money={sum_rows}")
    ok = (tot == amt) and (float(pay_amt or -1) == float(amt or -2)) and (float(sum_rows or -1) == float(amt or -2))
    print(f"[{label}] 一致? {'✅ PASS' if ok else '❌ FAIL'}")
    return {"label": label, "orderNo": on, "summary_subtotal": sub, "summary_total": tot,
            "create_amount": amt, "payment_amount": pay_amt, "sum_rows": sum_rows, "consistent": ok}


OUT["g4_nocoupon"] = four_way("无券 2×99", NTOK, [{"productId": 1, "quantity": 2}], None, "D-G4-nocoupon")
OUT["g4_coupon"] = four_way("用券 WELCOME10 2×99", NTOK, [{"productId": 1, "quantity": 2}], "WELCOME10", "D-G4-coupon")
print("\n  券核销状态:", sql(f"select id,coupon_id,status from user_coupon where user_id={uid};"))

# 篡改金额
print("\n--- C3 篡改 price/amount 仍被忽略 ---")
st, bd, _ = req("POST", "/checkout/summary", token=NTOK, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 2, "price": 0.01}], "total": 0.02}), cid="D-G4-tamper")
print(f"  summary(塞 price=0.01/total=0.02) -> HTTP {st} {bd.strip()[:200]}")
OUT["g4_tamper"] = J(bd)

print("\n" + "=" * 78)
print("C5 诚实降级:4 端点 501 且无写入痕迹")
print("=" * 78)
# PUT /admin/settings
st, bd, _ = req("PUT", "/admin/settings", token=AD, body=json.dumps({"siteName": "QA-D-PROBE"}), cid="D-C5-admin-settings")
print(f"  PUT /admin/settings            -> HTTP {st} {bd.strip()[:150]}")
st, bd, _ = req("GET", "/admin/settings", token=AD, cid="D-C5-admin-settings-get")
print(f"  GET /admin/settings(应仍原值)  -> HTTP {st} {bd.strip()[:200]}")
OUT["c5_admin_settings"] = st
# PUT /merchant/settings
st, bd, _ = req("PUT", "/merchant/settings", token=SH, body=json.dumps({"storeName": "QA-D-PROBE"}), cid="D-C5-merchant-settings")
print(f"  PUT /merchant/settings         -> HTTP {st} {bd.strip()[:150]}")
print("  DB shop1.name(应未变):", sql("select name from shop where id=1;"))
OUT["c5_merchant_settings"] = st
# POST /merchant/wallet/withdraw
st, bd, _ = req("POST", "/merchant/wallet/withdraw", token=SH, body=json.dumps({"amount": 100}), cid="D-C5-withdraw")
print(f"  POST /merchant/wallet/withdraw -> HTTP {st} {bd.strip()[:150]}")
st, bd, _ = req("GET", "/merchant/wallet", token=SH, cid="D-C5-wallet")
print(f"  GET  /merchant/wallet          -> HTTP {st} {bd.strip()[:120]}")
OUT["c5_withdraw"] = st
# PUT /addresses/{id}/default —— 用新用户自己的地址
st, bd, _ = req("POST", "/addresses", token=NTOK, body=json.dumps(
    {"type": "Home", "name": "QA-D", "phone": "138", "address": "测试路 9 号", "city": "上海",
     "state": "SH", "zip": "200000", "country": "CN"}), cid="D-C5-addr-create")
d = J(bd) or {}
aid = (d.get("data") or {}).get("id")
print(f"  新建地址 id={aid} -> HTTP {st}")
st, bd, _ = req("PUT", f"/addresses/{aid}/default", token=NTOK, body=json.dumps({}), cid="D-C5-addr-default")
print(f"  PUT /addresses/{aid}/default -> HTTP {st} {bd.strip()[:150]}")
print("  DB is_default 列存在?:", sql("select count(*) from information_schema.columns where table_schema='template_v3' and table_name='shipping_address' and column_name='is_default';"))
OUT["c5_addr_default"] = st

print("\n" + "=" * 78)
print("C6:POST /account/notifications 字段校验")
print("=" * 78)
print("  落库前:", repr(sql(f"select * from user_notification_pref where user_id={uid};")))
st, bd, _ = req("POST", "/account/notifications", token=NTOK, body=json.dumps(
    {"emailOrder": False, "emailPromo": True, "smsOrder": False}), cid="D-C6-ok")
print(f"  正确三字段 -> HTTP {st} {bd.strip()[:120]}")
print("  落库后:", repr(sql(f"select * from user_notification_pref where user_id={uid};")))
st, bd, _ = req("GET", "/account/notifications", token=NTOK, cid="D-C6-get")
print(f"  GET 回读 -> HTTP {st} {bd.strip()[:150]}")
OUT["c6_ok"] = st
st, bd, _ = req("POST", "/account/notifications", token=NTOK, body=json.dumps({}), cid="D-C6-empty")
print(f"  空 body -> HTTP {st} {bd.strip()[:150]}")
OUT["c6_empty"] = st
st, bd, _ = req("POST", "/account/notifications", token=NTOK, body=json.dumps(
    {"email": True, "push": False, "sms": True}), cid="D-C6-wrong")
print(f"  全错字段(商家端形状) -> HTTP {st} {bd.strip()[:150]}")
OUT["c6_wrong"] = st

open(f"{L}/out/d-g3g4.json", "w").write(json.dumps(OUT, ensure_ascii=False, indent=2))
print("\n[OK] -> " + f"{L}/out/d-g3g4.json")
print(json.dumps(OUT, ensure_ascii=False, indent=2)[:1800])
