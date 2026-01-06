#!/bin/bash
# Context-efficient backpressure: minimal output on success, full output on failure
# Usage: run-silent.sh "description" "command"
# Based on: https://www.humanlayer.dev/blog/context-efficient-backpressure

description="$1"
command="$2"
tmp_file=$(mktemp)

cd "$CLAUDE_PROJECT_DIR"

if eval "$command" > "$tmp_file" 2>&1; then
    printf "✓ %s\n" "$description"
    rm -f "$tmp_file"
    exit 0
else
    exit_code=$?
    printf "✗ %s\n" "$description"
    echo "---"
    cat "$tmp_file"
    rm -f "$tmp_file"
    exit $exit_code
fi
