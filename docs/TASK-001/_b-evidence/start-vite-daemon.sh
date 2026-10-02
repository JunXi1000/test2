#!/usr/bin/env bash
# start-vite-daemon.sh — 用 setsid -f(完全脱离会话)启 Vite,再独立探活
set -u
pkill -f 'node.*/vite' 2>/dev/null || true
pkill -f 'npm run dev' 2>/dev/null || true
sleep 3
echo "setsid path: $(command -v setsid || echo MISSING)"
cd /workspace/web
setsid -f npm run dev > /tmp/qa-d-vite.log 2>&1 < /dev/null
echo "launched via setsid -f; sleeping 8s"
sleep 8
echo "--- procs after start ---"
ps -eo pid,etime,cmd | grep -E '[v]ite' | head -5
echo "--- probe ---"
curl -sS -o /dev/null -w 'probe=%{http_code}\n' --max-time 5 http://localhost:5173/ || true
