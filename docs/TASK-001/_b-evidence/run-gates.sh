#!/usr/bin/env bash
# run-gates.sh — 在容器内跑 G1(后端) 与 G2(前端四项 + lint),原始输出落 /tmp/qa-d-*.log
set -u
cd /workspace

echo "########## G1: mvn -B clean test ##########"
mvn -B clean test > /tmp/qa-d-mvn.log 2>&1
echo "MVN_EXIT=$?"
grep -E "Tests run:.*Failures|BUILD (SUCCESS|FAILURE)|ERROR\]" /tmp/qa-d-mvn.log | tail -20
echo "--- 汇总行 ---"
grep -E "^\[INFO\] Tests run:|^Tests run:" /tmp/qa-d-mvn.log | tail -5
echo "--- 失败用例(若有) ---"
grep -E "^\[ERROR\].*Test.*(FAIL|ERROR)|<<< (FAILURE|ERROR)" /tmp/qa-d-mvn.log | head -30

echo
echo "########## G2: 前端四项 + lint ##########"
cd /workspace/web

echo "=== G2-1 vue-tsc --noEmit (src) ==="
npx vue-tsc --noEmit > /tmp/qa-d-tsc-src.log 2>&1
echo "TSC_SRC_EXIT=$?"

echo "=== G2-2 vue-tsc --noEmit -p tsconfig.test.json (tests) ==="
npx vue-tsc --noEmit -p tsconfig.test.json > /tmp/qa-d-tsc-test.log 2>&1
echo "TSC_TEST_EXIT=$?"

echo "=== G2-3 vitest run ==="
npx vitest run > /tmp/qa-d-vitest.log 2>&1
echo "VITEST_EXIT=$?"

echo "=== G2-4 build-prod ==="
npm run build-prod > /tmp/qa-d-build.log 2>&1
echo "BUILD_EXIT=$?"

echo "=== G2-5 lint(核对无新增告警) ==="
npm run lint > /tmp/qa-d-lint.log 2>&1
echo "LINT_EXIT=$?"

echo
echo "########## 摘要 ##########"
for f in tsc-src tsc-test vitest build lint; do
  echo "--- /tmp/qa-d-$f.log (tail) ---"
  tail -12 /tmp/qa-d-$f.log
done
