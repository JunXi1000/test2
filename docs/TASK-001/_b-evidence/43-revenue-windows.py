#!/usr/bin/env python3
# 43-revenue-windows.py — 复核 Lead 指出的营收环比口径缺陷 + 商家仪表盘
import sys, json
sys.path.insert(0, "/tmp")
from qa import B, L, sql, tok, req, J

AD, SH = tok("admin"), tok("shop1")

print("=" * 74)
print("1) 当前库:已支付订单(白名单口径)")
print("=" * 74)
print("已支付行:", sql("select id,order_no,shop_id,user_id,total_money,status,create_time from product_order where status in ('待发货','待收货','已完成');"))
print("窗口[now-30d, now)      :", sql("select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成') and create_time >= now() - interval 30 day;"))
print("窗口[now-60d, now-30d)  :", sql("select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成') and create_time >= now() - interval 60 day and create_time < now() - interval 30 day;"))
print("全部已支付:", sql("select coalesce(sum(total_money),0) from product_order where status in ('待发货','待收货','已完成');"))
print("订单总数:", sql("select count(*) from product_order;"))

print("\n" + "=" * 74)
print("2) /admin/dashboard/stats 逐字段对拍")
print("=" * 74)
st, bd, _ = req("GET", "/admin/dashboard/stats", token=AD, cid="ADM-01-again")
d = J(bd) or {}
for it in (d.get("data") or []):
    print(f"  {it.get('label'):15} value={it.get('value'):12} change={it.get('change')}")
print("  期望 Total Revenue = $99.00 ; 期望 change = (99-0)/0 无意义 → 应显示 +0% 或 N/A,而实际:")
print("  create_time 分布:", sql("select date(create_time),count(*),sum(total_money) from product_order group by date(create_time);"))

print("\n" + "=" * 74)
print("3) /merchant/dashboard/stats 对拍")
print("=" * 74)
st, bd, _ = req("GET", "/merchant/dashboard/stats", token=SH, cid="MER-01-again")
d = J(bd) or {}
for it in (d.get("data") or []):
    print(f"  {it.get('label'):18} value={it.get('value'):12} change={it.get('change')}")
print("  DB shop1 已支付:", sql("select coalesce(sum(total_money),0),count(*) from product_order where shop_id=1 and status in ('待发货','待收货','已完成');"))
print("  DB shop1 全部订单:", sql("select count(*) from product_order where shop_id=1;"))
print("  DB shop1 在售商品:", sql("select count(*) from product where shop_id=1;"))

print("\n" + "=" * 74)
print("4) /admin/dashboard/revenue-chart 与 DB 逐日对拍")
print("=" * 74)
st, bd, _ = req("GET", "/admin/dashboard/revenue-chart?days=7", token=AD, cid="ADM-02-again")
d = J(bd) or {}
pts = {p["date"]: p["value"] for p in (d.get("data") or [])}
print("  API:", json.dumps(pts, ensure_ascii=False))
print("  DB 逐日(已支付):", repr(sql("select date(create_time),sum(total_money) from product_order where status in ('待发货','待收货','已完成') group by date(create_time);")))
print("  DB 逐日(全部):", repr(sql("select date(create_time),sum(total_money) from product_order group by date(create_time);")))
print("  今天:", sql("select curdate();"))
