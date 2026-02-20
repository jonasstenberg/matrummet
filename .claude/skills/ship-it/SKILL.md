---
name: ship-it
version: 1.1.0
description: Full implementation pipeline from idea to commit. Explores codebase, plans, validates plan, implements, reviews work, reviews code, tests, commits, and validates with user story acceptance tests. Use when user says "ship it", "full pipeline", "end to end", or wants complete implementation workflow.
allowed-tools: Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Skill, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, EnterPlanMode
---

# Ship It — Full Implementation Pipeline

> End-to-end pipeline: Explore, Plan, Validate, Implement, Check Work, Check Code, Test & Commit, Acceptance Test.

**Not for**: Quick fixes or single-file edits. Use individual skills directly for targeted work.

<when_to_use>

## When to Use

Invoke when user says:

- "ship it"
- "full pipeline"
- "end to end"
- "implement this feature fully"
- "complete implementation workflow"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                       | Tool / Skill             | Gate              |
| ----- | ---------------------------- | ------------------------ | ----------------- |
| 0     | Create blocked task chain    | TaskCreate/TaskUpdate    | -                 |
| 1     | Explore codebase             | Task (Explore agent)     | -                 |
| 2     | Plan implementation          | EnterPlanMode            | User approves     |
| 3     | Validate plan                | Skill: check-your-plan   | User decides      |
| 4     | Implement changes            | Direct coding            | -                 |
| 5     | Check work (bugs/security)   | Skill: check-your-work   | User decides      |
| 6     | Check code (quality/pattern) | Skill: check-your-code   | User decides      |
| 7     | Validate (test + acceptance) | Bash + run-user-stories  | All must pass     |
| 8     | Commit                       | Git                      | User approves     |

</workflow>

<execution>

## Execution

Read `.claude/skills/ship-it/references/pipeline-phases.md` for detailed phase instructions, then execute.

</execution>

<references>

## References

- [references/pipeline-phases.md](references/pipeline-phases.md) — Detailed phase execution instructions

</references>

<approval_gates>

## Approval Gates

| Gate              | Phase | Mechanism                                      |
| ----------------- | ----- | ---------------------------------------------- |
| Plan approval     | 2     | ExitPlanMode — user approves plan              |
| Plan validation   | 3     | AskUserQuestion: Revise / Proceed / Start over |
| Work review       | 5     | AskUserQuestion: Fix P0 / Fix P0+P1 / Report   |
| Code review       | 6     | AskUserQuestion: Improve / Accept / Discuss    |
| Validation fail   | 7     | AskUserQuestion: Fix / Skip / Mark known issue |
| Commit scope      | 8     | AskUserQuestion: Commit all / Split            |

Each gate pauses for explicit user decision. Never auto-advance past a gate.

</approval_gates>
