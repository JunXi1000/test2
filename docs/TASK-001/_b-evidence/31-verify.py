#!/usr/bin/env python3
# 31-verify.py — 澄清:非 ASCII query / 营收聚合 / 通知偏好契约 / 评价种子 / 会员契约
import sys, json, subprocess
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J, show

AD, SH, NU = tok("admin"), tok("shop1"), tok("newuser")

print("=" * 74)
print("1) DB 原始聚合(逐条,不用 group by 以免空集)")
print("=" * 74)
print("product_order 全部:", sql("select id,order_no,user_id,product_id,shop_id,quantity,total_money,status from product_order order by id;"))
print("已支付行数:", sql("select count(*) from product_order where status in ('待发货','待收货','已完成');"))
print("按店店(shop_id)group:", repr(sql("select shop_id,sum(total_money) from product_order where status in ('待发货','待收货','已完成') group by shop_id;")))
print("product sales_volume:", sql("select id,name,sales_volume,stock from product order by id;"))
print("shop1 totalSales(店铺页 stats):", sql("select sum(sales_volume) from product where shop_id=1;"))
print("shop1 top3 sales_volume:", sql("select sales_volume from product where shop_id=1 order by sales_volume desc limit 3;"))

print("\n" + "=" * 74)
print("2) 非 ASCII query 参数:/admin/products?q=耳机 (对拍两种编码)")
print("=" * 74)
TK = tok("admin")
enc = subprocess.run(["python3", "-c", "import urllib.parse;print(urllib.parse.quote('耳机'))"],
                     capture_output=True, text=True).stdout.strip()
print("percent-encoded =", enc)
for label, url in (("raw-utf8", f"{B}/admin/products?q=耳机"), ("percent-encoded", f"{B}/admin/products?q={enc}")):
    p = subprocess.run(["curl", "-sS", "-i", "-H", f"Authorization: Bearer {TK}", url],
                       capture_output=True, text=True)
    raw = p.stdout.replace("\r\n", "\n")
    first = raw.split("\n")[0]
    body = raw.partition("\n\n")[2]
    print(f"  [{label}] {first}  body[:200]={body[:200]!r}")

print("\n" + "=" * 74)
print("3) 完整响应抓取:账户资料 / 通知偏好(契约对照)")
print("=" * 74)
st, bd, _ = req("GET", "/account/profile", token=NU, cid="EXT-15-full")
print("  account/profile FULL:", bd)
st, bd, _ = req("GET", "/account/notifications", token=NU, cid="EXT-16-full")
print("  account/notifications GET FULL:", bd)
print("  DB user_notification_pref 列:", sql("select column_name from information_schema.columns where table_schema='template_v3' and table_name='user_notification_pref' order by ordinal_position;"))
print("  DB user_notification_pref rows:", sql("select * from user_notification_pref;"))
print("  再试 POST 前端形状 {email,push,sms}:")
st, bd, _ = req("POST", "/account/notifications", token=NU, body=json.dumps({"email": True, "push": False, "sms": True}), cid="EXT-16c")
print("   ->", st, bd)
st, bd, _ = req("GET", "/account/notifications", token=NU, cid="EXT-16d")
print("   GET ->", bd)
print("  DB ->", sql("select * from user_notification_pref;"))
print("  再试 POST 后端形状 {emailOrder,emailPromo,smsOrder}:")
st, bd, _ = req("POST", "/account/notifications", token=NU, body=json.dumps({"emailOrder": False, "emailPromo": True, "smsOrder": False}), cid="EXT-16e")
print("   ->", st, bd)
st, bd, _ = req("GET", "/account/notifications", token=NU, cid="EXT-16f")
print("   GET ->", bd)
print("  DB ->", sql("select * from user_notification_pref;"))

print("\n" + "=" * 74)
print("4) 评价表种子 (ADM-16/17/18 是否可测)")
print("=" * 74)
print("product_order_evaluate count:", sql("select count(*) from product_order_evaluate;"))
print("列:", sql("select column_name from information_schema.columns where table_schema='template_v3' and table_name='product_order_evaluate' order by ordinal_position;"))
st, bd, _ = req("GET", "/admin/reviews?status=visible", token=AD, cid="ADM-17b")
print("  reviews?status=visible ->", st, bd)
st, bd, _ = req("PUT", "/admin/reviews/1", token=AD, body=json.dumps({"status": "hidden"}), cid="ADM-18-nonexistent")
print("  PUT /admin/reviews/1 (不存在) ->", st, bd)

print("\n" + "=" * 74)
print("5) /admin/users/{id} 是否接受 balance(用于 ORD-14 充值前置)")
print("=" * 74)
print("  balance before:", sql(f"select balance from user where id={json.load(open(L+'/out/main.json'))['newid']};"))
st, bd, _ = req("PUT", f"/admin/users/{json.load(open(L+'/out/main.json'))['newid']}", token=AD,
                body=json.dumps({"name": "QA验收用户", "balance": 500}), cid="EXT-setbalance")
print("  PUT with balance:", st, bd)
print("  balance after:", sql(f"select balance from user where id={json.load(open(L+'/out/main.json'))['newid']};"))

print("\n" + "=" * 74)
print("6) 商家 products?q=耳机(两种编码)")
print("=" * 74)
SHK = tok("shop1")
for label, url in (("raw-utf8", f"{B}/merchant/products?q=耳机"), ("pct", f"{B}/merchant/products?q={enc}")):
    p = subprocess.run(["curl", "-sS", "-i", "-H", f"Authorization: Bearer {SHK}", url], capture_output=True, text=True)
    raw = p.stdout.replace("\r\n", "\n")
    print(f"  [{label}] {raw.split(chr(10))[0]} body={raw.partition(chr(10)+chr(10))[2][:160]!r}")
p = subprocess.run(["curl", "-sS", "-i", "-H", f"Authorization: Bearer {AD}", f"{B}/admin/products?q={enc}"], capture_output=True, text=True)
raw = p.stdout.replace("\r\n", "\n")
print(f"  [admin pct] {raw.split(chr(10))[0]} body={raw.partition(chr(10)+chr(10))[2][:300]!r}")

print("\n" + "=" * 74)
print("7) 商家 shopId 归属:shop1 token 建商品(验证 shop_id 强制取自 token)")
print("=" * 74)
st, bd, _ = req("POST", "/merchant/products", token=SHK, body=json.dumps(
    {"name": "QA探针商品", "price": 12.34, "stock": 7, "productTypeId": 1, "intro": "qa", "shopId": 2}), cid="MER-06")
d = show("MER-06", st, bd, "shop1 建商品(尝试 shopId=2)")
print("  DB 新商品:", sql("select id,name,price,stock,shop_id from product order by id desc limit 1;"))
newpid = sql("select max(id) from product;")
print(f"  newpid={newpid}; 尝试以 shop2 改它:")
st, bd, _ = req("PUT", f"/merchant/products/{newpid}", token=tok("shop2"), body=json.dumps({"name": "HACKED"}), cid="MER-07")
print(f"  shop2 PUT -> {st} {bd.strip()[:150]}")
print("  DB after:", sql(f"select id,name,shop_id from product where id={newpid};"))
st, bd, _ = req("PUT", f"/merchant/products/{newpid}", token=SHK, body=json.dumps({"name": "QA探针商品-改名", "price": 12.34, "stock": 7}), cid="MER-06b")
print(f"  shop1 PUT 自己 -> {st} {bd.strip()[:120]}")
print("  DB after:", sql(f"select id,name,price from product where id={newpid};"))
