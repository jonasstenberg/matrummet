---
name: check-your-plan
description: Validates AI implementation plans before execution. Use when user says "check your plan", "validate this plan", "review the plan", or "is this plan good". Launches 5 parallel validators + devil's advocate.
allowed-tools: Task, Read, Glob, Grep, AskUserQuestion
context: fork
---

# Check Your Plan

> Validate AI-generated implementation plans before execution to catch hallucinations, pattern violations, and scope creep.

**Different from check-your-code/check-your-work**: Those review written code. This reviews the PLAN before code is written.

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
