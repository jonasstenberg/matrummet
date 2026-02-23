#!/bin/bash
# Context-efficient backpressure: minimal output on success, full output on failure
# Usage: run-silent.sh "description" "command"
# Based on: https://www.humanlayer.dev/blog/context-efficient-backpressure

description="$1"
command="$2"
tmp_file=$(mktemp)

cd "$CLAUDE_PROJECT_DIR"

if eval "$command" > "$tmp_file" 2>&1; then
    rm -f "$tmp_file"
    echo '{"decision": "approve", "reason": "✓ '"$description"'"}'
    exit 0
else
    exit_code=$?
    error_output=$(cat "$tmp_file")
    rm -f "$tmp_file"
    # Strip ANSI codes, take the tail (failure summary), truncate, and JSON-escape
    cleaned=$(echo "$error_output" | sed 's/\x1b\[[0-9;]*m//g' | tail -40 | tr '\n' ' ' | sed 's/  */ /g' | cut -c1-800)
    escaped=$(echo "$cleaned" | jq -Rsa '.')
    escaped=${escaped:1:${#escaped}-2}
    echo '{"decision": "block", "reason": "✗ '"$description"': '"$escaped"'"}'
    exit 0
fi
