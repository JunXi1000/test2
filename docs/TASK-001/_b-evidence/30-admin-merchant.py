#!/usr/bin/env python3
# 30-admin-merchant.py — 后台逐端点「真实/假数据/报错」判定 + DB 交叉验证
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J, show

AD, SH, U1, NU = tok("admin"), tok("shop1"), tok("user1"), tok("newuser")
RES = []


def line(cid, verdict, note):
    RES.append((cid, verdict, note))
    print(f"  >>> {cid}: {verdict} — {note}")


print("=" * 74)
print("A) 管理端 仪表盘")
print("=" * 74)
st, bd, _ = req("GET", "/admin/dashboard/stats", token=AD, cid="ADM-01")
d = show("ADM-01", st, bd, "GET /admin/dashboard/stats")
print("  DB 复算:")
print("   已支付金额:", sql("select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成');"))
print("   启用用户数:", sql("select count(*) from user where status='启用';"))
print("   已支付订单行数:", sql("select count(*) from product_order where status in ('待发货','待收货','已完成');"))
print("   近24h下单用户:", sql("select count(distinct user_id) from product_order where create_time >= now() - interval 24 hour;"))
print("   30天/前30天金额:", sql("select (select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成') and create_time>=now()-interval 30 day), (select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成') and create_time>=now()-interval 60 day and create_time<now()-interval 30 day);"))

st, bd, _ = req("GET", "/admin/dashboard/revenue-chart?days=7", token=AD, cid="ADM-02")
show("ADM-02", st, bd, "revenue-chart?days=7")
print("  DB 逐日已支付:", sql("select date(create_time),sum(total_money) from product_order where status in ('待发货','待收货','已完成') group by date(create_time) order by 1;"))
st, bd, _ = req("GET", "/admin/dashboard/revenue-chart?days=999", token=AD, cid="ADM-02b")
show("ADM-02b", st, bd, "days=999(应收敛到 31)")
st, bd, _ = req("GET", "/admin/dashboard/recent-users", token=AD, cid="ADM-03")
show("ADM-03", st, bd, "recent-users")
print("  DB user 前5:", sql("select nickname,email,create_time from user order by id limit 5;"))

print("\n" + "=" * 74)
print("B) 管理端 用户/商家/商品/订单/评论/设置")
print("=" * 74)
st, bd, _ = req("GET", "/admin/users?role=all", token=AD, cid="ADM-04-all")
d_all = show("ADM-04-all", st, bd, "users role=all")
st, bd, _ = req("GET", "/admin/users?role=user", token=AD, cid="ADM-04-user")
d_user = show("ADM-04-user", st, bd, "users role=user")
st, bd, _ = req("GET", "/admin/users?role=admin", token=AD, cid="ADM-04-admin")
d_admin = show("ADM-04-admin", st, bd, "users role=admin(刻意空集)")
print("  DB user 总数:", sql("select count(*) from user;"))
st, bd, _ = req("GET", "/admin/users?q=qa_b", token=AD, cid="ADM-05")
show("ADM-05", st, bd, "users?q=qa_b(过滤器)")
st2, bd2, _ = req("GET", "/admin/users?q=zzz_nomatch", token=AD, cid="ADM-05b")
d2 = J(bd2) or {}
n2 = len(d2.get("data") or [])
print(f"  q=zzz_nomatch -> {st2}, n={n2}  (与 q=qa_b 不同即过滤器生效)")

st, bd, _ = req("GET", "/admin/merchants", token=AD, cid="ADM-08")
d = show("ADM-08", st, bd, "merchants(revenue)")
print("  DB 各店已支付营收:", sql("select shop_id,coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成') group by shop_id;"))
st, bd, _ = req("GET", "/admin/merchants?status=pending", token=AD, cid="ADM-09")
d_p = show("ADM-09", st, bd, "merchants?status=pending")
st, bd, _ = req("GET", "/admin/merchants?status=active", token=AD, cid="ADM-09b")
d_a = show("ADM-09b", st, bd, "merchants?status=active")
print("  DB shop status:", sql("select id,name,status from shop;"))

