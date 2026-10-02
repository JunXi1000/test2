#!/usr/bin/env bash
# restart-backend.sh — 重启容器内 dev 后端并等就绪判据(收到真实 HTTP 响应)
cd /workspace
nohup mvn -B spring-boot:run > /tmp/qa-d-backend.log 2>&1 &
echo "started pid=$!"
for i in $(seq 1 90); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:1000/ 2>/dev/null || echo 000)
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    echo "READY after ${i}s: GET / -> HTTP $code"
    exit 0
  fi
  sleep 1
done
echo "NOT READY after 90s; log tail:"
tail -30 /tmp/qa-d-backend.log
exit 1
