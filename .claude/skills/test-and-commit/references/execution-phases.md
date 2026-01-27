# Execution Phases — test-and-commit

## Phase 1: Run All Unit Tests

```bash
.claude/hooks/run-silent.sh "Tests" "pnpm test --run"
```

| Result   | Action                               |
| -------- | ------------------------------------ |
| All pass | Continue to Phase 2                  |
| Failures | Fix failing tests, re-run until pass |

If failures are in changed files, fix them. If failures are pre-existing/unrelated, inform user and ask how to proceed.

## Phase 2: Run API Integration Tests (Optional)

Check if the test Docker environment is running:

```bash
curl -sf http://localhost:4445/ > /dev/null 2>&1 && echo "Test API available" || echo "Test API not running"
```

If available:

```bash
.claude/hooks/run-silent.sh "API Tests" "pnpm test:api"
```

If not available, inform user and skip (don't block commit for missing test infra).

## Phase 3: Lint All Packages

```bash
.claude/hooks/run-silent.sh "Lint" "pnpm lint"
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
- Use `run-silent.sh` wrapper to minimize context usage
- Fix test failures before committing
- Ask user before committing if changes span multiple concerns
- Follow existing commit message style from `git log`
