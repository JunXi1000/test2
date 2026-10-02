#!/usr/bin/env bash
# 10-a-face.sh — A 面:认证/商品/搜索/购物车 + DB 交叉验证
set -u
B=http://localhost:1000
L=/tmp/qa-b
U1=$(cat $L/tokens/user1.txt)
U2=$(cat $L/tokens/user2.txt)
SH=$(cat $L/tokens/shop1.txt)
AD=$(cat $L/tokens/admin.txt)
AUTH=(-H "Authorization: Bearer $U1")
A2=(-H "Authorization: Bearer $U2")
ASH=(-H "Authorization: Bearer $SH")
AAD=(-H "Authorization: Bearer $AD")
CT=(-H 'Content-Type: application/json')
J() { python3 -c 'import json,sys;d=json.load(sys.stdin);print(json.dumps(d,ensure_ascii=False))'; }
q() { echo "$1" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N 2>/dev/null; }
cap() { # cap <id> <label> ; stdin = response body
  local id=$1
  tee $L/resp/$id.json
}

echo "===================== DB 基线 ====================="
q "select id,name,price,stock,sales_volume,shop_id from product order by id;" | tee $L/sql/db-products.out
q "select id,name,product_type_id from product_type order by id;" | tee $L/sql/db-types.out
q "select product_type_id,count(*) from product group by product_type_id;" | tee $L/sql/db-catcounts.out

echo "===================== STF-01 商品列表 ====================="
curl -sS -i "${AUTH[@]}" "$B/products?page=1&limit=20" > $L/resp/STF-01.http
head -1 $L/resp/STF-01.http
python3 - <<'PY'
import json
raw=open('/tmp/qa-b/resp/STF-01.http').read()
body=raw.split('\r\n\r\n',1)[1]
d=json.loads(body); data=d['data']
print('code=',d['code'],'len=',len(data))
print('first3=',json.dumps(data[:3],ensure_ascii=False))
PY

echo "===================== STF-02 商品详情 ====================="
curl -sS "${AUTH[@]}" "$B/products/1" | cap STF-02
curl -sS -o /dev/null -w 'detail1=%{http_code}\n' "${AUTH[@]}" "$B/products/1"

echo "===================== STF-03 不存在商品 ====================="
curl -sS -i "${AUTH[@]}" "$B/products/999999" | tee $L/resp/STF-03.http | head -3
echo "--- body:"; tail -1 $L/resp/STF-03.http

echo "===================== STF-04 类型不匹配 ====================="
curl -sS -i "${AUTH[@]}" "$B/products/abc" | tee $L/resp/STF-04.http | head -1
tail -1 $L/resp/STF-04.http

echo "===================== STF-05 分类计数真实性 ====================="
curl -sS "${AUTH[@]}" "$B/products/category-counts" | cap STF-05

echo "===================== STF-06/07 推荐 + 销量榜 ====================="
curl -sS -o $L/resp/STF-06.json -w 'recommend=%{http_code}\n' "${AUTH[@]}" "$B/products/recommend/6"
curl -sS "${AUTH[@]}" "$B/products/sales-top/3" | cap STF-07
q "select id,name,sales_volume from product order by sales_volume desc limit 3;" | tee $L/sql/db-salestop.out

echo "===================== STF-08/09/10 工作树新增三端点(公开) ====================="
for ep in "related?limit=3" "bought-together?limit=3" "complete-the-look?limit=3"; do
  curl -sS -o $L/resp/STF-new-$(echo $ep|cut -d'?' -f1).json -w "$ep = %{http_code}\n" "$B/products/1/$ep"
done

echo "===================== STF-11/12 搜索建议 + 趋势 ====================="
curl -sS -i "$B/search/suggestions?q=耳" > $L/resp/STF-11.http; head -1 $L/resp/STF-11.http
curl -sS "$B/search/trending" | cap STF-12
q "select name from product order by sales_volume desc;" | tee $L/sql/db-productnames.out

echo "===================== STF-13/14 搜索 + facets ====================="
curl -sS "${CT[@]}" -X POST "$B/search" -d '{"q":"","page":1,"limit":20}' | cap STF-13a
curl -sS "${CT[@]}" -X POST "$B/search" -d '{"q":"","page":1,"limit":20}' | cap STF-13b
python3 - <<'PY'
import json
def load(p):
    return json.load(open(p))['data']
a=load('/tmp/qa-b/resp/STF-13a.json'); b=load('/tmp/qa-b/resp/STF-13b.json')
print('relatedSearches a=',a.get('relatedSearches'))
print('relatedSearches b=',b.get('relatedSearches'))
print('deterministic=', a.get('relatedSearches')==b.get('relatedSearches'))
print('facets=',json.dumps(a.get('facets'),ensure_ascii=False))
print('total=',a.get('total'))
PY
# 15 分类筛选是否生效
curl -sS "${CT[@]}" -X POST "$B/search" -d '{"q":"","category":"不存在分类XYZ","page":1,"limit":20}' | cap STF-15-bad
curl -sS "${CT[@]}" -X POST "$B/search" -d '{"q":"","page":1,"limit":20}' | cap STF-15-none
python3 - <<'PY'
import json
def tot(p): return json.load(open(p))['data']['total']
print('bad-category total=',tot('/tmp/qa-b/resp/STF-15-bad.json'),' no-category total=',tot('/tmp/qa-b/resp/STF-15-none.json'))
PY

