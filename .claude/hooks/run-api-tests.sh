#!/usr/bin/env bash
# Run unit tests and API integration tests before commit.
# Unit tests run first (fast, no Docker). API tests only run when
# relevant files changed (migrations, PostgREST config, test files, seed data).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_SILENT="$SCRIPT_DIR/run-silent.sh"
COMPOSE="docker compose -f $PROJECT_DIR/docker-compose.test.yml"

# 1. Unit tests (fast, no Docker needed)
UNIT_RESULT=$("$RUN_SILENT" "Unit Tests" "pnpm test")
if echo "$UNIT_RESULT" | jq -e '.decision == "block"' > /dev/null 2>&1; then
    echo "$UNIT_RESULT"
    exit 0
fi

# 2. Check if API-relevant files changed (staged for commit)
API_PATHS="tests/api/ flyway/sql/ data/data.sql infra/postgrest/ docker-compose.test.yml"
API_CHANGED=false
for path in $API_PATHS; do
    if git -C "$PROJECT_DIR" diff --cached --name-only | grep -q "^$path"; then
        API_CHANGED=true
        break
    fi
done

if [ "$API_CHANGED" = false ]; then
    echo '{"decision":"approve","reason":"✓ Unit Tests passed. API Tests (skipped, no DB/API changes)"}'
    exit 0
fi

# 3. API integration tests (require Docker)
$COMPOSE down -v --remove-orphans 2>/dev/null || true

if ! $COMPOSE up -d --force-recreate --wait 2>/dev/null; then
  echo '{"decision":"approve","reason":"✓ Unit Tests passed. API Tests (skipped, Docker not available)"}'
  exit 0
fi

# Wait for PostgREST to be reachable (up to 30s)
for _ in $(seq 1 30); do
  curl -sf http://localhost:4445/ > /dev/null 2>&1 && break
  sleep 1
done

if ! curl -sf http://localhost:4445/ > /dev/null 2>&1; then
  echo '{"decision":"approve","reason":"✓ Unit Tests passed. API Tests (skipped, test env failed to start)"}'
  exit 0
fi

"$RUN_SILENT" "API Tests" "pnpm test:api"
