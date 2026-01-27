# Pipeline Phases — ship-it

## Step 0: Create Task Pipeline

Before any work, create ALL 7 tasks and set up the dependency chain using TaskCreate and TaskUpdate.

Create tasks with these subjects (replace `[CHANGE]` with the user's request):

1. `Explore codebase for: [CHANGE]` — activeForm: `Exploring codebase`
2. `Plan implementation for: [CHANGE]` — activeForm: `Planning implementation`
3. `Validate implementation plan` — activeForm: `Validating plan`
4. `Implement: [CHANGE]` — activeForm: `Implementing changes`
5. `Review for bugs and security` — activeForm: `Checking work`
6. `Review code quality and patterns` — activeForm: `Checking code`
7. `Test, lint, and commit` — activeForm: `Testing and committing`

Set up blockedBy chain: Task 2 blocked by 1, Task 3 by 2, Task 4 by 3, Task 5 by 4, Task 6 by 5, Task 7 by 6.

## Phase 1: Explore Codebase

Launch a Task agent with `subagent_type: "Explore"` (thoroughness: "very thorough") to understand:

- Which files are relevant to the change
- Existing patterns in those files
- Dependencies and relationships
- Existing similar functionality that should not be duplicated

Summarize findings in 3-5 bullet points for use in later phases.

## Phase 2: Plan Implementation

Use `EnterPlanMode` to create a detailed implementation plan referencing:

- Explore findings from Phase 1
- Specific files to create or modify
- Step-by-step implementation approach
- Edge cases and error handling
- Which specialized agents to use (react-squidler, db-expert, kotlin-expert, etc.)

Wait for user approval via ExitPlanMode.

## Phase 3: Validate Plan

Invoke `Skill: check-your-plan`. The skill launches 5 parallel validators + devil's advocate.

**Decision gate — user chooses:**

| Choice         | Action                                        |
| -------------- | --------------------------------------------- |
| "Revise plan"  | Return to Phase 2. Re-plan with the findings. |
| "Proceed"      | Continue to Phase 4.                          |
| "Start over"   | Return to Phase 1 with fresh exploration.     |

## Phase 4: Implement Changes

Write code following the approved plan. Use appropriate specialized agents:

| Change type       | Agent                           |
| ----------------- | ------------------------------- |
| React / frontend  | Task with `react-squidler`      |
| Database / SQL    | Task with `db-expert` or `PostgREST` |
| Kotlin / backend  | Task with `kotlin-expert`       |
| General code      | Direct coding with Read/Write/Edit |

Thread the original user request and plan through to each agent so context is preserved.

## Phase 5: Check Work

Invoke `Skill: check-your-work`. Launches 6 parallel reviewers + severity validators.

**Decision gate — user chooses:**

| Choice        | Action                                             |
| ------------- | -------------------------------------------------- |
| "Fix P0 now"  | Fix critical issues, then re-invoke check-your-work |
| "Fix P0+P1"   | Fix critical + high issues, then re-invoke          |
| "Report only" | Continue to Phase 6 with findings noted             |

## Phase 6: Check Code

Invoke `Skill: check-your-code`. Launches 5 parallel reviewers + red team.

**Decision gate — user chooses:**

| Choice            | Action                                              |
| ----------------- | --------------------------------------------------- |
| "Improve now"     | Fix quality issues, then re-invoke check-your-code  |
| "Accept as-is"    | Continue to Phase 7                                 |
| "Discuss findings"| Discuss specifics, then decide                      |

## Phase 7: Test & Commit

Invoke `Skill: test-and-commit`. It will run unit tests, API tests, lint, review changes with user, and commit. If tests or lint fail, fix and re-run (stays in Phase 7).

## Loop-Back Rules

The pipeline is NOT strictly linear:

| Trigger                              | Action                          | Returns to          |
| ------------------------------------ | ------------------------------- | ------------------- |
| Phase 3: user says "Revise plan"     | Update plan with findings       | Phase 2 (re-plan)   |
| Phase 3: user says "Start over"      | Re-explore with new context     | Phase 1 (re-explore) |
| Phase 5: P0/P1 found, user says fix  | Fix issues in code              | Phase 5 (re-run)    |
| Phase 6: P0 found, user says fix     | Fix quality issues              | Phase 6 (re-run)    |
| Phase 7: tests/lint fail             | Fix failing tests or code       | Phase 7 (re-run)    |

When looping back:

- Do NOT re-create tasks. Set the target task back to `in_progress`.
- If looping from Phase 3 to Phase 2, also set Task 3 back to `pending`.
- Summarize what changed before re-entering the phase.

## Context Management

1. **Sub-skills fork** — check-your-plan, check-your-work, check-your-code all use `context: fork`, keeping their agent outputs out of the main context.
2. **Use run-silent.sh** for build/test/lint:
   ```bash
   .claude/hooks/run-silent.sh "Tests" "pnpm test --run"
   .claude/hooks/run-silent.sh "Lint" "pnpm lint"
   ```
3. **Summarize between phases** — 2-3 sentence summary after each phase. Do not carry verbose agent output forward.
4. **Explore agent** returns compressed results via Task tool.

## Guidelines

- **Thread the original request** through every phase — each skill and agent needs the user's original ask for context
- **Don't skip phases** — the full pipeline exists because each phase catches different problems
- **Respect user decisions** at gates — if they say "report only" or "accept as-is", do not fix
- **Use specialized agents** during implementation — match the change type to the right agent
- **Keep inter-phase summaries short** — 2-3 sentences, not full reports
- **On failure, loop, don't abandon** — if a review phase finds issues and the user wants fixes, fix and re-run that phase
