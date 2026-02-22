#!/usr/bin/env bash
# Run unit tests and API integration tests before commit.
# Unit tests run first (fast, no Docker). API tests require Docker test env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_SILENT="$SCRIPT_DIR/run-silent.sh"
COMPOSE="docker compose -f $PROJECT_DIR/docker-compose.test.yml"

# 1. Unit tests (fast, no Docker needed)
"$RUN_SILENT" "Unit Tests" "pnpm test" || exit 2

# 2. API integration tests (require Docker)
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

exec "$RUN_SILENT" "API Tests" "pnpm test:api"
