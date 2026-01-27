---
name: test-and-commit
description: Run all tests (vitest), lint (eslint), and commit changes. Use when user says "test and commit", "run tests and commit", "verify and commit", or "CI and commit".
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, AskUserQuestion
context: fork
---

# Test and Commit

> Run tests, lint, then commit — ensuring code quality before every commit.

## Execution

Read `.claude/skills/test-and-commit/references/execution-phases.md` for detailed phase instructions, then execute sequentially:

| Phase | Action                    | Gate             |
| ----- | ------------------------- | ---------------- |
| 1     | Run unit tests            | Must pass        |
| 2     | Run API integration tests | If available     |
| 3     | Lint all packages         | Must pass        |
| 4     | Review changes for commit | User approval    |
| 5     | Commit changes            | Only if all pass |

## Approval Gates

| Gate                  | Phase | Question                                              |
| --------------------- | ----- | ----------------------------------------------------- |
| Pre-existing failures | 1     | "Tests failed but unrelated to changes. Skip or fix?" |
| Commit scope          | 4     | "Commit all together or split?"                       |
