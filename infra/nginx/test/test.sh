#!/usr/bin/env bash
# Test production nginx configs in a Docker container with mock upstreams.
# Configs are mounted to their exact production paths — no rewriting.
# Usage: ./infra/nginx/test/test.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NGINX_DIR="$(dirname "$SCRIPT_DIR")"

IMAGE="matrummet-nginx-test"
CONTAINER="matrummet-nginx-test"
HTTP=18080
HTTPS=18443

GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# --- Helpers ---

pass() { printf "  ${GREEN}✓${NC} %s\n" "$1"; ((PASS++)); }
fail() { printf "  ${RED}✗${NC} %s\n" "$1"; ((FAIL++)); }

# Curl wrapper that always succeeds (captures output, never exits on error)
_curl() { curl -sSk --max-time 5 "$@" 2>/dev/null || true; }

assert_status() {
    local desc="$1" expected="$2" url="$3"
    shift 3
    local status
    status=$(_curl -o /dev/null -w "%{http_code}" "$@" "$url")
    if [[ "$status" == "$expected" ]]; then
        pass "$desc"
    else
        fail "$desc (expected $expected, got $status)"
    fi
}

assert_redirect() {
    local desc="$1" url="$2" expected="$3"
    shift 3
    local headers location
    headers=$(_curl -D- -o /dev/null "$@" "$url")
    location=$(echo "$headers" | grep -i "^location:" | head -1 | tr -d '\r\n' | sed 's/^[Ll]ocation: *//' || true)
    if [[ -n "$location" ]] && echo "$location" | grep -q "$expected"; then
        pass "$desc"
    else
        fail "$desc (location: '$location', expected to contain '$expected')"
    fi
}

assert_upstream() {
    local desc="$1" expected="$2" url="$3"
    shift 3
    local body actual
    body=$(_curl "$@" "$url")
    actual=$(echo "$body" | jq -r '.upstream // empty' 2>/dev/null || true)
    if [[ "$actual" == "$expected" ]]; then
        pass "$desc"
    else
        fail "$desc (expected upstream '$expected', got '$actual')"
    fi
}

assert_path() {
    local desc="$1" expected="$2" url="$3"
    shift 3
    local body actual
    body=$(_curl "$@" "$url")
    actual=$(echo "$body" | jq -r '.path // empty' 2>/dev/null || true)
    if [[ "$actual" == "$expected" ]]; then
        pass "$desc"
    else
        fail "$desc (expected path '$expected', got '$actual')"
    fi
}

assert_header() {
    local desc="$1" header="$2" expected="$3" url="$4"
    shift 4
    local headers values
    headers=$(_curl -D- -o /dev/null "$@" "$url")
    # Check ALL matching headers (e.g. multiple Cache-Control lines)
    values=$(echo "$headers" | grep -i "^${header}:" | tr -d '\r' || true)
    if [[ -n "$values" ]] && echo "$values" | grep -qi "$expected"; then
        pass "$desc"
    else
        fail "$desc ('$header' = '$(echo "$values" | head -1 | tr -d '\n')', expected '$expected')"
    fi
}

# Resolve flags — curl sends correct SNI + Host header for each domain
R_MAIN="--resolve matrummet.se:${HTTP}:127.0.0.1 --resolve matrummet.se:${HTTPS}:127.0.0.1"
R_WWW="--resolve www.matrummet.se:${HTTP}:127.0.0.1 --resolve www.matrummet.se:${HTTPS}:127.0.0.1"
R_OLD="--resolve mat.stenberg.io:${HTTP}:127.0.0.1 --resolve mat.stenberg.io:${HTTPS}:127.0.0.1"
R_API="--resolve api.matrummet.se:${HTTP}:127.0.0.1 --resolve api.matrummet.se:${HTTPS}:127.0.0.1"

# --- Build & Start ---

echo "Building test image..."
docker build -q -t "$IMAGE" -f "$SCRIPT_DIR/Dockerfile" "$NGINX_DIR" >/dev/null 2>&1

echo "Checking config syntax..."
if ! docker run --rm --entrypoint nginx "$IMAGE" -t 2>&1 | tail -1; then
    echo "nginx config has syntax errors"
    exit 1
fi

echo "Starting container..."
cleanup
docker run -d --name "$CONTAINER" -p "$HTTP:80" -p "$HTTPS:443" "$IMAGE" >/dev/null

# Wait for nginx
for _ in $(seq 1 30); do
    if curl -sk --max-time 2 -o /dev/null \
        --resolve "matrummet.se:${HTTPS}:127.0.0.1" \
        "https://matrummet.se:${HTTPS}/" 2>/dev/null; then
        break
    fi
    sleep 0.2
done

# ========================= TESTS =========================

echo ""
printf "${BOLD}=== Redirects ===${NC}\n"

