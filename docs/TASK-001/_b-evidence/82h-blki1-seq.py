#!/usr/bin/env python3
# 82h-blki1-seq.py — BLK-I1 判据①:真实 HTTP 覆盖「结算页加购后再下单」动作序列
import sys, json, time
sys.path.insert(0, "/tmp")
from qa import B, L, sql, req, J

print("=" * 78)
print("BLK-I1 判据①:真实 HTTP 的「加购后再下单」序列")
print("=" * 78)
nu = f"qa_i1_{int(time.time())}"
req("PUT", "/common/register", body=json.dumps(
    {"type": "USER", "username": nu, "password": "123456", "nickname": "QA-I1", "email": f"{nu}@t.com"}), cid="I1-reg")
st, bd, _ = req("POST", "/common/login", body=json.dumps({"username": nu, "password": "123456", "type": "USER"}), cid="I1-login")
NT = (J(bd) or {}).get("data")
print(f"  用户 {nu} token_len={len(NT) if NT else 0}")

price2 = sql("select price from product where id=2;")
print(f"  商品 2 单价(DB)= {price2}  ← 「加购」加入的就是它")

# ① 结算页初始摘要(items = A)
A = [{"productId": 1, "quantity": 2}]
st, bd, _ = req("POST", "/checkout/summary", token=NT, body=json.dumps({"items": A}), cid="I1-summary-before")
t1 = ((J(bd) or {}).get("data") or {}).get("total")
print(f"\n  ① summary(items=A: 2×产品1) -> HTTP {st} total={t1}")

# ② 在结算页「加购」(items 变成 A+B) —— 前端动作的服务端等价物就是新 items 的摘要
AB = [{"productId": 1, "quantity": 2}, {"productId": 2, "quantity": 1}]
st, bd, _ = req("POST", "/checkout/summary", token=NT, body=json.dumps({"items": AB}), cid="I1-summary-after")
t2 = ((J(bd) or {}).get("data") or {}).get("total")
print(f"  ② summary(items=A+B, 加购产品2×1) -> HTTP {st} total={t2}")
print(f"     Total 是否变化? {t1} -> {t2}  {'✅ 变了(BLK-I1 要求的可观测变化)' if t2 != t1 else '❌ 没变'}")
delta_ok = abs((t2 or 0) - ((t1 or 0) + float(price2))) < 0.005
print(f"     增量 == 加入商品小计? {round((t2 or 0)-(t1 or 0),2)} vs {price2}  {'✅' if delta_ok else '❌'}")

# ③ 按**新 items** 下单
st, bd, _ = req("POST", "/payments/create", token=NT, body=json.dumps(
    {**{"items": AB}, "channel": "card",
     "shipping": {"name": "QA-I1", "tel": "13800000001", "address": "测试路 7 号", "city": "上海"}}), cid="I1-create")
cdata = (J(bd) or {}).get("data") or {}
on = cdata.get("paymentId")
amt = cdata.get("amount")
print(f"  ③ /payments/create(items=A+B) -> HTTP {st} amount={amt} orderNo={on}")

# ④ confirm 后比对 DB
st, bd, _ = req("POST", "/payments/confirm", token=NT, body=json.dumps({"paymentId": on}), cid="I1-confirm")
pay = sql(f"select amount from payment where order_no='{on}';")
srows = sql(f"select coalesce(sum(total_money),0) from product_order where order_no='{on}';")
print(f"  ④ /payments/confirm -> HTTP {st}")
print(f"\n  四方对拍(加购后的新 items):")
print(f"     summary.total(新)      = {t2}")
print(f"     create.amount          = {amt}")
print(f"     payment.amount         = {pay}")
print(f"     Σ order.total_money    = {srows}")
ok = (float(t2 or -1) == float(amt or -2)) and (float(pay or -1) == float(amt or -2)) and (float(srows or -1) == float(amt or -2))
print(f"     四方一致? {'✅ PASS' if ok else '❌ FAIL'}")
print(f"\n  ⇒ 判据①结论:加购动作使 Total 变化({t1}→{t2}),且下单金额按**新** items 计({amt}),")
print(f"     页面若能跟上这一变化(判据②的 e2e 已证)就不会出现「显示旧值、实扣新值」。")

json.dump({"total_before": t1, "total_after": t2, "create_amount": amt,
           "payment_amount": pay, "sum_rows": srows, "orderNo": on, "consistent": ok},
          open(f"{L}/out/i1-seq.json", "w"), ensure_ascii=False, indent=2)
print("\n[OK] -> " + f"{L}/out/i1-seq.json")
