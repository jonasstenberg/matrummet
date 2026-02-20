---
name: test-or-bug
version: 1.0.0
description: Diagnose failing tests to determine if failure is code bug or test issue. Use when user says "test or bug", "is this a test bug", "why is this test failing", or "diagnose test failure".
allowed-tools: Read, Bash, Grep, Glob, Task
context: fork
---

# Test or Bug

> Diagnose failing tests to determine if the failure is a code bug or a test issue.

<when_to_use>

## When to Use

Invoke when user says:

- "test or bug"
- "is this a test bug"
- "why is this test failing"
- "diagnose test failure"
- "is the test wrong or the code"
- "debug this failing test"

</when_to_use>

<decision_tree>

## Decision Tree

```
Test failing?
├── Did test pass before recent changes?
│   ├── NO → Likely TEST BUG (test was always broken)
│   └── YES → Do changes affect tested code?
│       ├── NO → Likely FLAKY test
│       └── YES → Compare expected vs actual
│           ├── Expected is wrong → TEST BUG
│           └── Actual is wrong → CODE BUG
```

</decision_tree>

<workflow>

## Workflow

| Phase | Action                              | Gate              |
| ----- | ----------------------------------- | ----------------- |
| 1     | Run failing test, capture output    | -                 |
| 2     | Check git history for test changes  | -                 |
| 3     | Compare assertions vs behavior      | -                 |
| 4     | Pattern check (flaky indicators)    | -                 |
| 5     | Deliver verdict with evidence       | User confirmation |

</workflow>

<execution>

## Phase 1: Run Failing Test

Run the specific failing test and capture full output:

```bash
# Unit tests (vitest)
pnpm test --run -- --reporter=verbose [test-file-path]

# API integration tests
pnpm test:api -- --reporter=verbose [test-file-path]
```

Capture:
- Test name and file path
- Expected value
- Actual value
- Stack trace if available

## Phase 2: Git History Analysis

Check when the test last passed:

```bash
# Find recent changes to test file
git log --oneline -10 -- [test-file-path]

# Find recent changes to tested code
git log --oneline -10 -- [source-file-path]

# Check if test passed before recent changes
git stash && pnpm test --run [test-file-path] && git stash pop
```

Key questions:
- Was this test added recently?
- Did the tested code change recently?
- Did dependencies change?

## Phase 3: Compare Assertions vs Behavior

Read both the test file and the source code:

1. **Extract test assertions** — What does the test expect?
2. **Read source implementation** — What does the code actually do?
3. **Compare** — Is the expectation correct given the implementation intent?

Common patterns:
- Test expects old behavior after intentional change → TEST BUG
- Test expects X but code clearly should do X but doesn't → CODE BUG
- Test expects wrong value due to copy-paste error → TEST BUG

## Phase 4: Pattern Check (Flaky Indicators)

Look for flaky test patterns:

| Pattern                    | Indicator                                |
| -------------------------- | ---------------------------------------- |
| Timing-dependent           | setTimeout, Date.now(), race conditions  |
| Order-dependent            | Tests pass alone, fail in suite          |
| External dependency        | Network calls, file system, database     |
| Random data                | Math.random(), uuid without seed         |
| Shared state               | Global variables, singletons             |

Run test multiple times to check consistency:

```bash
for i in {1..5}; do pnpm test --run [test-file-path]; done
```

## Phase 5: Verdict

Deliver one of three verdicts with evidence:

### CODE BUG
The implementation is wrong; test expectation is correct.
- Evidence: Show what code should do vs what it does
- Action: Fix the source code

### TEST BUG
The test expectation is wrong; implementation is correct.
- Evidence: Show why expected value is incorrect
- Action: Update the test

### FLAKY
Test is unreliable due to non-deterministic factors.
- Evidence: Show flaky pattern identified
- Action: Fix test reliability (mock externals, fix timing, isolate state)

</execution>

<recept_patterns>

## Recept-Specific Patterns

### API Integration Tests (`tests/api/`)
- Require test Docker environment (port 5433/4445)
- May fail if test DB not running: `docker-compose -f docker-compose.test.yml up -d`
- RLS tests need proper JWT claims

### Unit Tests (`**/*.test.ts`)
- Run with vitest
- Mock external dependencies

### Common Recept Test Failures
| Symptom                        | Likely Cause                          |
| ------------------------------ | ------------------------------------- |
| Connection refused 4445        | Test PostgREST not running            |
| RLS violation                  | Missing/wrong JWT in test setup       |
| Snapshot mismatch              | Intentional change, update snapshot   |
| Timeout                        | Missing mock, real network call       |

</recept_patterns>

<quick_reference>

## Quick Reference

```bash
# Run specific test with verbose output
pnpm test --run -- --reporter=verbose [test-file]

# Run API tests
pnpm test:api -- --reporter=verbose [test-file]

# Check git history for test file
git log --oneline -10 -- [test-file]

# Check git history for source file
git log --oneline -10 -- [source-file]

# Run test multiple times (flaky check)
for i in {1..5}; do pnpm test --run [test-file]; done
```

</quick_reference>

<approval_gates>

## Approval Gates

| Gate   | Phase | Question                                           |
| ------ | ----- | -------------------------------------------------- |
| Verdict| 5     | "Do you agree with this diagnosis? Fix test/code?" |

</approval_gates>
