# Contributing to Matrummet

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `pnpm install`
3. Copy environment files:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp apps/email-service/.env.example apps/email-service/.env.local
   ```
4. Start the database and run migrations (see README.md)
5. Start the dev server: `pnpm dev`

## Making Changes

### Before You Start

- Check existing issues and PRs to avoid duplicate work
- For large changes, open an issue first to discuss the approach

### Code Style

- TypeScript is used throughout
- ESLint and Prettier are configured — run `pnpm check:lint` before committing
- Follow existing patterns in the codebase

### Commit Messages

Keep them clear and concise:
- `feat: add ingredient search`
- `fix: correct Swedish search stemming`
- `docs: update API examples`
- `refactor: simplify recipe validation`

### Testing

Run tests before submitting:

```bash
pnpm check          # Lint + unit tests
pnpm check:api      # API integration tests (requires Docker)
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass
4. Submit a PR with a clear description of what and why

## Database Changes

- Add migrations in `flyway/sql/` using the naming convention `V{version}__{description}.sql`
- Test migrations locally before submitting
- Include rollback considerations in your PR description

## Questions?

Open an issue or start a discussion. Happy to help!
