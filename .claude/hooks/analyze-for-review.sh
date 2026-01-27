#!/bin/bash
# Stop hook that analyzes code changes and determines if code review is warranted
# Uses .claude/.last-review marker to prevent re-triggering after review is done

set -e

cat > /dev/null  # consume stdin

cd "$CLAUDE_PROJECT_DIR"

MARKER="$CLAUDE_PROJECT_DIR/.claude/.last-review"

# Check if review was already done for current changes
if [ -f "$MARKER" ]; then
  MARKER_TIME=$(stat -f %m "$MARKER" 2>/dev/null || echo "0")

  # Get latest modified time of any changed file
  LATEST_CHANGE="0"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    FTIME=$(stat -f %m "$f" 2>/dev/null || echo "0")
    if [ "$FTIME" -gt "$LATEST_CHANGE" ] 2>/dev/null; then
      LATEST_CHANGE="$FTIME"
    fi
  done <<< "$(git diff HEAD --name-only 2>/dev/null)"

  if [ "$LATEST_CHANGE" != "0" ] && [ "$MARKER_TIME" -ge "$LATEST_CHANGE" ] 2>/dev/null; then
    echo "REVIEW_ALREADY_DONE"
    exit 0
  fi
fi

# Get all changed files
DIFF=$(git diff HEAD --name-only 2>/dev/null || echo "")
STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")
ALL_CHANGED=$(printf '%s\n%s' "$DIFF" "$STAGED" | sort -u | grep -v '^$' || echo "")

# Filter for code files (exclude tests, configs, docs)
CODE_FILES=$(echo "$ALL_CHANGED" | grep -E '\.(ts|tsx|js|jsx|sql)$' | \
  grep -v '\.test\.' | \
  grep -v '\.spec\.' | \
  grep -v '__tests__' | \
  grep -v '\.config\.' | \
  grep -v 'node_modules' | \
  grep -v '\.claude/' || echo "")

if [ -z "$CODE_FILES" ]; then
  echo "NO_CODE_CHANGES"
  exit 0
fi

# Count lines changed (additions + deletions)
LINES_CHANGED=$(git diff HEAD -- $CODE_FILES 2>/dev/null | grep -c '^[+-]' || echo "0")

# Check for security-sensitive changes
SECURITY_FILES=$(echo "$CODE_FILES" | grep -iE '(auth|login|jwt|password|rls|policy)' || echo "")
SQL_FILES=$(echo "$CODE_FILES" | grep -E '\.sql$' || echo "")

# Count files
FILE_COUNT=$(echo "$CODE_FILES" | wc -l | tr -d ' ')

# Minor changes: fewer than 30 lines, no security files, no SQL
if [ "$LINES_CHANGED" -lt 30 ] && [ -z "$SECURITY_FILES" ] && [ -z "$SQL_FILES" ]; then
  echo "MINOR_CHANGES"
  exit 0
fi

cat << EOF
REVIEW_RECOMMENDED
FILES_CHANGED: $FILE_COUNT
LINES_CHANGED: $LINES_CHANGED
SECURITY_SENSITIVE: $([ -n "$SECURITY_FILES" ] && echo "YES" || echo "NO")
SQL_MIGRATIONS: $([ -n "$SQL_FILES" ] && echo "YES" || echo "NO")

CHANGED_FILES:
$CODE_FILES
$([ -n "$SECURITY_FILES" ] && printf '\nSECURITY_FILES:\n%s' "$SECURITY_FILES")
$([ -n "$SQL_FILES" ] && printf '\nSQL_FILES:\n%s' "$SQL_FILES")
EOF