echo "===================== STF-16/17/18 公开店铺 ====================="
curl -sS -i "$B/merchants/1/profile" > $L/resp/STF-16.http; head -1 $L/resp/STF-16.http
python3 - <<'PY'
import json
raw=open('/tmp/qa-b/resp/STF-16.http').read(); body=raw.split('\r\n\r\n',1)[1]
print(json.dumps(json.loads(body),ensure_ascii=False))
PY
curl -sS -i "$B/merchants/999999/profile" | tee $L/resp/STF-17.http | head -1
tail -1 $L/resp/STF-17.http
curl -sS -o $L/resp/STF-18.json -w 'storeproducts=%{http_code}\n' "$B/merchants/1/products?page=1&limit=5"
q "select count(*) from product where shop_id=1;" | tee $L/sql/db-shop1-products.out

echo "===================== CART-01..05 购物车(user1) ====================="
q "select id,user_id,product_id,quantity from shopping_cart order by id;" | tee $L/sql/db-cart-before.out
echo "--- CART-01 add product 1 x2"
curl -sS -i "${AUTH[@]}" "${CT[@]}" -X POST "$B/shoppingCart/add" -d '{"productId":1,"quantity":2}' > $L/resp/CART-01.http
head -1 $L/resp/CART-01.http; tail -1 $L/resp/CART-01.http
echo "--- CART-02 add again x3 (merge?)"
curl -sS -i "${AUTH[@]}" "${CT[@]}" -X POST "$B/shoppingCart/add" -d '{"productId":1,"quantity":3}' > $L/resp/CART-02.http
head -1 $L/resp/CART-02.http
q "select id,user_id,product_id,quantity from shopping_cart order by id;" | tee $L/sql/db-cart-after-add.out
echo "--- CART-03 page"
curl -sS -i "${AUTH[@]}" "$B/shoppingCart/page?pageNum=1&pageSize=100" > $L/resp/CART-03.http
head -1 $L/resp/CART-03.http; tail -1 $L/resp/CART-03.http
ROW=$(q "select id from shopping_cart where user_id=1 and product_id=1 limit 1;")
echo "rowId=$ROW"
echo "--- CART-04 update qty 7"
curl -sS -i "${AUTH[@]}" "${CT[@]}" -X PUT "$B/shoppingCart/update" -d "{\"id\":$ROW,\"quantity\":7}" > $L/resp/CART-04.http
head -1 $L/resp/CART-04.http
q "select id,quantity from shopping_cart where id=$ROW;" | tee $L/sql/db-cart-after-update.out
echo "--- CART-06 未登记端点(应 403)"
for m in "GET /shoppingCart/list" "GET /shoppingCart/selectById/1" "POST /shoppingCart/createOrder"; do
  verb=${m%% *}; path=${m##* }
  code=$(curl -sS -o $L/resp/CART-06-$(echo $path|tr '/' '_').json -w '%{http_code}' "${AUTH[@]}" "${CT[@]}" -X $verb "$B$path")
  echo "$m -> $code"
done
echo "--- CART-08 user2 删 user1 的行(id=$ROW)"
curl -sS -i "${A2[@]}" "${CT[@]}" -X DELETE "$B/shoppingCart/delBatch" -d "[$ROW]" > $L/resp/CART-08.http
head -1 $L/resp/CART-08.http; tail -1 $L/resp/CART-08.http
q "select id,user_id,product_id,quantity from shopping_cart where id=$ROW;" | tee $L/sql/db-cart-after-user2-delete.out
echo "--- CART-07 user2 改 user1 的行(id=$ROW) 数量=99"
curl -sS -i "${A2[@]}" "${CT[@]}" -X PUT "$B/shoppingCart/update" -d "{\"id\":$ROW,\"quantity\":99}" > $L/resp/CART-07.http
head -1 $L/resp/CART-07.http; tail -1 $L/resp/CART-07.http
q "select id,user_id,quantity from shopping_cart where id=$ROW;" | tee $L/sql/db-cart-after-user2-update.out
echo "--- CART-09 匿名"
curl -sS -o /dev/null -w 'anon_cart_page=%{http_code}\n' "$B/shoppingCart/page?pageNum=1&pageSize=10"
echo "--- 复原:把 user1 行改回 2"
curl -sS -o /dev/null -w 'restore=%{http_code}\n' "${AUTH[@]}" "${CT[@]}" -X PUT "$B/shoppingCart/update" -d "{\"id\":$ROW,\"quantity\":2}"
q "select id,user_id,quantity from shopping_cart order by id;" | tee $L/sql/db-cart-final.out
