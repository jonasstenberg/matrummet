#!/bin/bash

# Cleanup orphaned uploaded images that are not referenced by any recipe.
# Runs in dry-run mode by default — pass --delete to actually remove files.
#
# Usage:
#   ./scripts/cleanup-orphaned-images.sh           # dry-run (report only)
#   ./scripts/cleanup-orphaned-images.sh --delete   # actually delete orphans

set -euo pipefail

UPLOADS_DIR="${UPLOADS_DIR:-/opt/recept/apps/frontend/public/uploads}"
GRACE_HOURS="${GRACE_HOURS:-24}"
DB_NAME="${DB_NAME:-recept}"
DB_USER="${DB_USER:-recept}"
DELETE=false
UUID_PATTERN='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

usage() {
    cat <<EOF
Usage: $(basename "$0") [--delete] [--help]

Delete uploaded image directories not referenced by any recipe.
Dry-run by default — only reports what would be removed.

Options:
  --delete    Actually remove orphaned directories (default: dry-run)
  --help      Show this help message

Environment variables:
  UPLOADS_DIR   Path to uploads directory (default: /opt/recept/apps/frontend/public/uploads)
  GRACE_HOURS   Skip orphans newer than this many hours (default: 24)
  DB_NAME       PostgreSQL database name (default: recept)
  DB_USER       PostgreSQL user (default: recept)
EOF
    exit 0
}

for arg in "$@"; do
    case "$arg" in
        --delete) DELETE=true ;;
        --help|-h) usage ;;
        *) echo "Unknown argument: $arg"; usage ;;
    esac
done

if [ ! -d "$UPLOADS_DIR" ]; then
    echo "Error: Uploads directory does not exist: $UPLOADS_DIR"
    exit 1
fi

# Collect all UUID directories on disk
disk_uuids=()
for dir in "$UPLOADS_DIR"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    if [[ "$name" =~ $UUID_PATTERN ]]; then
        disk_uuids+=("$name")
    fi
done

total=${#disk_uuids[@]}

if [ "$total" -eq 0 ]; then
    echo "No UUID directories found in $UPLOADS_DIR"
    exit 0
fi

# Query DB for all image/thumbnail UUIDs referenced by recipes, filtering out URLs
referenced_file=$(mktemp)
trap 'rm -f "$referenced_file"' EXIT

psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
    SELECT DISTINCT unnest(ARRAY[image, thumbnail]) AS image_id
    FROM recipes
    WHERE image IS NOT NULL OR thumbnail IS NOT NULL;
" 2>/dev/null | grep -v '^https\?://' | grep -v '^$' | sort -u > "$referenced_file" || true

referenced_count=$(wc -l < "$referenced_file" | tr -d ' ')

# Identify orphans and apply grace period
now=$(date +%s)
grace_seconds=$((GRACE_HOURS * 3600))
orphaned=0
deleted=0
skipped_new=0
deleted_list=()
skipped_list=()

for uuid in "${disk_uuids[@]}"; do
    if grep -qx "$uuid" "$referenced_file"; then
        continue
    fi

    orphaned=$((orphaned + 1))
    dir_path="$UPLOADS_DIR/$uuid"

    # Check directory age (mtime)
    if [[ "$(uname)" == "Darwin" ]]; then
        mtime=$(stat -f %m "$dir_path")
    else
        mtime=$(stat -c %Y "$dir_path")
    fi
    age=$((now - mtime))

    if [ "$age" -lt "$grace_seconds" ]; then
        skipped_new=$((skipped_new + 1))
        hours_old=$(( age / 3600 ))
        skipped_list+=("$uuid (${hours_old}h old)")
        continue
    fi

    if [ "$DELETE" = true ]; then
        rm -rf "$dir_path"
        deleted=$((deleted + 1))
        deleted_list+=("$uuid")
    else
        deleted_list+=("$uuid")
    fi
done

# Print summary
echo "=== Orphaned Image Cleanup ==="
echo ""
echo "Uploads directory: $UPLOADS_DIR"
echo "Grace period:      ${GRACE_HOURS}h"
echo "Mode:              $([ "$DELETE" = true ] && echo "DELETE" || echo "DRY-RUN")"
echo ""
echo "Total UUID dirs:   $total"
echo "Referenced by DB:  $referenced_count"
echo "Orphaned:          $orphaned"

if [ "$DELETE" = true ]; then
    echo "Deleted:           $deleted"
else
    echo "Would delete:      ${#deleted_list[@]}"
fi

echo "Skipped (too new): $skipped_new"

if [ ${#deleted_list[@]} -gt 0 ]; then
    echo ""
    if [ "$DELETE" = true ]; then
        echo "Deleted directories:"
    else
        echo "Would delete:"
    fi
    for item in "${deleted_list[@]}"; do
        echo "  $item"
    done
fi

if [ ${#skipped_list[@]} -gt 0 ]; then
    echo ""
    echo "Skipped (within grace period):"
    for item in "${skipped_list[@]}"; do
        echo "  $item"
    done
fi