st, bd, _ = req("GET", "/admin/products?q=耳机", token=AD, cid="ADM-11")
show("ADM-11", st, bd, "products?q=耳机")
st, bd, _ = req("GET", "/admin/products?status=active", token=AD, cid="ADM-12a")
d1 = J(bd) or {}
st, bd, _ = req("GET", "/admin/products?status=draft", token=AD, cid="ADM-12b")
d2 = J(bd) or {}
n_active = len(d1.get("data") or []) if isinstance(d1.get("data"), list) else "n/a"
n_draft = len(d2.get("data") or []) if isinstance(d2.get("data"), list) else "n/a"
print(f"  status=active -> {n_active} 项; status=draft -> {n_draft} 项")
print("  DB product 全表:", sql("select id,name,stock from product order by id;"))
print("  DB product.status 是否真有列:", sql("select count(*) from information_schema.columns where table_schema='template_v3' and table_name='product' and column_name='status';"))

st, bd, _ = req("GET", "/admin/orders?q=qa", token=AD, cid="ADM-14")
show("ADM-14", st, bd, "orders?q=qa")
st2, bd2, _ = req("GET", "/admin/orders", token=AD, cid="ADM-14b")
d1, d2 = J(bd) or {}, J(bd2) or {}
print(f"  q=qa -> {len(d1.get('data') or [])} 项; 无 q -> {len(d2.get('data') or [])} 项")
print("  DB 订单数:", sql("select count(*) from product_order;"))

st, bd, _ = req("GET", "/admin/reviews?q=", token=AD, cid="ADM-16")
show("ADM-16", st, bd, "reviews 全量")
st, bd, _ = req("GET", "/admin/reviews?status=hidden", token=AD, cid="ADM-17")
d_hidden = show("ADM-17", st, bd, "reviews?status=hidden")
print("  DB 评价表:", sql("select count(*) from product_order_evaluate;"))
print("  DB review_status 列存在?:", sql("select count(*) from information_schema.columns where table_schema='template_v3' and table_name='product_order_evaluate' and column_name='review_status';"))

rid = sql("select id from product_order_evaluate order by id limit 1;")
print(f"  测试用 review id={rid}")
if rid:
    before = sql(f"select id,rate,left(content,10) from product_order_evaluate where id={rid};")
    print("  before:", before)
    st, bd, _ = req("PUT", f"/admin/reviews/{rid}", token=AD, body=json.dumps({"status": "hidden"}), cid="ADM-18")
    show("ADM-18", st, bd, f"PUT /admin/reviews/{rid} status=hidden")
    after = sql(f"select id,rate,left(content,10) from product_order_evaluate where id={rid};")
    print("  after :", after)
    print("  DB 是否变化:", before != after)
    st, bd, _ = req("GET", "/admin/reviews?status=hidden", token=AD, cid="ADM-18b")
    d2 = J(bd) or {}
    print("  hidden 列表条数:", len(d2.get("data") or []))

st, bd, _ = req("GET", "/admin/settings", token=AD, cid="ADM-20")
d = show("ADM-20", st, bd, "GET /admin/settings")
print("  DB admin_setting 表存在?:", sql("select count(*) from information_schema.tables where table_schema='template_v3' and table_name='admin_setting';"))
st, bd, _ = req("PUT", "/admin/settings", token=AD, body=json.dumps({"siteName": "QA-PROBE-SITE", "maintenanceMode": True}), cid="ADM-21")
show("ADM-21", st, bd, "PUT /admin/settings 改 siteName")
st, bd, _ = req("GET", "/admin/settings", token=AD, cid="ADM-21b")
d = show("ADM-21b", st, bd, "GET 再读(是否保留 QA-PROBE-SITE)")

print("\n" + "=" * 74)
print("C) 商家端")
print("=" * 74)
st, bd, _ = req("GET", "/merchant/dashboard/stats", token=SH, cid="MER-01")
show("MER-01", st, bd, "GET /merchant/dashboard/stats")
print("  自报 shopId(从 token 解):", J(open(f"{L}/resp/AUTH-09.http").read().partition("\n\n")[2]) if False else "")
print("  DB 本店(shop_id 由 token 决定,登录返回 type=SHOP 的 id 需另取)")
print("  DB 按 shop 聚合(已支付):", sql("select shop_id,coalesce(sum(total_money),0),count(*) from product_order where status in ('待发货','待收货','已完成') group by shop_id;"))
print("  DB 全店订单数:", sql("select shop_id,count(*) from product_order group by shop_id;"))
print("  DB 本店在售商品数:", sql("select shop_id,count(*) from product group by shop_id;"))

