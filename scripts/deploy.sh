#!/usr/bin/env bash
# Deploys the working tree to the server, rebuilds the sync image, forces a site rebuild, waits for it,
# and verifies the result against what the web container actually serves.
#
#   scripts/deploy.sh                     deploy and check the site is serving a new build
#   scripts/deploy.sh --grep 'some text'  also require that text to appear in the served home page
#
# Environment: DEPLOY_HOST (ssh alias, default "pc"), DEPLOY_DIR (default "dev/digital-garden"),
# DEPLOY_PORT (web port on the server, default 8093). Nothing here is specific to one tailnet.
set -euo pipefail
host="${DEPLOY_HOST:-pc}"
dir="${DEPLOY_DIR:-dev/digital-garden}"
port="${DEPLOY_PORT:-8093}"
grep_for=""
[ "${1:-}" = "--grep" ] && grep_for="${2:?--grep needs a value}"

cd "$(dirname "$0")/.."

status() { ssh "$host" "cd $dir && docker compose exec -T sync node -e \"fetch('http://127.0.0.1:3000/api/status').then(r=>r.json()).then(j=>console.log(JSON.stringify(j)))\""; }

before=$(status | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).buildId))")

echo "1/4 copying files to $host:$dir"
rsync -a --delete \
  --exclude node_modules --exclude data --exclude .env --exclude tests/.out \
  --exclude test-results --exclude .git --exclude .quartz-cache --exclude public \
  ./ "$host:$dir/"

echo "2/4 rebuilding the sync image (--build is required, or the old code keeps running)"
ssh "$host" "cd $dir && docker compose up -d --build sync" 2>&1 | tail -3

echo "3/4 forcing a site rebuild"
ssh "$host" "cd $dir && docker compose exec -T sync node -e \"fetch('http://127.0.0.1:3000/api/sync?force=1',{method:'POST',headers:{'X-Garden':'1'}}).then(r=>r.text()).then(console.log)\""

echo "4/4 waiting for the build"
after="$before"
for _ in $(seq 1 90); do
  sleep 3
  out=$(status || true)
  state=$(echo "$out" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(j.state+' '+j.buildId+' '+(j.error||''))}catch{console.log('? ?')}})")
  set -- $state
  if [ "$1" = "idle" ] && [ "$2" != "$before" ]; then after="$2"; break; fi
  if [ "$1" = "idle" ] && [ "${3:-}" != "" ]; then echo "build failed: $state"; exit 1; fi
done
[ "$after" != "$before" ] || { echo "no new build appeared (still $before)"; exit 1; }

echo "verifying what the web container serves"
code=$(ssh "$host" "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/")
[ "$code" = "200" ] || { echo "home page returned $code"; exit 1; }
if [ -n "$grep_for" ]; then
  ssh "$host" "curl -s http://127.0.0.1:$port/" | grep -qF -- "$grep_for" || { echo "NOT FOUND in served home page: $grep_for"; exit 1; }
  echo "found: $grep_for"
fi
bind=$(ssh "$host" "docker ps --format '{{.Ports}}' | grep ':$port->' || true")
case "$bind" in 127.0.0.1:*) ;; *) echo "WARNING: port $port is not loopback-bound: $bind"; exit 1 ;; esac
echo "deployed: build $before -> $after, port bound to loopback"
