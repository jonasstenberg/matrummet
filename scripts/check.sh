#!/usr/bin/env bash
# Keep successful checks quiet, but preserve diagnostics and status on failure.
set -uo pipefail
label="$1"
command="$2"
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root" || exit 1
log_file=$(mktemp)
trap 'rm -f "$log_file"' EXIT
if bash -o pipefail -c "$command" > "$log_file" 2>&1; then
  printf '✓ %s\n' "$label"
else
  status=$?
  cat "$log_file" >&2
  printf '✗ %s\n' "$label" >&2
  exit "$status"
fi
