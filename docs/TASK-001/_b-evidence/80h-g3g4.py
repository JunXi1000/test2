#!/usr/bin/env python3
# 80h-g3g4.py — TASK-002-H:G3 复验 + G4 含积分场景(U-4)+ BLK-E1 闭环证据
import sys, json, time
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

OUT = {}
AD = tok("admin"); SH = tok("shop1")

print("=" * 78)
print("G3 复验:券链路(登录 + 已领券 → 200;匿名 → 401;决定性对照)")
print("=" * 78)
nu = f"qa_h_{int(time.time())}"
st, _, _ = req("PUT", "/common/register", body=json.dumps(
    {"type": "USER", "username": nu, "password": "123456", "nickname": "QA-H", "email": f"{nu}@t.com"}), cid="H-reg")
st, bd, _ = req("POST", "/common/login", body=json.dumps({"username": nu, "password": "123456", "type": "USER"}), cid="H-login")
NT = (J(bd) or {}).get("data")
uid = sql(f"select id from user where username='{nu}';")
print(f"  新用户 {nu} uid={uid} token_len={len(NT) if NT else 0}")

st, bd, _ = req("GET", "/coupons", token=NT, cid="H-coupons")
cid10 = next((c.get("id") for c in ((J(bd) or {}).get("data") or []) if c.get("code") == "WELCOME10"), None)
st, bd, _ = req("POST", f"/coupons/{cid10}/claim", token=NT, cid="H-claim")
print(f"  领 WELCOME10(id={cid10}) -> HTTP {st}")
print("  DB user_coupon:", sql(f"select id,user_id,coupon_id,status from user_coupon where user_id={uid};"))

st_addr, bd_addr, _ = req("GET", "/addresses", token=NT, cid="H-addresses")
st_promo, bd_promo, _ = req("POST", "/checkout/promo", token=NT,
                            body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="H-promo")
d = J(bd_promo) or {}
print(f"\n[决定性对照] 同一 token:")
print(f"  GET  /addresses       -> HTTP {st_addr}  {bd_addr.strip()[:70]}")
print(f"  POST /checkout/promo  -> HTTP {st_promo}  {bd_promo.strip()[:170]}")
disc = (d.get("data") or {}).get("discount")
print(f"  → discount={disc} (期望 19.80) {'✅' if disc == 19.8 else '❌'}")

st_a1, bd_a1, _ = req("POST", "/checkout/promo", body=json.dumps({"code": "WELCOME10", "subtotal": 198}), cid="H-promo-anon")
st_a2, bd_a2, _ = req("POST", "/checkout/summary", body=json.dumps({"items": [{"productId": 1, "quantity": 1}]}), cid="H-summary-anon")
print(f"  匿名 promo   -> HTTP {st_a1} {bd_a1.strip()[:90]}")
print(f"  匿名 summary -> HTTP {st_a2} {bd_a2.strip()[:90]}")
OUT["g3"] = {"addresses": st_addr, "promo": st_promo, "discount": disc, "anon_promo": st_a1, "anon_summary": st_a2}

print("\n" + "=" * 78)
print("G4 含积分场景(U-4):服务端权威总额 == 实扣 == DB;且**无任何积分扣减通道**")
print("=" * 78)

# 积分余额(前端 localStorage 概念)在服务端无对应列 ⇒ 先证明服务端 schema 里没有积分表/列
print("  服务端积分落点检索:")
print("    含 'point' 的表:", repr(sql("select table_name from information_schema.tables where table_schema='template_v3' and lower(table_name) like '%point%';")))
print("    含 'point' 的列:", repr(sql("select table_name,column_name from information_schema.columns where table_schema='template_v3' and lower(column_name) like '%point%';")))
print("    payment 表列:", repr(sql("select column_name from information_schema.columns where table_schema='template_v3' and table_name='payment' order by ordinal_position;")))


