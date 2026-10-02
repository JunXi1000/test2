#!/usr/bin/env python3
# mock-catalog.py — 列出 mock 商品(id/title/price/category),并算 getCompleteTheLook(11) 的结果
import re
src = open('/workspace/web/src/api/modules/product.mock.ts', encoding='utf-8').read()
# 抓形如 { id: 11, title: '...', price: 79, category: 'Accessories',
items = re.findall(r"\{\s*id:\s*(\d+),\s*title:\s*'([^']*)',\s*price:\s*([\d.]+),\s*category:\s*'([^']*)'", src)
print(f"catalog size = {len(items)}")
for i, t, p, c in items:
    print(f"  id={i:>3}  ${float(p):>8.2f}  {c:<14} {t}")
ref = next((x for x in items if x[0] == '11'), None)
print("\nreference:", ref)
if ref:
    rp = float(ref[2])
    lo, hi = rp * 0.3, rp * 1.8
    pool = [x for x in items if x[0] != '11' and x[3] != ref[3] and lo <= float(x[2]) <= hi]
    print(f"price range [{lo:.2f}, {hi:.2f}]  pool size = {len(pool)}")
    for x in pool:
        print("   ->", x)
