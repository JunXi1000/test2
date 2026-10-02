#!/usr/bin/env python3
# 91-promo-authz-detail.py — 澄清 REG-AUTHZ 的唯一 FAIL:400 是「未领券」还是鉴权问题
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

U1 = tok("user1"); U2 = tok("user2"); AD = tok("admin"); SH = tok("shop1")
print("user1 是否领过 WELCOME10(coupon id=1)?")
print("  user_coupon(user_id=1):", repr(sql("select id,user_id,coupon_id,status from user_coupon where user_id=1;")))
print("user2:", repr(sql("select id,user_id,coupon_id,status from user_coupon where user_id=2;")))
print("shop1/admin 无券是必然(券是 USER 域)\n")

for who, tk in (("USER(user1,未领券)", U1), ("USER(user2,未领券)", U2), ("SHOP", SH), ("ADMIN", AD)):
    st, bd, _ = req("POST", "/checkout/promo", token=tk,
                    body=json.dumps({"code": "WELCOME10", "subtotal": 100}), cid=f"D-PROMO-{who.split('(')[0]}")
    print(f"  {who:22} -> HTTP {st}  {bd.strip()[:110]}")

print("\n已领券用户(uid=6, qa_d_*)应当 200:")
uid6 = "6"
print("  user_coupon(uid=6):", repr(sql(f"select coupon_id,status from user_coupon where user_id={uid6};")))
print("  注:该验证已由 80-g3g4.py 实测:POST /checkout/promo -> HTTP 200 discount=19.80")
