#!/usr/bin/env bash
# 校验 promo / payments 的关键假设(显式 Authorization 头)
B=http://localhost:1000
L=/tmp/qa-b
NTOK=$(cat $L/tokens/newuser.txt)
echo "token len=${#NTOK}"
echo "=== 1) /checkout/promo 带 Authorization 头(已领 WELCOME10 的用户)==="
curl -sS -i -X POST $B/checkout/promo \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $NTOK" \
  -d '{"code":"WELCOME10","subtotal":198}' | tee $L/resp/PAY-10b.http | head -20
echo
echo "=== 2) 同一请求但用 query 参数? (无关) ==="
echo "=== 3) /checkout/summary 带 code + Authorization ==="
curl -sS -i -X POST $B/checkout/summary \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $NTOK" \
  -d '{"items":[{"productId":1,"quantity":2}],"code":"WELCOME10"}' | tee $L/resp/PAY-16c.http | head -20
echo
echo "=== 4) /checkout/summary 带 code,匿名 ==="
curl -sS -o /dev/null -w 'anon with code = %{http_code}\n' -X POST $B/checkout/summary \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":1,"quantity":2}],"code":"WELCOME10"}'
echo "=== 5) payment 表实际内容 ==="
echo "select id,order_no,user_id,amount,channel,status,coalesce(transaction_id,'NULL') as txn,coalesce(paid_at,'NULL') as paid from payment order by id desc limit 8;" | mysql -uroot -p123456 template_v3 -N -B 2>/dev/null
echo "=== 6) 卡单 order_no 在 payment 表? ==="
echo "select count(*) from payment where order_no='NO202610012112228995';" | mysql -uroot -p123456 template_v3 -N -B 2>/dev/null
echo "=== 7) product_order 当前状态 ==="
echo "select id,order_no,product_id,quantity,total_money,status from product_order order by id desc limit 6;" | mysql -uroot -p123456 template_v3 -N -B 2>/dev/null
echo "=== 8) stock p1 ==="
echo "select stock from product where id=1;" | mysql -uroot -p123456 template_v3 -N -B 2>/dev/null
