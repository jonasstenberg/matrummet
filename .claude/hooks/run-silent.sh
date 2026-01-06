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
    # Truncate error output for JSON
    truncated=$(echo "$error_output" | head -50 | tr '\n' ' ' | cut -c1-500)
    echo '{"decision": "block", "reason": "✗ '"$description"': '"$truncated"'"}'
    exit 0
fi
