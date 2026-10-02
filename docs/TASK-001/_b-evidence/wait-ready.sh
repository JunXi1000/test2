#!/usr/bin/env bash
# wait-ready.sh — 正确等就绪:收到**非 000** 的 HTTP 响应码即成立
for i in $(seq 1 120); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:1000/ 2>/dev/null)
  case "$code" in
    ""|"000") sleep 1 ;;
    *) echo "READY after ${i}s: GET / -> HTTP $code"; exit 0 ;;
  esac
done
echo "NOT READY after 120s"
echo "--- backend log tail ---"
tail -40 /tmp/qa-d-backend.log
exit 1
