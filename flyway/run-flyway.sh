#!/bin/bash

# Flyway Migration Runner for Recept Database
# Usage: ./run-flyway.sh [command]
# Commands: migrate, info, validate, baseline, repair, clean, seed, migrate-seed,
#           backup, restore [file], list-backups

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SCRIPT_DIR/flyway.conf"
SEED_FILE="$ROOT_DIR/data/data.sql"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Database connection details
DB_NAME="recept"

# Check if flyway is installed
if ! command -v flyway &> /dev/null; then
    echo "Error: flyway is not installed"
    echo "Install with: brew install flyway (macOS)"
    echo "Or download from: https://flywaydb.org/download"
    exit 1
fi

# Function to create a database backup
create_backup() {
    local reason="${1:-manual}"
    mkdir -p "$BACKUP_DIR"

    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/recept_${reason}_${timestamp}.sql"

    echo "Creating database backup..."
    echo "  Backup file: $backup_file"

    if pg_dump -d "$DB_NAME" --clean --if-exists > "$backup_file" 2>/dev/null; then
        echo "  Backup created successfully."
        echo "$backup_file"
    else
        echo "  Warning: Backup failed (database may not exist yet)"
        rm -f "$backup_file"
        echo ""
    fi
}

# Function to restore from a backup
restore_backup() {
    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        # Find the most recent backup
        backup_file=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -n 1)
        if [ -z "$backup_file" ]; then
            echo "Error: No backup files found in $BACKUP_DIR"
            exit 1
        fi
        echo "Using most recent backup: $backup_file"
    elif [ ! -f "$backup_file" ]; then
        # Check if it's just a filename without path
        if [ -f "$BACKUP_DIR/$backup_file" ]; then
            backup_file="$BACKUP_DIR/$backup_file"
        else
            echo "Error: Backup file not found: $backup_file"
            exit 1
        fi
    fi

    echo "Restoring database from backup..."
    echo "  Backup file: $backup_file"
    echo ""
    read -p "This will overwrite the current database. Continue? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        psql -d "$DB_NAME" -f "$backup_file"
        echo "Database restored successfully."
    else
        echo "Restore cancelled."
    fi
}

# Function to list available backups
list_backups() {
    echo "Available backups in $BACKUP_DIR:"
    echo ""
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR"/*.sql 2>/dev/null)" ]; then
        ls -lh "$BACKUP_DIR"/*.sql | awk '{print "  " $9 " (" $5 ")"}'
    else
        echo "  No backups found."
    fi
}

# Function to run seed data import
run_seed() {
    if [ ! -f "$SEED_FILE" ]; then
        echo "Error: Seed file not found: $SEED_FILE"
        exit 1
    fi

    echo "Importing seed data..."
    echo "  Disabling password encryption trigger"
    psql recept -c "ALTER TABLE user_passwords DISABLE TRIGGER encrypt_password;"

    echo "  Loading data from $SEED_FILE"
    psql recept -f "$SEED_FILE"

    echo "  Re-enabling password encryption trigger"
    psql recept -c "ALTER TABLE user_passwords ENABLE TRIGGER encrypt_password;"

    echo "Seed data imported successfully."
}

# Default command is 'info'
COMMAND="${1:-info}"

cd "$SCRIPT_DIR"

case "$COMMAND" in
    seed)
        run_seed
        ;;
    backup)
        create_backup "manual"
        ;;
    restore)
        restore_backup "$2"
        ;;
    list-backups)
        list_backups
        ;;
    migrate)
        echo "=== Pre-migration backup ==="
        create_backup "pre-migrate"
        echo ""
        echo "=== Running Flyway migrate ==="
        if flyway -configFiles="$CONFIG_FILE" migrate; then
            echo ""
            echo "Migration completed successfully."
            echo "If you need to rollback, run: ./run-flyway.sh restore"
        else
            echo ""
            echo "Migration FAILED!"
            echo "To restore the database, run: ./run-flyway.sh restore"
            exit 1
        fi
        ;;
    migrate-seed)
        echo "=== Pre-migration backup ==="
        create_backup "pre-migrate"
        echo ""
        echo "=== Running Flyway migrate ==="
        if flyway -configFiles="$CONFIG_FILE" migrate; then
            echo ""
            run_seed
        else
            echo ""
            echo "Migration FAILED!"
            echo "To restore the database, run: ./run-flyway.sh restore"
            exit 1
        fi
        ;;
    *)
        echo "Running Flyway $COMMAND..."
        echo "  Config: $CONFIG_FILE"
        echo ""
        flyway -configFiles="$CONFIG_FILE" "$COMMAND"
        ;;
esac
