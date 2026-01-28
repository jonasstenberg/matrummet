---
phase: quick-002
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - flyway/sql/V58__delete_account_with_data.sql
  - apps/frontend/components/account-deletion-form.tsx
  - apps/frontend/app/api/user/delete-account/route.ts
autonomous: true

must_haves:
  truths:
    - "Account deletion dialog shows a checkbox labeled to also delete all user data"
    - "Checkbox is unchecked by default -- default behavior preserves recipes as before"
    - "When checkbox is checked and account is deleted, all user recipes are also permanently deleted"
    - "When checkbox is unchecked and account is deleted, recipes are preserved (owner set to NULL)"
  artifacts:
    - path: "flyway/sql/V58__delete_account_with_data.sql"
      provides: "Updated delete_account function with p_delete_data parameter"
      contains: "p_delete_data"
    - path: "apps/frontend/components/account-deletion-form.tsx"
      provides: "Checkbox UI for delete-all-data option"
      contains: "Checkbox"
    - path: "apps/frontend/app/api/user/delete-account/route.ts"
      provides: "API route passing deleteData boolean to PostgREST"
      contains: "deleteData"
  key_links:
    - from: "apps/frontend/components/account-deletion-form.tsx"
      to: "/api/user/delete-account"
      via: "fetch POST body includes deleteData boolean"
      pattern: "deleteData"
    - from: "apps/frontend/app/api/user/delete-account/route.ts"
      to: "PostgREST rpc/delete_account"
      via: "p_delete_data parameter in POST body"
      pattern: "p_delete_data"
---

<objective>
Add a checkbox to the account deletion dialog that, when checked, also deletes all user data (recipes, etc.) instead of preserving recipes with a NULL owner.

Purpose: Give users full control over their data when leaving the platform -- they can choose to wipe everything or leave recipes behind.
Output: Updated SQL function, API route, and React form component.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@flyway/sql/V20__add_account_deletion.sql
@flyway/sql/V28__security_hardening.sql (Section 6 - current delete_account function with password confirmation)
@apps/frontend/components/account-deletion-form.tsx
@apps/frontend/app/api/user/delete-account/route.ts
@apps/frontend/components/ui/checkbox.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add p_delete_data parameter to delete_account SQL function</name>
  <files>flyway/sql/V58__delete_account_with_data.sql</files>
  <action>
Create a new Flyway migration V58__delete_account_with_data.sql that replaces the `delete_account` function.

The updated function:
1. Drop the old function signature: `DROP FUNCTION IF EXISTS delete_account(TEXT);`
2. Recreate with signature: `delete_account(p_password TEXT DEFAULT NULL, p_delete_data BOOLEAN DEFAULT false)`
3. Keep ALL existing logic (JWT validation, password verification for non-OAuth, etc.) -- copy from V28 Section 6
4. Before the `DELETE FROM users` statement, add a conditional block:
   ```sql
   -- If user opted to delete all their data, remove recipes first
   -- (recipes use ON DELETE SET NULL, so they'd be orphaned otherwise)
   IF p_delete_data THEN
       DELETE FROM recipes WHERE owner = v_user_email;
   END IF;
   ```
5. The `DELETE FROM users` then handles everything else via CASCADE (user_passwords, user_email_preferences, password_reset_tokens, recipe_likes, shopping_lists, user_pantry, user_api_keys, user_credits, credit_transactions, home_invitations)
6. Update the COMMENT to mention the p_delete_data parameter
7. GRANT EXECUTE to "anon" with the new signature
8. Set OWNER to 'recept' for SECURITY DEFINER

Note: Only recipes need explicit deletion because their FK uses ON DELETE SET NULL. All other user data already cascades on user deletion.
  </action>
  <verify>
Check the SQL file is valid syntax by reviewing it. Verify the function signature includes both parameters with defaults. Verify the conditional DELETE FROM recipes block exists before DELETE FROM users.
  </verify>
  <done>
Migration file exists at flyway/sql/V58__delete_account_with_data.sql with the updated function that conditionally deletes recipes when p_delete_data is true.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add checkbox to deletion form and pass deleteData through API</name>
  <files>
    apps/frontend/components/account-deletion-form.tsx
    apps/frontend/app/api/user/delete-account/route.ts
  </files>
  <action>
**In account-deletion-form.tsx:**

1. Import the Checkbox component: `import { Checkbox } from '@/components/ui/checkbox'`
2. Add state: `const [deleteData, setDeleteData] = useState(false)`
3. Reset `deleteData` to `false` in `handleDialogChange` when dialog closes
4. In the dialog body, AFTER the password field (and before the error alert), add a checkbox section:
   ```tsx
   <div className="flex items-start space-x-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
     <Checkbox
       id="deleteData"
       checked={deleteData}
       onCheckedChange={(checked) => setDeleteData(checked === true)}
       disabled={isLoading}
       className="mt-0.5"
     />
     <div className="space-y-1">
       <Label htmlFor="deleteData" className="text-sm font-medium leading-none cursor-pointer">
         Radera alla mina recept och data
       </Label>
       <p className="text-xs text-muted-foreground">
         Om markerad raderas även alla dina recept, inköpslistor och övrig data permanent.
         Annars bevaras dina recept men kopplas bort från ditt konto.
       </p>
     </div>
   </div>
   ```
5. Include deleteData in the fetch body: `body: JSON.stringify({ password: isOAuthUser ? null : password, deleteData })`
6. Update the dialog description to be dynamic based on the checkbox state:
   - When deleteData is false (default): keep existing text about recipes being preserved
   - When deleteData is true: warn that ALL data including recipes will be permanently deleted

**In app/api/user/delete-account/route.ts:**

1. Update the `DeleteAccountBody` interface to include `deleteData: boolean`
2. In the body parsing, default deleteData to false: `body = { password: null, deleteData: false }`
3. Include `p_delete_data` in the PostgREST request body:
   ```ts
   body: JSON.stringify({
     p_password: body.password,
     p_delete_data: body.deleteData ?? false
   }),
   ```
  </action>
  <verify>
Run `pnpm build` (or `.claude/hooks/run-silent.sh "Build" "pnpm build"`) to verify TypeScript compiles without errors. Visually inspect that the Checkbox import and usage follow the existing pattern from checkbox.tsx (Radix UI based).
  </verify>
  <done>
- Account deletion dialog shows a checkbox "Radera alla mina recept och data" that is unchecked by default
- When checked, the dialog description warns about permanent data deletion
- The deleteData boolean is sent through the API to PostgREST as p_delete_data
- Default behavior (unchecked) preserves recipes exactly as before
  </done>
</task>

</tasks>

<verification>
1. `pnpm build` passes -- no TypeScript errors
2. `pnpm lint` passes -- no lint issues
3. SQL migration file has valid syntax and correct function signature
4. Default behavior (checkbox unchecked) is identical to current behavior -- recipes preserved with NULL owner
5. Checkbox-checked behavior deletes recipes before user deletion
</verification>

<success_criteria>
- Account deletion dialog has an unchecked-by-default checkbox for deleting all data
- Checking the box updates the dialog warning text
- API route passes the boolean through to PostgREST
- SQL function conditionally deletes recipes when p_delete_data is true
- Build succeeds with no errors
</success_criteria>

<output>
After completion, create `.planning/quick/002-account-deletion-checkbox-delete-all-user-data/002-SUMMARY.md`
</output>
