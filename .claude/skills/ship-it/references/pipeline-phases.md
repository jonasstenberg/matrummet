# Pipeline Phases — ship-it

## Step 0: Create Task Pipeline

Before any work, create ALL 8 tasks and set up the dependency chain using TaskCreate and TaskUpdate.

Create tasks with these subjects (replace `[CHANGE]` with the user's request):

1. `Explore codebase for: [CHANGE]` — activeForm: `Exploring codebase`
2. `Plan implementation for: [CHANGE]` — activeForm: `Planning implementation`
3. `Validate implementation plan` — activeForm: `Validating plan`
4. `Implement: [CHANGE]` — activeForm: `Implementing changes`
5. `Review for bugs and security` — activeForm: `Checking work`
6. `Review code quality and patterns` — activeForm: `Checking code`
7. `Validate: test + lint + acceptance` — activeForm: `Validating changes`
8. `Commit validated changes` — activeForm: `Committing`

Set up blockedBy chain: Task 2 blocked by 1, Task 3 by 2, Task 4 by 3, Task 5 by 4, Task 6 by 5, Task 7 by 6, Task 8 by 7.

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

## Phase 7: Validate (Test + Lint + Acceptance)

**All validation happens BEFORE commit.** This ensures every commit represents working, validated code.

### 7a: Run Unit Tests

```bash
pnpm check:test
```

If tests fail:
1. Analyze failure — is it a code bug or pre-existing issue?
2. If code bug: fix and re-run tests
3. If pre-existing: ask user whether to fix or proceed

### 7b: Run Lint

```bash
pnpm check:lint
```

If lint fails:
1. Fix lint errors
2. Re-run lint
3. Re-run tests to ensure fixes didn't break anything

### 7c: Run Acceptance Tests (Conditional)

**Only runs if a user story ID was provided in the original request.**

Check the original request for patterns like:
- `US-AUTH-01`, `US-RECIPE-03`, etc.
- "user story [ID]"
- "story [ID]"
- Context from story-to-ship skill invocation

If NO story ID is present, skip 7c and proceed to Phase 8.

Invoke `Skill: run-user-stories [STORY-ID]`

The skill will:
1. Parse the user story from `user-stories/*.md`
2. Open browser via Playwright MCP
3. Execute test steps
4. Report pass/fail with reason

### Handling Validation Failures

**If acceptance test FAILS:**

Present failure to user via AskUserQuestion:

| Choice                 | Action                                              |
| ---------------------- | --------------------------------------------------- |
| "Fix and re-validate"  | Analyze failure, fix code, re-run full validation   |
| "Skip validation"      | Proceed to commit without passing (not recommended) |
| "Mark as known issue"  | Document the gap, proceed to commit                 |

### Fix and Re-validate Loop

When user chooses "Fix and re-validate":

1. Analyze failure reason from run-user-stories output
2. Identify whether it's a code bug or test spec issue
3. If code bug: fix the code
4. If test spec issue: update the user story test steps in `user-stories/*.md`
5. **Re-run the FULL validation sequence** (7a → 7b → 7c)
6. Repeat until all pass or user decides to stop

**IMPORTANT**: After any code fix, always re-run unit tests AND lint before re-running acceptance tests. This catches regressions introduced by the fix.

### Validation Notes

- If browser automation is unavailable (MCP server down), warn user and skip 7c
- Acceptance tests require dev server running (`pnpm dev`) and PostgREST
- Do NOT commit until validation passes — that's the whole point of this phase

## Phase 8: Commit

**Only reached after Phase 7 validation passes (or user explicitly skips).**

### 8a: Review Changes

Run git commands to show what will be committed:

```bash
git status
git diff --staged
git diff
```

Present summary to user via AskUserQuestion:

| Choice            | Action                                    |
| ----------------- | ----------------------------------------- |
| "Commit all"      | Stage all changes and commit              |
| "Split commits"   | User specifies how to split, create multiple commits |
| "Review specific" | User wants to see specific file diffs     |

### 8b: Create Commit

Stage relevant files and commit:

```bash
git add [files]
git commit -m "$(cat <<'EOF'
[commit message]
EOF
)"
```

Follow repository commit conventions from recent commits.

### 8c: Verify Commit

```bash
git status
git log -1
```

Confirm commit was created successfully.

### Completion

Report: "Feature implemented and validated. Commit [hash] created."

If a user story was validated, include: "Acceptance test passed for [STORY-ID]."

## Loop-Back Rules

The pipeline is NOT strictly linear:

| Trigger                              | Action                          | Returns to          |
| ------------------------------------ | ------------------------------- | ------------------- |
| Phase 3: user says "Revise plan"     | Update plan with findings       | Phase 2 (re-plan)   |
| Phase 3: user says "Start over"      | Re-explore with new context     | Phase 1 (re-explore) |
| Phase 5: P0/P1 found, user says fix  | Fix issues in code              | Phase 5 (re-run)    |
| Phase 6: P0 found, user says fix     | Fix quality issues              | Phase 6 (re-run)    |
| Phase 7: unit tests fail             | Fix code, re-run validation     | Phase 7a (re-run)   |
| Phase 7: lint fails                  | Fix lint, re-run from 7a        | Phase 7a (re-run)   |
| Phase 7: acceptance test fails       | Fix code/spec, re-run from 7a   | Phase 7a (re-run)   |

When looping back:

- Do NOT re-create tasks. Set the target task back to `in_progress`.
- If looping from Phase 3 to Phase 2, also set Task 3 back to `pending`.
- Summarize what changed before re-entering the phase.
- **Phase 7 fix loop**: Always re-run the FULL validation sequence (7a→7b→7c) after any fix to catch regressions.

## Context Management

1. **Sub-skills fork** — check-your-plan, check-your-work, check-your-code all use `context: fork`, keeping their agent outputs out of the main context.
2. **Use check:* commands** for build/test/lint:
   ```bash
   pnpm check:test
   pnpm check:lint
   pnpm check:build
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
- **Phase 8 is conditional** — only run acceptance tests if a user story ID is present in the context
- **Preserve story ID** — when invoked from story-to-ship, the story ID MUST be threaded through all phases for Phase 8
