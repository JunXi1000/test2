#!/usr/bin/env bash
# g2-detail.sh — 提取 G2 四项失败的**完整**原始输出
echo "########## TSC-SRC (full) ##########"
cat /tmp/qa-d-tsc-src.log
echo
echo "########## TSC-TEST (full) ##########"
cat /tmp/qa-d-tsc-test.log
echo
echo "########## VITEST (failures only) ##########"
grep -nE "FAIL|✕|×|AssertionError|expected|Expected|Received|→|Test Files|Tests " /tmp/qa-d-vitest.log | head -60
echo
echo "########## LINT: error 行 ##########"
grep -nE "^\s+[0-9]+:[0-9]+\s+error|problems \(" /tmp/qa-d-lint.log
echo "--- lint 全文尾部 ---"
tail -40 /tmp/qa-d-lint.log