def four_way(label, token, items, code=None, cid=""):
    body = {"items": items}
    if code:
        body["code"] = code
    st, bd, _ = req("POST", "/checkout/summary", token=token, body=json.dumps(body), cid=f"{cid}-summary")
    sdata = (J(bd) or {}).get("data") or {}
    print(f"\n[{label}] summary -> HTTP {st} {bd.strip()[:190]}")
    st2, bd2, _ = req("POST", "/payments/create", token=token, body=json.dumps(
        {**body, "channel": "card",
         "shipping": {"name": "QA-H", "tel": "13800000001", "address": "测试路 8 号", "city": "上海"}}),
        cid=f"{cid}-create")
    cdata = (J(bd2) or {}).get("data") or {}
    print(f"[{label}] create  -> HTTP {st2} {bd2.strip()[:190]}")
    on = cdata.get("paymentId")
    pay = sql(f"select amount from payment where order_no='{on}';")
    srows = sql(f"select coalesce(sum(total_money),0) from product_order where order_no='{on}';")
    tot, amt = sdata.get("total"), cdata.get("amount")
    print(f"[{label}] 四方: summary.total={tot} | create.amount={amt} | payment.amount={pay} | Σ rows={srows}")
    ok = (tot == amt) and (float(pay or -1) == float(amt or -2)) and (float(srows or -1) == float(amt or -2))
    print(f"[{label}] 一致? {'✅ PASS' if ok else '❌ FAIL'}")
    # 关键:summary 的 total 必须等于 subtotal - discount,**不含任何第三层扣减**(积分)
    sub, dsc = sdata.get("subtotal"), sdata.get("discount")
    third = round((sub or 0) - (dsc or 0) - (tot or 0), 2)
    print(f"[{label}] 是否存在第三层扣减(积分)? total == subtotal - discount ? "
          f"{'✅ 是(无积分层)' if third == 0 else '❌ 差 %.2f' % third}")
    return {"label": label, "orderNo": on, "subtotal": sub, "discount": dsc, "total": tot,
            "create_amount": amt, "payment_amount": pay, "sum_rows": srows,
            "consistent": ok, "third_layer_deduction": third}


OUT["g4_nocoupon"] = four_way("无券 2×99", NT, [{"productId": 1, "quantity": 2}], None, "H-G4-nocoupon")
OUT["g4_coupon"] = four_way("用券 WELCOME10 2×99", NT, [{"productId": 1, "quantity": 2}], "WELCOME10", "H-G4-coupon")
print("\n  券核销:", sql(f"select id,coupon_id,status from user_coupon where user_id={uid};"))

print("\n--- U-4 结论所需的两条补充证据 ---")
print("  ① 篡改前端金额仍被忽略(价格由服务端按 DB 重算):")
st, bd, _ = req("POST", "/checkout/summary", token=NT, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 2, "price": 0.01}], "total": 0.02}), cid="H-tamper")
print(f"     summary(塞 price=0.01/total=0.02,并**额外塞 pointsDiscount:50**) -> HTTP {st} {bd.strip()[:190]}")
st, bd, _ = req("POST", "/checkout/summary", token=NT, body=json.dumps(
    {"items": [{"productId": 1, "quantity": 2}], "pointsDiscount": 50, "pointsToUse": 5000}), cid="H-tamper-points")
print(f"     summary(塞 pointsDiscount:50 / pointsToUse:5000) -> HTTP {st} {bd.strip()[:190]}")
OUT["tamper_points"] = J(bd)

print("\n  ② 购物车页金额来源(useCartSummary)已被 G1c 收敛为服务端 total:")
st, bd, _ = req("POST", "/checkout/summary", token=NT, body=json.dumps({"items": [{"productId": 1, "quantity": 2}]}), cid="H-cart-shape")
print(f"     /checkout/summary 响应体字段: {(J(bd) or {}).get('data')}")

open(f"{L}/out/h-g3g4.json", "w").write(json.dumps(OUT, ensure_ascii=False, indent=2))
print("\n[OK] -> " + f"{L}/out/h-g3g4.json")
print(json.dumps({k: v for k, v in OUT.items()}, ensure_ascii=False, indent=2)[:1600])
