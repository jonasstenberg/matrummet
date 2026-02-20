# Execution Phases — test-and-commit

## Phase 1: Run All Unit Tests

```bash
pnpm check:test
```

| Result   | Action                               |
| -------- | ------------------------------------ |
| All pass | Continue to Phase 2                  |
| Failures | Fix failing tests, re-run until pass |

If failures are in changed files, fix them. If failures are pre-existing/unrelated, inform user and ask how to proceed.

## Phase 2: Run API Integration Tests

**This phase is required when database/schema changes are involved.** Check for migration or API-related changes:

```bash
git diff --cached --name-only | grep -E '(flyway/sql|tests/api)' && echo "Schema/API changes detected" || echo "No schema changes"
```

### If schema/API changes detected:

1. **Check if Docker test environment is running:**
   ```bash
   curl -sf http://localhost:4445/ > /dev/null 2>&1 && echo "Test API available" || echo "Test API not running"
   ```

2. **If not running, start it:**
   ```bash
   docker-compose -f docker-compose.test.yml up -d
   sleep 5
   ```

3. **If running but migration files changed, recreate to pick up new migrations:**
   ```bash
   docker-compose -f docker-compose.test.yml down -v && docker-compose -f docker-compose.test.yml up -d
   sleep 5
   ```

4. **Run integration tests:**
   ```bash
   pnpm check:api
   ```

5. **Handle failures:**
   - Fix snapshot mismatches (e.g., update `ALLOWED_ANON_TABLES`, schema snapshots)
   - Fix permission issues (e.g., missing `GRANT` after `DROP CASCADE` + recreate)
   - Re-run until pass

### If no schema/API changes:

Check if Docker is running and run `pnpm check:api` if available. Skip if not available (don't block commit for missing test infra when no schema changes were made).

## Phase 3: Lint All Packages

```bash
pnpm check:lint
```

| Result | Action                                         |
| ------ | ---------------------------------------------- |
| Pass   | Continue to Phase 4                            |
| Errors | Fix auto-fixable errors, then fix remaining    |

## Phase 4: Review Changes

1. Run `git status` to see all changed files
2. Run `git diff` to review staged and unstaged changes
3. Identify which files should be committed together
4. If mixed changes (feature + unrelated), use AskUserQuestion:
   - **Commit all** — Include all changes in one commit
   - **Split commits** — User specifies which files per commit

## Phase 5: Commit

1. Stage relevant files: `git add <files>`
2. Check recent commit messages for style: `git log --oneline -10`
3. Commit following the repository's commit style using HEREDOC format:
   ```bash
   git commit -m "$(cat <<'EOF'
   <descriptive commit message matching repo style>
   EOF
   )"
   ```

## Guidelines

- Run unit tests before lint (faster feedback loop)
- Use `pnpm check:*` commands to minimize context usage
- Fix test failures before committing
- Ask user before committing if changes span multiple concerns
- Follow existing commit message style from `git log`
