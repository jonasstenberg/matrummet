# Flyway Database Migrations

This directory contains the database migrations for Matrummet.

## Structure

```
flyway/
├── sql/                    # Active migrations
│   └── V1__initial_schema.sql
├── flyway.conf            # Flyway configuration
├── run-flyway.sh          # Helper script to run Flyway
├── backups/               # Database backup files
└── archived_migrations/   # (gitignored) Historical migrations
```

## Running Migrations

### Prerequisites

- PostgreSQL database running
- `FLYWAY_PASSWORD` environment variable set

### Using Docker (recommended)

```bash
./run-flyway.sh migrate
```

### Using Flyway CLI

```bash
flyway -configFiles=flyway.conf migrate
```

## Migration History

The current `V1__initial_schema.sql` was created by merging 74 incremental migrations for the open source release. The original migration files are preserved in `archived_migrations/` (gitignored) for reference.

### Original Migrations (merged)

The merged migration includes all schema changes from:
- V1 through V74 (including V6.1 and V6.2)
- Authentication system (JWT, roles, RLS policies)
- Recipe management (recipes, ingredients, instructions)
- Food and unit reference data with Swedish seed data
- Shopping lists and pantry tracking
- Homes feature (shared households)
- Email service integration
- AI credits system
- Full-text search with pg_trgm
- Security hardening and RLS policies

## Configuration

See `flyway.conf` for database connection settings. Key settings:

- **URL:** `jdbc:postgresql://localhost:5432/matrummet`
- **User:** `matrummet`
- **Schemas:** `public`, `auth`
- **Baseline on Migrate:** `true` (allows starting from existing database)

## Fresh Installation

For a new installation:

1. Create the PostgreSQL database and user:
   ```sql
   CREATE USER matrummet WITH PASSWORD 'your-password';
   CREATE DATABASE matrummet OWNER matrummet;
   ```

2. Run migrations:
   ```bash
   FLYWAY_PASSWORD=your-password ./run-flyway.sh migrate
   ```

The migration will create all required schemas, tables, functions, triggers, and seed data.
