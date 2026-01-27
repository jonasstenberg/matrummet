---
name: ship-it
description: Full implementation pipeline from idea to commit. Explores codebase, plans, validates plan, implements, reviews work, reviews code, tests, and commits. Use when user says "ship it", "full pipeline", "end to end", or wants complete implementation workflow.
allowed-tools: Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Skill, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, EnterPlanMode
---

# Ship It — Full Implementation Pipeline

> End-to-end pipeline: Explore, Plan, Validate, Implement, Check Work, Check Code, Test & Commit.

**Not for**: Quick fixes or single-file edits. Use individual skills directly for targeted work.

## Execution

Read `.claude/skills/ship-it/references/pipeline-phases.md` for detailed phase instructions, then execute:

| Phase | Action                       | Tool / Skill           | Gate              |
| ----- | ---------------------------- | ---------------------- | ----------------- |
| 0     | Create blocked task chain    | TaskCreate/TaskUpdate  | -                 |
| 1     | Explore codebase             | Task (Explore agent)   | -                 |
| 2     | Plan implementation          | EnterPlanMode          | User approves     |
| 3     | Validate plan                | Skill: check-your-plan | User decides      |
| 4     | Implement changes            | Direct coding          | -                 |
| 5     | Check work (bugs/security)   | Skill: check-your-work | User decides      |
| 6     | Check code (quality/pattern) | Skill: check-your-code | User decides      |
| 7     | Test, lint, commit           | Skill: test-and-commit | Tests must pass   |

## Approval Gates

| Gate              | Phase | Mechanism                                      |
| ----------------- | ----- | ---------------------------------------------- |
| Plan approval     | 2     | ExitPlanMode — user approves plan              |
| Plan validation   | 3     | AskUserQuestion: Revise / Proceed / Start over |
| Work review       | 5     | AskUserQuestion: Fix P0 / Fix P0+P1 / Report  |
| Code review       | 6     | AskUserQuestion: Improve / Accept / Discuss    |
| Commit scope      | 7     | AskUserQuestion: Commit all / Split            |

Each gate pauses for explicit user decision. Never auto-advance past a gate.
