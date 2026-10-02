#!/usr/bin/env bash
# count-tests.sh — 逐类与合计后端用例数(核对 192 的构成)
cd /workspace/target/surefire-reports
total=0
for f in *.txt; do
  n=$(grep -m1 'Tests run:' "$f" | sed 's/.*Tests run: \([0-9]*\).*/\1/')
  name=$(echo "$f" | sed 's/^TEST-com\.project\.platform\.//; s/\.txt$//')
  echo "$n	$name"
  total=$((total + n))
done | sort -rn
echo "-----"
echo "TOTAL=$total"
