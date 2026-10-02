#!/usr/bin/env bash
echo "--- which docker:"
which docker || echo NO_DOCKER
echo "--- direct mysql:"
echo 'select 1;' | mysql -uroot -p123456 template_v3 -N 2>&1 | tail -2
echo "--- via q() nested docker:"
q() { echo "$1" | docker exec -i nexus-dev mysql -uroot -p123456 template_v3 -N 2>/dev/null; }
q 'select id from product limit 1;'
echo "rc=$?"
echo "--- via direct mysql function:"
qq() { echo "$1" | mysql -uroot -p123456 template_v3 -N 2>/dev/null; }
qq 'select id from product limit 1;'
echo "rc2=$?"
