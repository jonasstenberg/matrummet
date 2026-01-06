#!/bin/bash

# Import production recipes to local database
# Usage: ./scripts/import-production-data.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REMOTE_HOST="jonas@37.27.181.252"
REMOTE_DB="recept"
LOCAL_DB="recept"
TEMP_DIR="$ROOT_DIR/tmp"
DUMP_FILE="$TEMP_DIR/production-recipes.sql"
REMOTE_UPLOADS="/opt/recept/apps/frontend/public/uploads/"
LOCAL_UPLOADS="$ROOT_DIR/apps/frontend/public/uploads/"

echo "=== Recept Production Data Import ==="
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"

# Check SSH connectivity
echo "Checking SSH connection to production..."
if ! ssh -q -o ConnectTimeout=5 "$REMOTE_HOST" exit 2>/dev/null; then
    echo "Error: Cannot connect to $REMOTE_HOST"
    echo "Make sure you have SSH access configured."
    exit 1
fi
echo "  SSH connection OK"
echo ""

# Tables to export (in order due to foreign key constraints)
TABLES=(
    "users"
    "categories"
    "recipes"
    "ingredients"
    "instructions"
    "recipe_categories"
    "foods"
    "user_pantry"
)

echo "Exporting data from production..."
echo "  Tables: ${TABLES[*]}"
echo ""

# Build the pg_dump command for specific tables
TABLE_ARGS=""
for table in "${TABLES[@]}"; do
    TABLE_ARGS="$TABLE_ARGS -t $table"
done

# Export data from production (data only, no schema)
# Using sudo -u postgres to bypass RLS
ssh "$REMOTE_HOST" "sudo -u postgres pg_dump -d $REMOTE_DB --data-only --disable-triggers $TABLE_ARGS" > "$DUMP_FILE"

if [ ! -s "$DUMP_FILE" ]; then
    echo "Error: Export failed or no data returned"
    rm -f "$DUMP_FILE"
    exit 1
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "  Export complete: $DUMP_FILE ($DUMP_SIZE)"
echo ""

# Show summary of what will be imported
echo "Data summary:"
for table in "${TABLES[@]}"; do
    COUNT=$(grep -c "COPY public.$table " "$DUMP_FILE" 2>/dev/null || echo "0")
    if [ "$COUNT" -gt 0 ]; then
        ROWS=$(grep -A 1000000 "COPY public.$table " "$DUMP_FILE" | grep -m 1 -n '^\\\.' | cut -d: -f1)
        ROWS=$((ROWS - 1))
        echo "  $table: ~$ROWS rows"
    fi
done
echo ""

# Confirm before importing
read -p "Import this data to local database '$LOCAL_DB'? This will REPLACE existing data. (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Import cancelled."
    rm -f "$DUMP_FILE"
    exit 0
fi

echo ""
echo "Importing to local database..."

# Clear existing data in reverse order (to respect foreign keys)
echo "  Clearing existing data..."
psql -d "$LOCAL_DB" -c "
    TRUNCATE user_pantry, foods, recipe_categories, instructions, ingredients, recipes, categories CASCADE;
" 2>/dev/null || true

# Disable triggers during import (to avoid RLS and password encryption issues)
echo "  Disabling triggers..."
psql -d "$LOCAL_DB" -c "
    ALTER TABLE users DISABLE TRIGGER ALL;
    ALTER TABLE recipes DISABLE TRIGGER ALL;
    ALTER TABLE ingredients DISABLE TRIGGER ALL;
    ALTER TABLE instructions DISABLE TRIGGER ALL;
    ALTER TABLE categories DISABLE TRIGGER ALL;
    ALTER TABLE recipe_categories DISABLE TRIGGER ALL;
    ALTER TABLE foods DISABLE TRIGGER ALL;
    ALTER TABLE user_pantry DISABLE TRIGGER ALL;
"

# Import the data
echo "  Importing data..."
psql -d "$LOCAL_DB" -f "$DUMP_FILE"

# Re-enable triggers
echo "  Re-enabling triggers..."
psql -d "$LOCAL_DB" -c "
    ALTER TABLE users ENABLE TRIGGER ALL;
    ALTER TABLE recipes ENABLE TRIGGER ALL;
    ALTER TABLE ingredients ENABLE TRIGGER ALL;
    ALTER TABLE instructions ENABLE TRIGGER ALL;
    ALTER TABLE categories ENABLE TRIGGER ALL;
    ALTER TABLE recipe_categories ENABLE TRIGGER ALL;
    ALTER TABLE foods ENABLE TRIGGER ALL;
    ALTER TABLE user_pantry ENABLE TRIGGER ALL;
"

# Cleanup
rm -f "$DUMP_FILE"

echo ""
echo "=== Database import complete! ==="
echo ""

# Show counts
echo "Local database now contains:"
psql -d "$LOCAL_DB" -t -c "
    SELECT 'recipes: ' || COUNT(*) FROM recipes
    UNION ALL
    SELECT 'ingredients: ' || COUNT(*) FROM ingredients
    UNION ALL
    SELECT 'instructions: ' || COUNT(*) FROM instructions
    UNION ALL
    SELECT 'categories: ' || COUNT(*) FROM categories
    UNION ALL
    SELECT 'foods: ' || COUNT(*) FROM foods
    UNION ALL
    SELECT 'user_pantry: ' || COUNT(*) FROM user_pantry;
"

echo ""
echo "=== Downloading images ==="
echo ""

# Create local uploads directory if it doesn't exist
mkdir -p "$LOCAL_UPLOADS"

# Check how many images are on production
REMOTE_COUNT=$(ssh "$REMOTE_HOST" "find $REMOTE_UPLOADS -type f 2>/dev/null | wc -l" | tr -d ' ')
echo "Production has $REMOTE_COUNT image files"

# Download images using rsync
echo "Syncing images from production..."
rsync -avz --progress "$REMOTE_HOST:$REMOTE_UPLOADS" "$LOCAL_UPLOADS"

LOCAL_COUNT=$(find "$LOCAL_UPLOADS" -type f 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "=== All done! ==="
echo "  Database: imported"
echo "  Images: $LOCAL_COUNT files in $LOCAL_UPLOADS"
