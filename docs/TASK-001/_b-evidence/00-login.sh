#!/usr/bin/env bash
# 00-login.sh — 取三种角色 token + 运行态版本探针
set -u
B=http://localhost:1000
L=/tmp/qa-b
mkdir -p $L/tokens $L/resp $L/sql

login() {
  local name=$1 user=$2 type=$3
  echo "### LOGIN $name ($user/$type)"
  curl -sS -i -X POST $B/common/login -H 'Content-Type: application/json' \
    -d "{\"username\":\"$user\",\"password\":\"123456\",\"type\":\"$type\"}" > $L/resp/login-$name.http
  head -1 $L/resp/login-$name.http
  python3 - <<PY
import json,re,sys
raw=open("$L/resp/login-$name.http").read()
body=raw.split("\r\n\r\n",1)[1] if "\r\n\r\n" in raw else raw.split("\n\n",1)[1]
d=json.loads(body)
tok=d.get("data")
print("code=",d.get("code"),"msg=",d.get("msg"),"token_type=",type(tok).__name__,"len=",len(tok) if isinstance(tok,str) else None)
open("$L/tokens/$name.txt","w").write(tok if isinstance(tok,str) else "")
PY
}

login admin admin ADMIN
login user1 user1 USER
login shop1 shop1 SHOP
login shop2 shop2 SHOP
login user2 user2 USER

echo "### 运行态版本探针:工作树新增端点 /products/1/related"
curl -sS -o $L/resp/probe-related.json -w 'related=%{http_code}\n' "$B/products/1/related?limit=3"
echo "### HEAD 无此端点(对照):/nosuch-endpoint"
curl -sS -o /dev/null -w 'nosuch=%{http_code}\n' "$B/nosuch-endpoint-xyz"
echo "### 后端进程启动时间"
ps -o etime=,lstart= -p $(pgrep -f '[P]rojectManagement' | head -1) 2>/dev/null || echo "no ProjectManagement process found"
echo "### 源码 mtime"
ls -l --time-style=full-iso /workspace/src/main/java/com/project/platform/controller/StorefrontCheckoutController.java
