# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a recipe management database backend using PostgreSQL with PostgREST as the REST API layer. The system stores recipes with ingredients, instructions, and categories, and uses JWT-based authentication with row-level security (RLS).

## Commands

### Database Migrations (Flyway)

```bash
# Install Flyway (macOS)
brew install flyway

# Check migration status
./flyway/run-flyway.sh info

# Apply pending migrations (auto-creates backup first)
./flyway/run-flyway.sh migrate

# Apply migrations and import seed data (auto-creates backup first)
./flyway/run-flyway.sh migrate-seed

# Import seed data only
./flyway/run-flyway.sh seed

# For existing database, baseline first (marks V1 as applied)
./flyway/run-flyway.sh baseline

# Validate migrations
./flyway/run-flyway.sh validate
```

Migrations are stored in `flyway/sql/` with naming convention `V{version}__{description}.sql`.
Seed data is stored in `data/data.sql`.

### Database Backup/Restore

Backups are automatically created before migrations. You can also manage them manually:

```bash
# Create a manual backup
./flyway/run-flyway.sh backup

# List available backups
./flyway/run-flyway.sh list-backups

# Restore from most recent backup
./flyway/run-flyway.sh restore

# Restore from a specific backup file
./flyway/run-flyway.sh restore recept_pre-migrate_20231215_143022.sql
```

Backups are stored in `flyway/backups/` and are excluded from git.

### Running PostgREST

```bash
# Start the API server using the startup script
./start-postgrest.sh

# Or run directly (requires postgrest to be installed)
postgrest postgrest.cfg
```

The API runs on port 4444 and connects to the `recept` database.

## Architecture

### Database Schema

The schema uses JWT claims for ownership (`request.jwt.claims->>'email'`) and enforces row-level security on all tables:

- **users** / **user_passwords**: Authentication with bcrypt password hashing via trigger
- **recipes**: Core recipe data with full-text search vector (`tsv`)
- **ingredients**: Recipe ingredients with measurement and quantity
- **instructions**: Recipe steps
- **categories**: Recipe categories (many-to-many via `recipe_categories`)

### Key Database Functions

- `insert_recipe()` / `update_recipe()`: Atomic recipe operations that handle categories, ingredients, and instructions together
- `login()` / `signup()` / `signup_provider()`: Authentication functions
- `reset_password()`: Password change with validation

### Views

- `recipes_and_categories`: Aggregates recipes with their categories, ingredients, and instructions; includes Swedish full-text search vector (`full_tsv`)

### Row-Level Security Pattern

All tables follow the same RLS pattern:

- SELECT: Public read (`USING (true)`) except for user tables
- INSERT/UPDATE/DELETE: Owner-only based on JWT email claim
