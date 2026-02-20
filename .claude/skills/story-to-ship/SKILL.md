---
name: story-to-ship
version: 1.0.0
description: Convert a feature request into a user story, save it, implement it via ship-it, and validate with acceptance tests. Use when user says "new user story", "implement this story", "story to ship", or describes a feature they want built as a user story.
allowed-tools: Task, TaskCreate, TaskUpdate, TaskList, TaskGet, Skill, Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

# Story to Ship — From Idea to Validated Feature

> Takes a feature description, converts it to a user story, implements it via ship-it, and validates with acceptance tests.

**Not for**: Existing user stories that just need testing (use `run-user-stories`), or features that don't need formal acceptance criteria.

<when_to_use>

## When to Use

Invoke when user says:

- "new user story"
- "story to ship"
- "implement this story"
- "I want a feature that..." (describes a user story)
- "As a user I want to..."
- "build this feature and test it"

</when_to_use>

<arguments>

## Arguments

The skill accepts the feature description as argument:

| Argument    | Example                                                    | Description                        |
| ----------- | ---------------------------------------------------------- | ---------------------------------- |
| Description | `/story-to-ship As a user I want to filter recipes by...`  | Feature description in any format  |
| (none)      | `/story-to-ship`                                           | Prompts for feature description    |

</arguments>

<workflow>

## Workflow

| Phase | Action                        | Tool / Skill           | Gate              |
| ----- | ----------------------------- | ---------------------- | ----------------- |
| 1     | Parse feature description     | AskUserQuestion        | User confirms     |
| 2     | Create user story             | Write                  | User approves     |
| 3     | Implement via ship-it         | Skill: ship-it         | Per ship-it gates |
| 4     | Completion                    | -                      | ship-it success   |

**Note**: ship-it now runs acceptance tests BEFORE committing (Phase 7), so validation is built into the implementation pipeline.

</workflow>

<execution>

## Execution

Read `.claude/skills/story-to-ship/references/story-phases.md` for detailed phase instructions, then execute.

### Quick Overview

1. **Parse**: Extract feature intent from user input
2. **Create Story**: Generate properly formatted user story with ID, steps, and acceptance criteria
3. **Implement**: Invoke ship-it skill with story context
4. **Validate**: Run the new user story as an acceptance test

</execution>

<references>

## References

- [references/story-phases.md](references/story-phases.md) — Detailed phase execution
- [user-stories/README.md](../../../user-stories/README.md) — User story format

</references>

<approval_gates>

## Approval Gates

| Gate              | Phase | Mechanism                                          |
| ----------------- | ----- | -------------------------------------------------- |
| Story details     | 1     | AskUserQuestion: Confirm area, preconditions, etc. |
| Story approval    | 2     | AskUserQuestion: Approve story before saving       |
| Implementation    | 3     | All ship-it gates apply (includes validation)      |

**Note**: Validation gate is now part of ship-it Phase 7, before commit.

</approval_gates>
