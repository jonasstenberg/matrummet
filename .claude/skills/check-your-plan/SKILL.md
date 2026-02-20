---
name: check-your-plan
version: 1.0.0
description: Validates AI implementation plans before execution. Use when user says "check your plan", "validate this plan", "review the plan", or "is this plan good". Launches 5 parallel validators + devil's advocate.
allowed-tools: Task, Read, Glob, Grep, AskUserQuestion
context: fork
---

# Check Your Plan

> Validate AI-generated implementation plans before execution to catch hallucinations, pattern violations, and scope creep.

**Different from check-your-code/check-your-work**: Those review written code. This reviews the PLAN before code is written.

<when_to_use>

## When to Use

Invoke when user says:

- "check your plan"
- "validate this plan"
- "review the plan"
- "is this plan good"
- "does this plan make sense"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                              | Gate              |
| ----- | ----------------------------------- | ----------------- |
| 1     | Locate and extract plan content     | -                 |
| 2     | Spawn 5 parallel validators         | -                 |
| 3     | Run devil's advocate challenge      | -                 |
| 4     | Present findings with severity      | User decision     |

</workflow>

<execution>

## Execution

### Phase 1: Plan Discovery

1. Locate the plan: check conversation context, `.claude/plans/`, or inline plan
2. Extract plan content, files to modify, steps count, dependencies
3. If plan >50 lines, use AskUserQuestion to confirm scope

### Phase 2-3: Spawn Orchestrator Agent

Launch a single Task agent (`subagent_type: "general-purpose"`) with this prompt:

> Read `.claude/skills/check-your-plan/references/orchestrator-instructions.md` for severity rules, agent prompts, and recept-specific checks. Then execute Phase 2 (5 parallel validators) and Phase 3 (devil's advocate). Return all findings with severity levels.

Provide the agent: full plan content, original user request, and CLAUDE.md path.

### Phase 4: Report + User Decision

Present findings grouped by severity. Use AskUserQuestion:

- **Revise plan** — Update plan to address P0/P1 findings
- **Proceed as-is** — Accept the plan and start implementation
- **Start over** — Request a completely new plan approach

</execution>

<references>

## References

- [references/orchestrator-instructions.md](references/orchestrator-instructions.md) — Agent prompts, severity rules, recept-specific checks

</references>

<approval_gates>

## Approval Gates

| Gate     | Phase | Question                                          |
| -------- | ----- | ------------------------------------------------- |
| Scope    | 1     | "Plan is >50 lines. Proceed with full validation?"|
| Decision | 4     | "Revise plan / Proceed as-is / Start over?"       |

</approval_gates>
