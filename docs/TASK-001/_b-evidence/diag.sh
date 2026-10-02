#!/usr/bin/env bash
# diag.sh — 只跑 StorefrontPromoTest,打印 TMPDIAG 输出
cd /workspace
mvn -B test -Dtest=StorefrontPromoTest -DfailIfNoSpecifiedTests=false > /tmp/qa-d-diag.log 2>&1
echo "EXIT=$?"
grep -E "TMPDIAG|Tests run:" /tmp/qa-d-diag.log | head -20
