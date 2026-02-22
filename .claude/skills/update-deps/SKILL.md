---
name: update-deps
version: 1.0.0
description: Update dependencies in a workspace (default: frontend). Shows outdated packages, updates them, runs tests to verify. Use when user says "update deps", "update dependencies", "upgrade packages", or "update frontend deps".
allowed-tools: Bash, Read, AskUserQuestion
context: fork
---

# Update Dependencies

> Update npm dependencies in a workspace with verification.

<when_to_use>

## When to Use

Invoke when user says:

- "update deps"
- "update dependencies"
- "upgrade packages"
- "update frontend deps"
- "update all packages"

</when_to_use>

<workflow>

## Workflow

| Phase | Action                                           |
| ----- | ------------------------------------------------ |
| 1     | Check for outdated packages                      |
| 2     | Ask user which update strategy to use            |
| 3     | Run update command                               |
| 4     | Run build and tests to verify                    |
| 5     | Display summary of changes                       |

</workflow>

<arguments>

## Arguments

The skill accepts an optional workspace argument:

- No argument: defaults to `frontend`
- `--all` or `all`: updates all workspaces
- Workspace name: updates specific workspace (e.g., `email-service`)

Examples:
- `/update-deps` - Update frontend
- `/update-deps all` - Update all workspaces
- `/update-deps email-service` - Update email-service

</arguments>

<execution>

## Phase 1: Check Outdated Packages

Show what's outdated in the target workspace:

```bash
# For specific workspace (default: frontend)
pnpm --filter frontend outdated

# For all workspaces
pnpm outdated -r
```

## Phase 2: Ask Update Strategy

Present options to user:

| Strategy        | Command Flag | Description                                      |
| --------------- | ------------ | ------------------------------------------------ |
| Safe (default)  | (none)       | Update within semver ranges in package.json      |
| Latest          | `--latest`   | Update to absolute latest versions               |
| Interactive     | `--interactive` | Let user pick which packages to update        |

## Phase 3: Run Update

```bash
# Safe update (within semver ranges)
pnpm --filter frontend update

# Latest versions (ignores semver)
pnpm --filter frontend update --latest

# Interactive selection
pnpm --filter frontend update --interactive

# All workspaces
pnpm update -r [--latest]
```

## Phase 4: Verify Changes

Run build and tests to ensure nothing broke:

```bash
# Build the updated workspace
pnpm --filter frontend build

# Run tests
pnpm --filter frontend test --run

# Lint check
pnpm --filter frontend lint
```

If any verification fails, report the errors and suggest rollback:

```bash
# Rollback if needed
git checkout pnpm-lock.yaml apps/web/package.json
pnpm install
```

## Phase 5: Summary

Display what was updated:

```bash
# Show git diff of package.json changes
git diff apps/web/package.json

# Show lockfile changes summary
git diff --stat pnpm-lock.yaml
```

</execution>

<update_strategies>

## Update Strategies Explained

### Safe Update (Recommended)

Updates packages within the version ranges specified in package.json:
- `^1.2.3` allows `1.x.x` updates
- `~1.2.3` allows `1.2.x` updates
- `1.2.3` exact version, no updates

Best for: Routine maintenance, low risk.

### Latest Update

Ignores semver ranges and updates to the absolute latest version. May include breaking changes.

Best for: Major upgrade sessions when you have time to fix breaking changes.

### Interactive Update

Opens a TUI to select which packages to update. Good for selective updates.

Best for: When you want control over specific packages.

</update_strategies>

<troubleshooting>

## Troubleshooting

| Issue                      | Cause                           | Fix                                        |
| -------------------------- | ------------------------------- | ------------------------------------------ |
| Peer dependency conflicts  | Incompatible version ranges     | Check error, may need `--force` or manual fix |
| Build fails after update   | Breaking changes in dependency  | Rollback and update incrementally          |
| Type errors                | @types package version mismatch | Update corresponding @types package        |
| Tests fail                 | API changes in dependency       | Check changelog, update usage              |

</troubleshooting>

<approval_gates>

## Approval Gates

| Gate | Phase | Question                                                    |
| ---- | ----- | ----------------------------------------------------------- |
| 1    | 2     | Which update strategy? (Safe/Latest/Interactive)            |
| 2    | 4     | Verification failed - rollback or continue?                 |

</approval_gates>
