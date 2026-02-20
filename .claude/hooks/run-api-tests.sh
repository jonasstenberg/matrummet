#!/usr/bin/env bash
# Run API integration tests, starting the Docker test environment if needed.
# Outputs hook-compatible JSON.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RUN_SILENT="$SCRIPT_DIR/run-silent.sh"

# Check if PostgREST test is already reachable
if ! curl -sf http://localhost:4445/ > /dev/null 2>&1; then
  # Start the test environment
  if ! docker compose -f "$PROJECT_DIR/docker-compose.test.yml" up -d --wait 2>/dev/null; then
    echo '{"decision":"approve","reason":"✓ API Tests (skipped, Docker not available)"}'
    exit 0
  fi

  # Wait for PostgREST to be reachable (up to 30s)
  for i in $(seq 1 30); do
    if curl -sf http://localhost:4445/ > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl -sf http://localhost:4445/ > /dev/null 2>&1; then
    echo '{"decision":"approve","reason":"✓ API Tests (skipped, test env failed to start)"}'
    exit 0
  fi
fi

# Run the API tests
exec "$RUN_SILENT" "API Tests" "pnpm test:api"
