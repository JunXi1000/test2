#!/usr/bin/env bash
# c5-raw.sh — 直接打印 C5 四个端点的原始状态行与请求体(纠正汇总 JSON 的赋值覆盖问题)
B=http://localhost:1000
L=/tmp/qa-b
AD=$(cat $L/tokens/admin.txt)
SH=$(cat $L/tokens/shop1.txt)
U=$(cat $L/tokens/newuser.txt)
for f in D-C5-admin-settings D-C5-admin-settings-get D-C5-merchant-settings D-C5-withdraw D-C5-wallet D-C5-addr-default; do
  echo "===== $f ====="
  echo "--- REQ:"; cat $L/resp/$f.req 2>/dev/null | head -6
  echo "--- STATUS+BODY:"; head -1 $L/resp/$f.http; sed -n '/^$/,$p' $L/resp/$f.http | tail -1
done
echo
echo "===== 直接复验(带 body 与不带 body 都必须 501)====="
echo -n "PUT /admin/settings 无 body -> "; curl -sS -o /tmp/x1 -w '%{http_code}\n' -X PUT "$B/admin/settings" -H "Authorization: Bearer $AD"
echo -n "PUT /admin/settings 带 body -> "; curl -sS -o /tmp/x2 -w '%{http_code}\n' -X PUT "$B/admin/settings" -H "Authorization: Bearer $AD" -H 'Content-Type: application/json' -d '{"siteName":"X"}'
echo -n "POST /merchant/wallet/withdraw 带 body -> "; curl -sS -o /tmp/x3 -w '%{http_code}\n' -X POST "$B/merchant/wallet/withdraw" -H "Authorization: Bearer $SH" -H 'Content-Type: application/json' -d '{"amount":100}'
echo "--- body:"; cat /tmp/x3; echo
echo -n "PUT /addresses/3/default 带 body -> "; curl -sS -o /tmp/x4 -w '%{http_code}\n' -X PUT "$B/addresses/3/default" -H "Authorization: Bearer $U" -H 'Content-Type: application/json' -d '{}'
echo "--- body:"; cat /tmp/x4; echo
