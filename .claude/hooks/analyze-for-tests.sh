#!/bin/bash
# Hook script that analyzes code changes and outputs context for test evaluation
# Outputs plain text context for the following prompt hook to analyze

set -e

# Read hook input from stdin (required by hook protocol)
cat > /dev/null

cd "$CLAUDE_PROJECT_DIR"

# Get git diff for uncommitted changes (both staged and unstaged)
DIFF=$(git diff HEAD --name-only 2>/dev/null || echo "")
STAGED=$(git diff --cached --name-only 2>/dev/null || echo "")

# Combine and deduplicate
ALL_CHANGED=$(echo -e "$DIFF\n$STAGED" | sort -u | grep -v '^$' || echo "")

# Filter for source code files that might need tests
# Exclude: test files, config files, markdown, json, css, etc.
CODE_FILES=$(echo "$ALL_CHANGED" | grep -E '\.(ts|tsx|js|jsx)$' | \
  grep -v '\.test\.' | \
  grep -v '\.spec\.' | \
  grep -v '__tests__' | \
  grep -v 'vitest\.config' | \
  grep -v '\.config\.' | \
  grep -v 'tailwind' | \
  grep -v 'next\.config' | \
  grep -v 'eslint' || echo "")

# If no relevant code files changed, output nothing (prompt hook will approve)
if [ -z "$CODE_FILES" ]; then
  exit 0
fi

# Get the actual diff content for analysis (limited to avoid huge output)
DIFF_CONTENT=$(git diff HEAD -- $CODE_FILES 2>/dev/null | head -500 || echo "")

# Check if diff contains actual logic (not just imports/exports/types)
HAS_LOGIC=$(echo "$DIFF_CONTENT" | grep -E '^\+.*(function |const .* = |async |export (async )?function|\.map\(|\.filter\(|\.reduce\(|if \(|switch \(|try \{|catch \(|await )' | head -20 || echo "")

if [ -z "$HAS_LOGIC" ]; then
  # Changes appear to be minor (types, imports, exports only)
  exit 0
fi

# Output plain text context for the prompt hook to analyze
cat << EOF
CHANGED_FILES:
$CODE_FILES

KEY_CHANGES:
$HAS_LOGIC

DIFF_PREVIEW:
$(echo "$DIFF_CONTENT" | head -200)
EOF
