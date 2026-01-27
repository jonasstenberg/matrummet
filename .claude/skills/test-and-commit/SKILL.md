---
name: test-and-commit
description: Run all tests (vitest), lint (eslint), and commit changes. Use when user says "test and commit", "run tests and commit", "verify and commit", or "CI and commit".
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
context: fork
---

# Test and Commit

> Run tests, lint, then commit — ensuring code quality before every commit.

<when_to_use>

## When to Use

Invoke when user says:

- "test and commit"
- "run tests and commit"
- "verify and commit"
- "CI and commit"
</when_to_use>

<workflow>

## Workflow Overview

| Phase | Action                              | Gate             |
| ----- | ----------------------------------- | ---------------- |
| 1     | Run all unit tests                  | Must pass        |
| 2     | Run API integration tests           | If available     |
| 3     | Lint all packages                   | Must pass        |
| 4     | Review changes for commit           | User approval    |
| 5     | Commit changes                      | Only if all pass |

</workflow>

<phases>

### Phase 1: Run All Unit Tests

Run the full test suite across the monorepo:

```bash
.claude/hooks/run-silent.sh "Tests" "pnpm test --run"
```

| Result   | Action                               |
| -------- | ------------------------------------ |
| All pass | Continue to Phase 2                  |
| Failures | Fix failing tests, re-run until pass |

If failures are in changed files, fix them. If failures are pre-existing/unrelated, inform user and ask how to proceed.

---

### Phase 2: Run API Integration Tests (Optional)

Check if the test Docker environment is running:

```bash
curl -sf http://localhost:4445/ > /dev/null 2>&1 && echo "Test API available" || echo "Test API not running"
```

If available, run API tests:

```bash
.claude/hooks/run-silent.sh "API Tests" "pnpm test:api"
```

If not available, inform user and skip (don't block commit for missing test infra).

---

### Phase 3: Lint All Packages

```bash
.claude/hooks/run-silent.sh "Lint" "pnpm lint"
```

| Result | Action                                         |
| ------ | ---------------------------------------------- |
| Pass   | Continue to Phase 4                            |
| Errors | Fix auto-fixable errors, then fix remaining    |

---

### Phase 4: Review Changes

1. Run `git status` to see all changed files
2. Run `git diff` to review staged and unstaged changes
3. Identify which files should be committed together
4. If mixed changes (feature + unrelated), use AskUserQuestion:

```typescript
{
  questions: [{
    question: "Some changes appear unrelated. Commit all together or split?",
    header: "Scope",
    options: [
      { label: "Commit all", description: "Include all changes in one commit" },
      { label: "Split commits", description: "I'll specify which files per commit" }
    ],
    multiSelect: false
  }]
}
```

---

### Phase 5: Commit

1. Stage relevant files:
   ```bash
   git add <files>
   ```

2. Check recent commit messages for style:
   ```bash
   git log --oneline -10
   ```

3. Commit following the repository's commit style:
   ```bash
   git commit -m "$(cat <<'EOF'
   <descriptive commit message matching repo style>
   EOF
   )"
   ```

</phases>

<approval_gates>

## Approval Gates

| Gate                  | Phase | Question                                              |
| --------------------- | ----- | ----------------------------------------------------- |
| Pre-existing failures | 1     | "Tests failed but unrelated to changes. Skip or fix?" |
| Commit scope          | 4     | "Commit all together or split?"                       |

</approval_gates>

<quick_reference>

## Quick Reference

```bash
# Phase 1: Unit tests (all packages)
pnpm test --run

# Phase 2: API integration tests
pnpm test:api

# Phase 3: Lint
pnpm lint

# Context-efficient versions
.claude/hooks/run-silent.sh "Tests" "pnpm test --run"
.claude/hooks/run-silent.sh "Lint" "pnpm lint"
.claude/hooks/run-silent.sh "API Tests" "pnpm test:api"
```

</quick_reference>

<guidelines>

## Guidelines

- Run unit tests before lint (faster feedback loop)
- Use `run-silent.sh` wrapper to minimize context usage
- Fix test failures before committing
- Ask user before committing if changes span multiple concerns
- Follow existing commit message style from `git log`
</guidelines>