assert_redirect "HTTP matrummet.se → HTTPS" \
    "http://matrummet.se:${HTTP}/" "https://matrummet.se" \
    $R_MAIN

assert_redirect "HTTP www.matrummet.se → HTTPS" \
    "http://www.matrummet.se:${HTTP}/" "https://" \
    $R_WWW

assert_redirect "HTTP mat.stenberg.io → matrummet.se" \
    "http://mat.stenberg.io:${HTTP}/" "https://matrummet.se" \
    $R_OLD

assert_redirect "HTTPS mat.stenberg.io → matrummet.se" \
    "https://mat.stenberg.io:${HTTPS}/" "https://matrummet.se" \
    $R_OLD

assert_redirect "HTTP api.matrummet.se → HTTPS" \
    "http://api.matrummet.se:${HTTP}/" "https://api.matrummet.se" \
    $R_API

echo ""
printf "${BOLD}=== Routing (matrummet.se) ===${NC}\n"

assert_upstream "/ → app" "app" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

assert_upstream "/db/recipes → postgrest" "postgrest" \
    "https://matrummet.se:${HTTPS}/db/recipes" $R_MAIN

assert_path "/db/recipes path rewritten to /recipes" "/recipes" \
    "https://matrummet.se:${HTTPS}/db/recipes" $R_MAIN

assert_upstream "/api/upload → images" "images" \
    "https://matrummet.se:${HTTPS}/api/upload" $R_MAIN

assert_path "/api/upload path rewritten to /upload" "/upload" \
    "https://matrummet.se:${HTTPS}/api/upload" $R_MAIN

assert_upstream "/api/images/pic.jpg → images" "images" \
    "https://matrummet.se:${HTTPS}/api/images/pic.jpg" $R_MAIN

assert_path "/api/images/ path rewritten" "/images/pic.jpg" \
    "https://matrummet.se:${HTTPS}/api/images/pic.jpg" $R_MAIN

assert_status "/uploads/test.jpg → static file (200)" "200" \
    "https://matrummet.se:${HTTPS}/uploads/test.jpg" $R_MAIN

assert_upstream "/assets/foo.js → app" "app" \
    "https://matrummet.se:${HTTPS}/assets/foo.js" $R_MAIN

assert_upstream "/api/auth/login → app" "app" \
    "https://matrummet.se:${HTTPS}/api/auth/login" $R_MAIN -X POST

assert_upstream "/api/admin/foods/ai-review → app" "app" \
    "https://matrummet.se:${HTTPS}/api/admin/foods/ai-review" $R_MAIN

assert_upstream "/db/rpc/login → postgrest" "postgrest" \
    "https://matrummet.se:${HTTPS}/db/rpc/login" $R_MAIN -X POST

assert_path "/db/rpc/login path rewritten to /rpc/login" "/rpc/login" \
    "https://matrummet.se:${HTTPS}/db/rpc/login" $R_MAIN -X POST

echo ""
printf "${BOLD}=== Routing (health checks) ===${NC}\n"

assert_upstream "/health/email → email" "email" \
    "https://matrummet.se:${HTTPS}/health/email" $R_MAIN

assert_upstream "/health/events → events" "events" \
    "https://matrummet.se:${HTTPS}/health/events" $R_MAIN

assert_upstream "/health/images → images" "images" \
    "https://matrummet.se:${HTTPS}/health/images" $R_MAIN

assert_upstream "/health/db → postgrest" "postgrest" \
    "https://matrummet.se:${HTTPS}/health/db" $R_MAIN

assert_path "/health/db proxied to /" "/" \
    "https://matrummet.se:${HTTPS}/health/db" $R_MAIN

echo ""
printf "${BOLD}=== Routing (api.matrummet.se) ===${NC}\n"

assert_upstream "/ → postgrest" "postgrest" \
    "https://api.matrummet.se:${HTTPS}/" $R_API

assert_upstream "/rpc/login → postgrest" "postgrest" \
    "https://api.matrummet.se:${HTTPS}/rpc/login" $R_API -X POST

assert_upstream "/upload → images" "images" \
    "https://api.matrummet.se:${HTTPS}/upload" $R_API -X POST

assert_upstream "/images/pic.jpg → images" "images" \
    "https://api.matrummet.se:${HTTPS}/images/pic.jpg" $R_API

echo ""
printf "${BOLD}=== Security Headers (matrummet.se) ===${NC}\n"

assert_header "X-Frame-Options on /" \
    "X-Frame-Options" "DENY" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

assert_header "X-Content-Type-Options on /" \
    "X-Content-Type-Options" "nosniff" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

assert_header "Strict-Transport-Security on /" \
    "Strict-Transport-Security" "max-age=" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

assert_header "Content-Security-Policy on /" \
    "Content-Security-Policy" "default-src" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

