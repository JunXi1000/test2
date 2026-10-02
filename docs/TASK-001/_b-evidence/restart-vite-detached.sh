#!/usr/bin/env bash
# restart-vite-detached.sh — 用 setsid 真正脱离会话地重启 Vite(避免随 docker exec 会话退出而终止)
set -u
pkill -f '[v]ite' 2>/dev/null
sleep 3
cd /workspace/web
setsid nohup npm run dev > /tmp/qa-d-vite.log 2>&1 < /dev/null &
disown 2>/dev/null || true
for i in $(seq 1 60); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:5173/ 2>/dev/null)
  case "$code" in
    ""|"000") sleep 1 ;;
    *) echo "VITE READY after ${i}s: GET / -> HTTP $code"; exit 0 ;;
  esac
done
echo "VITE NOT READY"; tail -20 /tmp/qa-d-vite.log; exit 1
