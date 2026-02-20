---
name: test-and-commit
version: 1.0.0
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
- "check and commit"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                    | Gate             |
| ----- | ------------------------- | ---------------- |
| 1     | Run unit tests            | Must pass        |
| 2     | Run API integration tests | Required for schema changes |
| 3     | Lint all packages         | Must pass        |
| 4     | Review changes for commit | User approval    |
| 5     | Commit changes            | Only if all pass |

</workflow>

<execution>

## Execution

Read `.claude/skills/test-and-commit/references/execution-phases.md` for detailed phase instructions, then execute sequentially.

</execution>

<quick_reference>

## Quick Reference

```bash
# Run unit tests
pnpm check:test

# Run API tests (requires test Docker)
pnpm check:api

# Lint
pnpm check:lint

# All checks (lint + test)
pnpm check

# Git status
git status
```

</quick_reference>

<references>

## References

- [references/execution-phases.md](references/execution-phases.md) — Detailed phase execution instructions

</references>

<approval_gates>

## Approval Gates

| Gate                  | Phase | Question                                              |
| --------------------- | ----- | ----------------------------------------------------- |
| Pre-existing failures | 1     | "Tests failed but unrelated to changes. Skip or fix?" |
| Commit scope          | 4     | "Commit all together or split?"                       |

</approval_gates>
