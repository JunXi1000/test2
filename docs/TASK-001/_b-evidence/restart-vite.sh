#!/usr/bin/env bash
# restart-vite.sh — 重启容器内 Vite dev server(它漏掉了 21:56 的 router/index.ts 变更)
pkill -f '[v]ite --host'; pkill -f '[v]ite$'; pkill -f 'node.*[v]ite'
sleep 3
cd /workspace/web
nohup npm run dev > /tmp/qa-d-vite.log 2>&1 &
echo "started, waiting for :5173 ..."
for i in $(seq 1 60); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:5173/ 2>/dev/null)
  case "$code" in
    ""|"000") sleep 1 ;;
    *) echo "VITE READY after ${i}s: GET / -> HTTP $code"; exit 0 ;;
  esac
done
echo "VITE NOT READY; log:"; tail -25 /tmp/qa-d-vite.log; exit 1
