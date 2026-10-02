#!/usr/bin/env bash
# TASK-001-Z Lead 独立终验脚本（只读：仅登录/查询，不写 DDL，不写业务表）
# 目的：亲自复现三个决定性事实，而不是采信 agent 的结论。
set -u
BASE=http://127.0.0.1:1000
line() { echo; echo "================ $* ================"; }

# --- 工具：取 JWT（登录响应把 token 放在 data 字符串里） ---
login() { # $1=type $2=user
  curl -s -X POST "$BASE/common/login" -H 'Content-Type: application/json' \
    -d "{\"type\":\"$1\",\"username\":\"$2\",\"password\":\"123456\"}" \
    | grep -o '"data":"[^"]*"' | sed 's/.*:"//; s/"$//'
}

line "Z-1 就绪判据：匿名 GET / （期望 401，即就绪）"
curl -s -o /tmp/z1.body -w 'http_code=%{http_code}\n' "$BASE/"; head -c 200 /tmp/z1.body; echo

ADMIN=$(login ADMIN admin)
USER=$(login USER user1)
echo "admin token len=${#ADMIN}  user1 token len=${#USER}"

line "Z-2 真实聚合（运行态是否含当前工作树代码）：admin GET /admin/dashboard/stats"
curl -s -H "Authorization: Bearer $ADMIN" "$BASE/admin/dashboard/stats"; echo

line "Z-3 B-1 复现：user1 有效 token POST /checkout/promo（期望 400 请先登录）"
curl -s -o /tmp/z3.body -w 'http_code=%{http_code}\n' -X POST "$BASE/checkout/promo" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $USER" \
  -d '{"code":"SAVE10","subtotal":100}'
cat /tmp/z3.body; echo

line "Z-4 对照实验（决定性）：同一个 user1 token 打「非白名单」已登记端点 /addresses"
echo "若此处 200 而 Z-3 是 400 ⇒ 证明不是 token 失效，而是白名单跳过了拦截器"
curl -s -o /tmp/z4.body -w 'http_code=%{http_code}\n' -H "Authorization: Bearer $USER" "$BASE/addresses"
head -c 300 /tmp/z4.body; echo

line "Z-5 B-1 匿名对照：无 token POST /checkout/promo（期望同样 400）"
echo "若匿名与已登录都是 400 ⇒ 该端点在白名单下对「所有调用者」都不可用"
curl -s -o /tmp/z5.body -w 'http_code=%{http_code}\n' -X POST "$BASE/checkout/promo" \
  -H 'Content-Type: application/json' -d '{"code":"SAVE10","subtotal":100}'
cat /tmp/z5.body; echo

line "Z-6 授权：未登记端点应 403（user1 GET /shoppingCart/list）"
curl -s -o /tmp/z6.body -w 'http_code=%{http_code}\n' -H "Authorization: Bearer $USER" "$BASE/shoppingCart/list"
head -c 200 /tmp/z6.body; echo

line "Z-7 角色隔离：user1 打管理端端点应 403"
curl -s -o /tmp/z7.body -w 'http_code=%{http_code}\n' -H "Authorization: Bearer $USER" "$BASE/admin/dashboard/stats"
head -c 200 /tmp/z7.body; echo

line "Z-8 B-7 复现：不存在的商品（期望 404，实测若 200+data:null 则是缺陷）"
curl -s -o /tmp/z8.body -w 'http_code=%{http_code}\n' "$BASE/products/999999"
head -c 300 /tmp/z8.body; echo

line "Z-9 真实聚合复核：GET /products/category-counts"
curl -s "$BASE/products/category-counts"; echo

line "Z-10 只读库侧交叉核对（证明 Z-2 的数字不是硬编码）"
echo "user 行数 / product 行数 / 订单行数 与 sum(total_money):"
mysql -uroot -p123456 template_v3 -N -e \
  "select (select count(*) from user) as users, (select count(*) from product) as products, (select count(*) from product_order) as order_rows, (select coalesce(sum(total_money),0) from product_order) as sum_money;" 2>/dev/null

echo; echo "=== Z 终验结束 ==="
