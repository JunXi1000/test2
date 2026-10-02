#!/usr/bin/env bash
# regen-tokens.sh — JVM 重启后重新签发各角色 token
set -u
L=/tmp/qa-b
mkdir -p $L/tokens
login() {
  local name=$1 user=$2 type=$3
  local tok
  tok=$(curl -sS -X POST http://localhost:1000/common/login \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"$user\",\"password\":\"123456\",\"type\":\"$type\"}" \
        | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("data") or "")')
  printf '%s' "$tok" > $L/tokens/$name.txt
  echo "$name len=${#tok}"
}
login admin admin ADMIN
login user1 user1 USER
login user2 user2 USER
login shop1 shop1 SHOP
login shop2 shop2 SHOP
# 供 80h 脚本复用的"新用户"占位(它自己会注册新的)
cp $L/tokens/user1.txt $L/tokens/newuser.txt 2>/dev/null || true