assert_header "Referrer-Policy on /" \
    "Referrer-Policy" "strict-origin" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

# Location blocks with own add_header — security headers must still be present
assert_header "Security headers survive /assets/ add_header" \
    "X-Frame-Options" "DENY" \
    "https://matrummet.se:${HTTPS}/assets/foo.js" $R_MAIN

assert_header "Security headers survive /uploads/ add_header" \
    "X-Frame-Options" "DENY" \
    "https://matrummet.se:${HTTPS}/uploads/test.jpg" $R_MAIN

assert_header "Security headers survive /api/images/ add_header" \
    "X-Frame-Options" "DENY" \
    "https://matrummet.se:${HTTPS}/api/images/pic.jpg" $R_MAIN

echo ""
printf "${BOLD}=== Security Headers (api.matrummet.se) ===${NC}\n"

assert_header "X-Frame-Options on /" \
    "X-Frame-Options" "DENY" \
    "https://api.matrummet.se:${HTTPS}/" $R_API

assert_header "Security headers on /images/" \
    "X-Frame-Options" "DENY" \
    "https://api.matrummet.se:${HTTPS}/images/pic.jpg" $R_API

assert_header "Security headers on rate-limited /rpc/login" \
    "X-Frame-Options" "DENY" \
    "https://api.matrummet.se:${HTTPS}/rpc/login" $R_API -X POST

echo ""
printf "${BOLD}=== CORS (api.matrummet.se) ===${NC}\n"

assert_header "Access-Control-Allow-Origin on responses" \
    "Access-Control-Allow-Origin" "*" \
    "https://api.matrummet.se:${HTTPS}/recipes" $R_API

assert_header "Access-Control-Expose-Headers on responses" \
    "Access-Control-Expose-Headers" "Content-Range" \
    "https://api.matrummet.se:${HTTPS}/recipes" $R_API

assert_status "OPTIONS preflight returns 204" "204" \
    "https://api.matrummet.se:${HTTPS}/recipes" $R_API -X OPTIONS

assert_header "Preflight Allow-Methods" \
    "Access-Control-Allow-Methods" "GET" \
    "https://api.matrummet.se:${HTTPS}/recipes" $R_API -X OPTIONS

assert_header "Preflight Max-Age" \
    "Access-Control-Max-Age" "86400" \
    "https://api.matrummet.se:${HTTPS}/recipes" $R_API -X OPTIONS

# CORS on rate-limited RPC endpoints
assert_status "OPTIONS on /rpc/login returns 204" "204" \
    "https://api.matrummet.se:${HTTPS}/rpc/login" $R_API -X OPTIONS

assert_header "CORS on /rpc/login response" \
    "Access-Control-Allow-Origin" "*" \
    "https://api.matrummet.se:${HTTPS}/rpc/login" $R_API -X POST

echo ""
printf "${BOLD}=== Cache Headers ===${NC}\n"

assert_header "/assets/ has immutable Cache-Control" \
    "Cache-Control" "immutable" \
    "https://matrummet.se:${HTTPS}/assets/foo.js" $R_MAIN

assert_header "/uploads/ has immutable Cache-Control" \
    "Cache-Control" "immutable" \
    "https://matrummet.se:${HTTPS}/uploads/test.jpg" $R_MAIN

echo ""
printf "${BOLD}=== Rate Limiting ===${NC}\n"

# Login zone: 5r/m with burst=10 — first 11 pass, then 429
GOT_429=false
for i in $(seq 1 15); do
    status=$(_curl -o /dev/null -w "%{http_code}" -X POST \
        $R_MAIN "https://matrummet.se:${HTTPS}/api/auth/login")
    if [[ "$status" == "429" ]]; then
        GOT_429=true
        break
    fi
done
if $GOT_429; then
    pass "/api/auth/login rate limited (429 after $i requests)"
else
    fail "/api/auth/login not rate limited (no 429 in 15 requests)"
fi

# Zone is shared — API /rpc/login should also be rate limited now
assert_status "Login zone shared: API /rpc/login also 429" "429" \
    "https://api.matrummet.se:${HTTPS}/rpc/login" $R_API -X POST

# Non-rate-limited endpoint still works
assert_status "Non-limited / still returns 200" "200" \
    "https://matrummet.se:${HTTPS}/" $R_MAIN

# ========================= SUMMARY =========================

echo ""
echo "════════════════════════════════"
if [[ "$FAIL" -eq 0 ]]; then
    printf "  ${GREEN}${BOLD}%d passed${NC}, %d failed\n" "$PASS" "$FAIL"
else
    printf "  %d passed, ${RED}${BOLD}%d failed${NC}\n" "$PASS" "$FAIL"
fi
echo "════════════════════════════════"

[[ "$FAIL" -eq 0 ]]
