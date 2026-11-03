#!/usr/bin/env bash
# Dedicated disposable PostgreSQL cluster ONLY, listening on a local Unix socket.
# Usage: run-concurrency.sh /tmp/disposable-pg-socket nurse_b2_test_DB USER [PORT]
set -euo pipefail
[[ $# -ge 3 && $# -le 4 ]] || { echo 'Expected socket directory, disposable DB, user and optional port' >&2; exit 2; }
socket=$(realpath "$1")
[[ "$socket" == /tmp/* && -d "$socket" && "$2" == nurse_b2_test_* && "$3" =~ ^[a-zA-Z0-9_]+$ && "${4:-5432}" =~ ^[0-9]+$ ]] || { echo 'Only a /tmp socket and nurse_b2_test_* database are accepted' >&2; exit 2; }
command -v psql >/dev/null
out=$(mktemp -d /tmp/nurse-b2-test.XXXXXX)
trap 'rm -rf "$out"' EXIT
psqlcmd=(env -i "PATH=$PATH" psql -X -h "$socket" -p "${4:-5432}" -U "$3" -d "$2" -v ON_ERROR_STOP=1)
"${psqlcmd[@]}" -f "$(dirname "$0")/security.sql" >/dev/null
"${psqlcmd[@]}" -c "insert into auth.users values ('cccccccc-cccc-cccc-cccc-cccccccccccc')" >/dev/null
run_pair() {
 local owner=$1 rev=$2
 local stmt="set role authenticated; select set_config('request.jwt.claim.role','authenticated',false); select set_config('request.jwt.claim.is_anonymous','false',false); select set_config('request.jwt.claim.sub','$owner',false); select public.save_nurse_backup('$owner',$rev,'1.0','{\"kind\":\"nurse-interview-lab-backup\",\"schemaVersion\":\"1.0\",\"people\":[],\"reports\":[]}'::jsonb);"
 local a b
 set +e
 "${psqlcmd[@]}" -c "$stmt" >"$out/a" 2>&1 & a=$!
 "${psqlcmd[@]}" -c "$stmt" >"$out/b" 2>&1 & b=$!
 wait "$a"; a=$?; wait "$b"; b=$?
 set -e
 if ! { [[ $a -eq 0 && $b -ne 0 ]] || [[ $b -eq 0 && $a -ne 0 ]]; } || ! grep -q revision_conflict "$out/a" "$out/b"; then
  cat "$out/a" "$out/b" >&2; echo 'Concurrency test failed' >&2; exit 1
 fi
}
run_pair cccccccc-cccc-cccc-cccc-cccccccccccc null
run_pair aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa 2
echo 'PASS: concurrent create and concurrent update each have exactly one winner'
