#!/usr/bin/env bash
# PreToolUse hook: run API integration tests before any git commit.
# Reads tool input from stdin, checks if command contains "git commit",
# and runs API tests only if so.

set -euo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

if ! echo "$COMMAND" | grep -q 'git commit'; then
  exit 0
fi

exec bash "$(dirname "$0")/run-api-tests.sh"
