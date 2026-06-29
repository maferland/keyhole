#!/usr/bin/env bash
# Headless end-to-end contract test for get-secret.
# Asserts the core guarantee: the secret value never appears on stdout/stderr,
# lands in the destination correctly, and cross-origin POSTs are rejected.
set -uo pipefail

CLI="$(cd "$(dirname "$0")/.." && pwd)/bin/get-secret"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SECRET='sk-SELFTEST-do-not-leak-7f3a91'
fail=0
note() { printf '  %s\n' "$1"; }
check() { if eval "$2"; then printf 'ok   - %s\n' "$1"; else printf 'FAIL - %s\n' "$1"; fail=1; fi; }

token_from() { sed -n "s#.*127.0.0.1:$1\(/[^ ]*\).*#\1#p" "$2" | head -1; }

# ---- file: destination -------------------------------------------------------
SEC="$TMP/secret.out"
BROWSER=true "$CLI" SELFTEST_FILE --dest "file:$SEC" --port 8791 --timeout 15 \
  >"$TMP/o" 2>"$TMP/e" &
PID=$!
sleep 1
TOK="$(token_from 8791 "$TMP/e")"

# cross-origin POST must be rejected
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:8791${TOK}/submit" \
  -H 'Origin: http://evil.example' -H 'content-type: application/x-www-form-urlencoded' \
  --data-urlencode "secret=$SECRET")
check "cross-origin POST rejected (403)" "[ '$code' = '403' ]"

# legit submit
curl -s -o /dev/null -X POST "http://127.0.0.1:8791${TOK}/submit" \
  -H 'content-type: application/x-www-form-urlencoded' --data-urlencode "secret=$SECRET"
wait $PID; rc=$?

check "CLI exited 0 after store" "[ $rc -eq 0 ]"
check "stdout has the reference" "grep -q SELFTEST_FILE '$TMP/o'"
check "stdout does NOT leak the secret" "! grep -q '$SECRET' '$TMP/o'"
check "stderr does NOT leak the secret" "! grep -q '$SECRET' '$TMP/e'"
check "value stored in file" "grep -q '$SECRET' '$SEC'"
perms=$(stat -f '%Lp' "$SEC" 2>/dev/null || stat -c '%a' "$SEC")
check "file is mode 0600" "[ '$perms' = '600' ]"

# ---- timeout path ------------------------------------------------------------
BROWSER=true "$CLI" SELFTEST_TIMEOUT --dest "file:$TMP/never" --port 8792 --timeout 1 \
  >"$TMP/to" 2>"$TMP/te"
check "timeout exits 2" "[ $? -eq 2 ]"
check "timeout stores nothing" "[ ! -f '$TMP/never' ]"

# ---- keychain: destination (macOS only) -------------------------------------
if [ "$(uname)" = "Darwin" ]; then
  BROWSER=true "$CLI" SELFTEST_KC --dest keychain --port 8793 --timeout 15 \
    >"$TMP/ko" 2>"$TMP/ke" &
  PID=$!; sleep 1
  TOK="$(token_from 8793 "$TMP/ke")"
  curl -s -o /dev/null -X POST "http://127.0.0.1:8793${TOK}/submit" \
    -H 'content-type: application/x-www-form-urlencoded' --data-urlencode "secret=$SECRET"
  wait $PID
  got=$(security find-generic-password -s SELFTEST_KC -a "$USER" -w 2>/dev/null)
  check "keychain readback matches" "[ '$got' = '$SECRET' ]"
  check "keychain stdout does NOT leak the secret" "! grep -q '$SECRET' '$TMP/ko'"
  security delete-generic-password -s SELFTEST_KC -a "$USER" >/dev/null 2>&1
else
  note "skipping keychain leg (not macOS)"
fi

echo
[ $fail -eq 0 ] && echo "ALL PASS" || echo "FAILURES"
exit $fail