st, bd, _ = req("GET", "/merchant/dashboard/stats?shopId=2", token=SH, cid="MER-02")
show("MER-02", st, bd, "stats?shopId=2(应仍为本店)")
st, bd, _ = req("GET", "/merchant/dashboard/low-stock", token=SH, cid="MER-03")
show("MER-03", st, bd, "low-stock")
print("  DB 本店 stock<=5:", sql("select id,name,stock from product where stock<=5;"))
st, bd, _ = req("GET", "/merchant/products?status=active", token=SH, cid="MER-05a")
d1 = J(bd) or {}
st, bd, _ = req("GET", "/merchant/products?status=draft", token=SH, cid="MER-05b")
d2 = J(bd) or {}
print(f"  status=active -> {len(d1.get('data') or [])}; status=draft -> {len(d2.get('data') or [])}")
st, bd, _ = req("GET", "/merchant/products?q=耳机", token=SH, cid="MER-04")
d3 = J(bd) or {}
print(f"  q=耳机 -> {len(d3.get('data') or [])}")
st, bd, _ = req("GET", "/merchant/orders", token=SH, cid="MER-08")
show("MER-08", st, bd, "merchant orders")

st, bd, _ = req("GET", "/merchant/wallet", token=SH, cid="MER-12")
show("MER-12", st, bd, "GET /merchant/wallet")
print("  DB merchant_wallet 表存在?:", sql("select count(*) from information_schema.tables where table_schema='template_v3' and table_name='merchant_wallet';"))
st, bd, _ = req("GET", "/merchant/wallet/transactions", token=SH, cid="MER-13")
show("MER-13", st, bd, "GET /merchant/wallet/transactions")
st, bd, _ = req("POST", "/merchant/wallet/withdraw", token=SH, body=json.dumps({"amount": 100, "destinationId": "x"}), cid="MER-14")
show("MER-14", st, bd, "POST /merchant/wallet/withdraw 提现 100")
st, bd, _ = req("GET", "/merchant/wallet", token=SH, cid="MER-14b")
show("MER-14b", st, bd, "提现后再读钱包(是否变化)")
print("  DB 流水表存在?:", sql("select count(*) from information_schema.tables where table_schema='template_v3' and table_name='merchant_wallet_transaction';"))

st, bd, _ = req("GET", "/merchant/settings", token=SH, cid="MER-15")
d = show("MER-15", st, bd, "GET /merchant/settings")
print("  DB shop1:", sql("select id,name,nickname,avatar_url,email from shop where id=1;"))
st, bd, _ = req("PUT", "/merchant/settings", token=SH, body=json.dumps({"storeName": "QA-PROBE-STORE", "email": "qa@probe.test"}), cid="MER-16")
show("MER-16", st, bd, "PUT /merchant/settings 改 storeName")
st, bd, _ = req("GET", "/merchant/settings", token=SH, cid="MER-16b")
show("MER-16b", st, bd, "再读 settings")
print("  DB shop1 after:", sql("select id,name,nickname,email from shop where id=1;"))

st, bd, _ = req("GET", "/merchant/settings", token=tok("shop2"), cid="MER-16c")
show("MER-16c", st, bd, "shop2 读 settings(应为本店)")

print("\n" + "=" * 74)
print("D) 店铺公开页 + 买家 dashboard")
print("=" * 74)
st, bd, _ = req("GET", "/merchants/1/profile", cid="STF-16")
d = show("STF-16", st, bd, "merchants/1/profile")
print("  DB 该店商品数:", sql("select count(*) from product where shop_id=1;"))
print("  DB 该店已支付销量:", sql("select coalesce(sum(quantity),0) from product_order where status in ('待发货','待收货','已完成') and product_id in (select id from product where shop_id=1);"))
st, bd, _ = req("GET", "/merchants/1/products?page=1&limit=5", cid="STF-18")
show("STF-18", st, bd, "merchants/1/products")
st, bd, _ = req("GET", "/dashboard/stats", token=NU, cid="ORD-19")
show("ORD-19", st, bd, "买家 dashboard/stats")
print("  DB 该用户订单聚合:", sql(f"select status,count(*),sum(total_money) from product_order where user_id=(select id from user where username='{open(L+'/out/main.json').read() and json.load(open(L+'/out/main.json'))['newuser']}') group by status;"))

