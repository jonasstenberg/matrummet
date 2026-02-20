#!/bin/bash
# PreToolUse hook: suggests run-silent for pnpm build/lint/test commands
# Reads hook input from stdin, outputs JSON decision

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Only process Bash tool calls
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

# Check if command matches pnpm build/lint/test (but not already wrapped)
if echo "$COMMAND" | grep -qE '^(pnpm (build|lint|test)|cd .* && pnpm (build|lint|test))' && \
   ! echo "$COMMAND" | grep -q 'run-silent'; then

  # Extract the pnpm command
  PNPM_CMD=$(echo "$COMMAND" | grep -oE 'pnpm (build|lint|test)( --[a-z]+)*')
  SCRIPT_NAME=$(echo "$PNPM_CMD" | awk '{print $2}')

  cat << EOF
{
  "decision": "block",
  "reason": "Use context-efficient output: .claude/hooks/run-silent.sh \"$SCRIPT_NAME\" \"$PNPM_CMD\""
}
EOF
  exit 0
fi

# Allow all other commands
exit 0
