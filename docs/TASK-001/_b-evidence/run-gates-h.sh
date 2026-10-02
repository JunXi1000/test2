#!/usr/bin/env bash
# run-gates-h.sh — TASK-002-H:G1(后端)+ G2(前端五项)原始输出
set -u
cd /workspace

echo "########## G1: mvn -B clean test ##########"
pkill -f '[s]pring-boot:run' 2>/dev/null || true
pkill -f '[P]rojectManagement' 2>/dev/null || true
sleep 2
mvn -B clean test > /tmp/qa-h-mvn.log 2>&1
echo "MVN_EXIT=$?"
grep -E '^\[INFO\] Tests run:.*Failures|^\[ERROR\] Tests run:|BUILD (SUCCESS|FAILURE)' /tmp/qa-h-mvn.log | tail -6
echo "--- 失败用例(若有) ---"
grep -E '<<< (FAILURE|ERROR)' /tmp/qa-h-mvn.log | head -20

echo
echo "########## G2: 前端五项 ##########"
cd /workspace/web
echo "=== G2-1 vue-tsc (src) ==="
npx vue-tsc --noEmit > /tmp/qa-h-tsc-src.log 2>&1; echo "TSC_SRC_EXIT=$?"
echo "=== G2-2 vue-tsc -p tsconfig.test.json ==="
npx vue-tsc --noEmit -p tsconfig.test.json > /tmp/qa-h-tsc-test.log 2>&1; echo "TSC_TEST_EXIT=$?"
echo "=== G2-3 vitest run ==="
npx vitest run > /tmp/qa-h-vitest.log 2>&1; echo "VITEST_EXIT=$?"
echo "=== G2-4 build-prod ==="
npm run build-prod > /tmp/qa-h-build.log 2>&1; echo "BUILD_EXIT=$?"
echo "=== G2-5 lint ==="
npm run lint > /tmp/qa-h-lint.log 2>&1; echo "LINT_EXIT=$?"

echo
echo "########## 摘要 ##########"
for f in tsc-src tsc-test vitest build lint; do
  echo "--- /tmp/qa-h-$f.log (tail) ---"
  tail -8 /tmp/qa-h-$f.log
done