print("\n" + "=" * 74)
print("E) 地址 / 退换货 / 到货订阅 / 账户 / 通知")
print("=" * 74)
st, bd, _ = req("GET", "/addresses", token=NU, cid="EXT-01")
show("EXT-01", st, bd, "GET /addresses(新用户,应为空)")
st, bd, _ = req("POST", "/addresses", token=NU, body=json.dumps(
    {"type": "Home", "isDefault": True, "name": "QA", "phone": "138", "address": "测试路9号", "city": "上海", "state": "SH", "zip": "200000", "country": "CN"}), cid="EXT-02")
show("EXT-02", st, bd, "POST /addresses")
print("  DB shipping_address:", sql("select id,user_id,name,address from shipping_address;"))
st, bd, _ = req("GET", "/addresses", token=NU, cid="EXT-01b")
d = show("EXT-01b", st, bd, "GET /addresses 再读")
aid = None
if d and isinstance(d.get("data"), list) and d["data"]:
    aid = d["data"][0].get("id")
print(f"  新地址 id={aid}")
if aid:
    st, bd, _ = req("PUT", f"/addresses/{aid}/default", token=NU, cid="EXT-05")
    show("EXT-05", st, bd, "PUT /addresses/{id}/default(no-op?)")
    print("  DB is_default 列存在?:", sql("select count(*) from information_schema.columns where table_schema='template_v3' and table_name='shipping_address' and column_name='is_default';"))

st, bd, _ = req("GET", "/returns", token=NU, cid="EXT-13")
show("EXT-13", st, bd, "GET /returns")
st, bd, _ = req("POST", "/returns", token=NU, body=json.dumps(
    {"orderId": "NO202610012112228995", "productTitle": "无线蓝牙耳机", "productImage": "/img/p1.jpg",
     "reason": "尺寸不合适", "detail": "QA", "refundAmount": 198}), cid="EXT-13b")
show("EXT-13b", st, bd, "POST /returns")
print("  DB return_request:", sql("select id,user_id,order_id,refund_amount,status from return_request order by id desc limit 3;"))

st, bd, _ = req("POST", "/stock-alerts", token=NU, body=json.dumps(
    {"productId": 2, "productTitle": "简约纯棉T恤", "productImage": "/img/p2.jpg", "email": "q@q.q"}), cid="EXT-14a")
show("EXT-14a", st, bd, "POST /stock-alerts")
st, bd, _ = req("GET", "/stock-alerts/mine", token=NU, cid="EXT-14b")
show("EXT-14b", st, bd, "GET /stock-alerts/mine")
print("  DB stock_alert:", sql("select id,user_id,product_id,email from stock_alert order by id desc limit 3;"))
st, bd, _ = req("DELETE", "/stock-alerts/2", token=NU, cid="EXT-14c")
show("EXT-14c", st, bd, "DELETE /stock-alerts/2")
print("  DB stock_alert after:", sql("select count(*) from stock_alert where user_id=(select id from user where username='" + json.load(open(L + "/out/main.json"))["newuser"] + "');"))

st, bd, _ = req("GET", "/account/profile", token=NU, cid="EXT-15")
show("EXT-15", st, bd, "GET /account/profile")
st, bd, _ = req("GET", "/account/notifications", token=NU, cid="EXT-16")
show("EXT-16", st, bd, "GET /account/notifications")
st, bd, _ = req("POST", "/account/notifications", token=NU, body=json.dumps({"email": False, "push": True, "sms": False}), cid="EXT-16b")
show("EXT-16b", st, bd, "POST /account/notifications")
print("  DB user_notification_pref:", sql("select * from user_notification_pref order by user_id desc limit 3;"))

for who, tk in (("user", NU), ("shop", SH), ("admin", AD)):
    st, bd, _ = req("GET", "/notifications", token=tk, cid=f"EXT-17-{who}")
    d = J(bd) or {}
    items = d.get("data") or []
    print(f"  notifications[{who}] HTTP {st} n={len(items) if isinstance(items, list) else 'n/a'}")

print("\n[SUMMARY]")
for c, v, n in RES:
    print(f"  {c}: {v} {n}")
