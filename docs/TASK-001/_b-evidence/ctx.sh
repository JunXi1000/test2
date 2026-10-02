#!/usr/bin/env bash
# ctx.sh — 读 BLK-I1 失败的 Playwright error-context
d=$(ls -d /workspace/web/test-results/*Ad-84f96* 2>/dev/null | head -1)
echo "DIR=$d"
if [ -n "$d" ] && [ -f "$d/error-context.md" ]; then
  sed -n '1,90p' "$d/error-context.md"
else
  echo "no context; listing:"
  ls /workspace/web/test-results/ | head -20
fi
