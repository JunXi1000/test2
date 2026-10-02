#!/usr/bin/env bash
# TASK-002-Z Lead 独立终验：亲自复跑 G1/G2 闸门，并把环境恢复到"可交付"状态。
# 不依赖任何 agent 的结论；只读取磁盘上的工作树与容器。
set -u
cd /workspace
L=/tmp/z-gates
mkdir -p "$L"

echo "=== 0) 停止 dev 后端（否则 clean 删不掉被 JVM 占用的 target/） ==="
pkill -f "[s]pring-boot:run" 2>/dev/null
pkill -f "[P]rojectManagement" 2>/dev/null
sleep 3
pgrep -f "[P]rojectManagement" >/dev/null && echo "  警告：后端进程仍在" || echo "  已停止"

echo "=== G1) docker 内 mvn -B clean test ==="
mvn -B clean test > "$L/mvn.log" 2>&1
echo "  mvn_exit=$?"
grep -E "^\[INFO\] Tests run:|Tests run:.*Failures" "$L/mvn.log" | tail -3
grep -E "BUILD (SUCCESS|FAILURE)" "$L/mvn.log" | tail -1

cd /workspace/web
echo "=== G2-1) vue-tsc --noEmit (src) ==="
npx vue-tsc --noEmit > "$L/tsc-src.log" 2>&1; echo "  exit=$?"
echo "=== G2-2) vue-tsc --noEmit -p tsconfig.test.json ==="
npx vue-tsc --noEmit -p tsconfig.test.json > "$L/tsc-test.log" 2>&1; echo "  exit=$?"
echo "=== G2-3) vitest run ==="
npx vitest run > "$L/vitest.log" 2>&1; echo "  exit=$?"
grep -E "Test Files|Tests  " "$L/vitest.log" | tail -3
echo "=== G2-4) npm run build-prod ==="
npm run build-prod > "$L/build.log" 2>&1; echo "  exit=$?"
echo "=== G2-5) npm run lint ==="
npm run lint > "$L/lint.log" 2>&1; echo "  exit=$?"
grep -E "problems? \(" "$L/lint.log" | tail -2

echo "=== 3) 恢复运行态：重启后端与前端（setsid 脱离会话，避免 SIGHUP 被杀） ==="
cd /workspace
setsid nohup mvn spring-boot:run > /var/log/backend.log 2>&1 < /dev/null &
pkill -f "[v]ite" 2>/dev/null; sleep 2
cd /workspace/web
setsid nohup npx vite --host > /var/log/frontend.log 2>&1 < /dev/null &
cd /workspace
# 注意：不能写 `$(curl ... || echo 000)` —— curl 失败时自己已输出 000，
# 叠加后成 "000000"，会被下面误判为"就绪"。判定必须先取到非空且非 000 的值。
ready_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 4 http://127.0.0.1:1000/ 2>/dev/null; }
for i in $(seq 1 20); do
  sleep 10
  c=$(ready_code); c=${c:-000}
  echo "  backend t+$((i*10))s -> $c"
  if [ "$c" != "000" ] && [ -n "$c" ]; then echo "  READY=$c"; break; fi
done
for i in $(seq 1 12); do
  f=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 http://127.0.0.1:5173/ 2>/dev/null || echo 000)
  [ "$f" = "200" ] && { echo "  frontend READY=$f"; break; }
  sleep 5
done
echo "=== DONE ==="
