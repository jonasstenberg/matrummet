---
phase: 02-settings-sidebar-layout
plan: 02
subsystem: settings
tags: [react, ui, account-management, danger-zone]
requires: [01-extract-hemmet-to-standalone-page]
provides: [account-deletion-form, konto-page, security-form-cleanup]
affects: [02-03-settings-sidebar-menu]
tech-stack:
  added: []
  patterns: [email-confirmation-pattern, two-step-deletion]
key-files:
  created:
    - apps/frontend/components/account-deletion-form.tsx
    - apps/frontend/app/(main)/installningar/konto/page.tsx
  modified:
    - apps/frontend/components/security-form.tsx
  deleted:
    - apps/frontend/components/settings-view-toggle.tsx
    - apps/frontend/app/(main)/installningar/hemmet/page.tsx
decisions:
  - id: email-confirmation-required
    what: Account deletion requires typing email address to enable delete button
    why: Prevents accidental deletions from single-click mistakes
    impact: All users must confirm their email before deletion is possible
  - id: security-form-password-only
    what: SecurityForm component now handles only password changes
    why: Account deletion is a danger zone concern, separate from security settings
    impact: Clearer separation of concerns, danger zone is isolated on /installningar/konto
metrics:
  duration: 3min
  completed: 2026-01-27
---

# Phase 2 Plan 02: Extract Account Deletion to Standalone Page Summary

**One-liner:** Account deletion extracted to dedicated Konto danger zone page with email confirmation requirement, SecurityForm trimmed to password-only, deprecated components deleted.

## What Was Built

Created `AccountDeletionForm` component that enhances the deletion flow with email confirmation. User must type their email address to match their account email before the delete button becomes enabled. Non-OAuth users also need to provide their password (OAuth users skip password since they authenticate via provider).

Created `/installningar/konto` page as a dedicated danger zone section that shows only the account deletion form. This separates the destructive action from regular security settings.

Stripped all account deletion code from `SecurityForm` - removed Dialog imports, Trash2 icon, delete state management, and deletion handlers. SecurityForm now exclusively handles password changes for non-OAuth users.

Deleted deprecated files:
- `settings-view-toggle.tsx` (no longer used after Phase 1 removed the old settings tabs)
- `hemmet/page.tsx` (the old settings-embedded home page; Phase 1 created standalone `/hemmet` route)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create AccountDeletionForm and Konto page | 99b8b39 | account-deletion-form.tsx, konto/page.tsx |
| 2 | Strip deletion from SecurityForm and delete deprecated files | 87fd051 | security-form.tsx, deleted 2 files |

## Decisions Made

**Email confirmation requirement:**
Added email confirmation field that requires exact match with user's email before delete button is enabled. This implements a two-step verification: (1) email confirmation AND (2) password for non-OAuth users. Prevents accidental single-click deletions.

**SecurityForm scope reduction:**
SecurityForm is now password-change only. Account deletion is a danger zone concern that belongs separate from security settings. This matches REQ-03 (delete account as own section).

**Cleanup of deprecated components:**
Deleted SettingsViewToggle and hemmet settings page since Phase 1 completed the hemmet extraction and the old tab-based settings approach is fully replaced.

## Tech Details

**Component structure:**
- AccountDeletionForm: Client component with email + password confirmation
- Konto page: Simple page wrapper that imports and renders AccountDeletionForm
- SecurityForm: Simplified to password section only, no deletion UI

**Validation logic:**
```typescript
const isEmailValid = emailConfirmation === user?.email
const canDelete = isEmailValid && (isOAuthUser || password)
```

**Dialog flow:**
1. User clicks "Radera mitt konto" button
2. Dialog opens with email confirmation field
3. Email must match user.email (shown in label as bold text)
4. Non-OAuth users also need password field
5. Delete button disabled until both validations pass
6. On success: clearUser(), close dialog, redirect to "/"

## Verification Results

All verification checks passed:
- ✓ SettingsViewToggle file deleted, no orphan imports found
- ✓ SecurityForm contains zero deletion code (no Dialog, Trash2, delete handlers)
- ✓ AccountDeletionForm has email confirmation logic
- ✓ Konto page exists and imports AccountDeletionForm
- ✓ Hemmet settings directory fully deleted
- ✓ Build succeeded

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**For 02-03 (Settings Sidebar Menu):**
- /installningar/konto route is ready for sidebar navigation
- SecurityForm is cleaned up and ready to be rendered at /installningar/sakerhet
- All deprecated components removed, no legacy code remains

**Blockers:** None

**Concerns:** None

## Stats

- Files created: 2
- Files modified: 1
- Files deleted: 2
- Lines added: 190
- Lines removed: 247
- Net change: -57 lines (cleanup reduced codebase size)
