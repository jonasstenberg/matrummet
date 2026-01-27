# Codebase Concerns

**Analysis Date:** 2026-01-27

## Security Considerations

**API Input Validation Gaps:**
- Risk: Admin API routes validate role but minimal input validation on query parameters and request bodies
- Files: `apps/frontend/app/api/admin/users/route.ts`, `apps/frontend/app/api/admin/foods/route.ts`
- Current mitigation: Basic null checks and length validation on critical fields; role-based access control in place
- Recommendations: Add request body schema validation (Zod) to all admin routes; validate UUID format on ID parameters; add rate limiting headers on non-auth endpoints

**Environment Variables Exposure:**
- Risk: 42 API route files spread across multiple directories; scattered environment variable usage without centralized validation
- Files: `apps/frontend/lib/env.ts` (validation exists but incomplete)
- Current mitigation: Zod schema validation in env.ts with caching
- Recommendations: Currently POSTGREST_URL, JWT_SECRET, POSTGREST_JWT_SECRET are required but optional API keys (GEMINI_API_KEY, RECIPE_IMPORT_API_KEY, STRIPE_SECRET_KEY) should fail fast if used without being set; consider adding runtime checks before API calls

**Error Message Information Disclosure:**
- Risk: Some error messages returned to clients may leak database structure or internal details
- Files: `apps/frontend/app/api/auth/login/route.ts` (line 36), `apps/frontend/lib/actions.ts` (generic errors only)
- Current mitigation: Most errors are generic; database-specific errors are caught and hidden
- Recommendations: Audit error responses in all 42 API routes to ensure no system details leak; centralize error formatting

## Tech Debt

**Large Component Files:**
- Issue: Multiple UI components exceed 600+ lines, creating maintenance complexity and testing burden
- Files:
  - `apps/frontend/components/create-recipe-wizard.tsx` (639 lines)
  - `apps/frontend/components/shopping-list-manager.tsx` (603 lines)
  - `apps/frontend/components/recipe-form.tsx` (547 lines)
  - `apps/frontend/components/ingredient-editor.tsx` (488 lines)
  - `apps/frontend/components/recipe-parser.tsx` (471 lines)
- Impact: Hard to test, high cognitive load, increases merge conflict risk
- Fix approach: Break into smaller sub-components; extract custom hooks for stateful logic; refactor ingredient/instruction handling into reusable modules

**Database Migration Backups Accumulation:**
- Issue: 157 backup SQL files in `flyway/backups/` from Jan 25 onwards taking up disk space
- Files: `flyway/backups/recept_pre-migrate_*.sql` (1.5MB each)
- Impact: Slow backup operations, clutters version control, but critical for rollback capability
- Fix approach: Archive backups older than 30 days to separate storage; implement cleanup policy; document retention requirements

**Console Logging in Production Code:**
- Issue: 77 console.error/console.log calls scattered across lib files without consistent filtering
- Files: Throughout `apps/frontend/lib/*.ts`, especially in actions.ts, home-actions.ts
- Impact: May expose sensitive data in production logs; inconsistent debugging experience
- Fix approach: Replace console with centralized logger that filters by environment; add log levels (debug/info/warn/error); sanitize sensitive values

**Magic Numbers and Hardcoded Values:**
- Issue: Rate limiting thresholds, JWT expiry, pagination sizes hardcoded throughout codebase
- Files:
  - `apps/frontend/lib/auth.ts` (line 35: '7d' JWT expiry for frontend, line 81: '1h' for PostgREST)
  - `flyway/sql/V27__security_fixes.sql` (line 261: 5 login attempts, line 313: 3 signups per domain)
  - `apps/frontend/app/api/admin/users/route.ts` (line 22: pageSize 50)
- Impact: Configuration changes require code edits and redeployment
- Fix approach: Extract to configuration constants; consider moving security thresholds to database for runtime adjustment

**Frontend Test Coverage Gaps:**
- Issue: Only 14 test files for 42 API routes + complex UI components; API contract tests are comprehensive but unit/integration tests for UI are sparse
- Files: Test files in `lib/**/*.test.ts`, `components/**/*.test.tsx`
- Impact: UI regressions may slip undetected; client-side business logic (recipe import, ingredient parsing) lacks safety net
- Priority: High - critical flows like recipe import/parsing, shopping list management untested at unit level
- Fix approach: Add tests for: ingredient restructuring logic in wizard; recipe import transformations; pantry matching; shopping list calculations

## Data Consistency & Reliability

**Cache Invalidation Breadth:**
- Issue: Single operations trigger multiple revalidatePath() calls with blanket paths
- Files: `apps/frontend/lib/actions.ts` lines 77-118, similar pattern in `home-actions.ts`
- Impact: Each recipe update revalidates '/', '/recept', '/alle-recept', '/gillade-recept' - expensive and broad; risk of stale data if invalidation fails
- Fix approach: Use revalidateTag() instead of revalidatePath() with granular tags (e.g., 'recipe-id-{id}', 'user-recipes'); implement batch revalidation for multi-step operations

**No Optimistic Updates:**
- Issue: All server actions show loading state but don't update UI optimistically
- Files: `apps/frontend/lib/actions.ts`, `apps/frontend/components/create-recipe-wizard.tsx`
- Impact: Poor perceived performance; multiple round trips for sequential operations
- Fix approach: Implement optimistic updates with rollback on error; use useTransition hook consistently; add undo UI for reversible operations

**Concurrent Modification Risk:**
- Issue: No conflict detection if user edits same recipe in multiple tabs/windows
- Files: `apps/frontend/lib/actions.ts` (update_recipe function has no version/timestamp check)
- Impact: Last write wins; silently overwrites concurrent edits
- Fix approach: Add optimistic locking (version field) or MVCC; detect conflicts before update; show merge UI if needed

## Performance Bottlenecks

**Food Data Management Scale:**
- Problem: `apps/frontend/lib/data/foods-sv.ts` is 2,660 lines - a hardcoded food list
- Files: `apps/frontend/lib/data/foods-sv.ts`
- Cause: All Swedish foods baked into JavaScript bundle; no lazy loading
- Impact: Initial bundle bloat; slow client-side food search/matching; unmaintainable data store
- Improvement path: Move to database; implement server-side food search with autocomplete; lazy-load suggestions based on recipe context; cache in-memory on server

**Image Processing Without Validation:**
- Issue: Image downloads and processing in recipe import have no size limits or format validation
- Files: `apps/frontend/lib/recipe-import/image-downloader.ts`
- Impact: Malicious URLs could trigger large downloads; uncompressed images stored; disk exhaustion risk
- Fix approach: Add max file size (e.g., 5MB); validate MIME types; use sharp for optimization; implement cleanup for temp files

**N+1 Queries in Admin Pages:**
- Issue: Admin pages (foods, users, units) load list then may fetch details for each item
- Files: `apps/frontend/app/(main)/admin/matvaror/page.tsx` (1109 lines), similar patterns in other admin pages
- Impact: Slow page loads with many records; unnecessary database round trips
- Fix approach: Batch load related data; use PostgREST joins; implement cursor-based pagination

**Search Performance:**
- Issue: Full-text search on recipes uses `recipes_and_categories` view's `full_tsv` column; no pagination shown in UI
- Files: API uses search_recipes() function from database
- Impact: Retrieving all matching recipes at once; memory-intensive for users with 1000+ recipes
- Fix approach: Ensure limit/offset parameters are always applied; add result count warnings; consider pagination in full-text search UI

## Fragile Areas

**JWT Token Exchange Flow:**
- Files: `apps/frontend/lib/auth.ts`, `apps/frontend/lib/actions.ts`, all action files
- Why fragile: Two token systems (frontend auth-token + PostgREST token); token signing/verification split across files; expiry mismatch risk (7d frontend vs 1h PostgREST)
- Safe modification: Any change to token strategy requires updates in: signToken(), getPostgrestToken(), all 20+ server actions; high blast radius
- Test coverage: Auth flows tested in API tests but frontend token refresh not unit tested
- Recommendation: Create auth middleware layer; centralize token lifecycle; add integration tests for token expiry scenarios

**Recipe Data Structure Transformation:**
- Files: `apps/frontend/components/create-recipe-wizard.tsx`, `apps/frontend/lib/actions.ts`
- Why fragile: Recipe data transforms through multiple intermediate formats (ParsedRecipe → ImportData → CreateRecipeInput → database structure); each step has manual mapping
- Safe modification: Any format change requires updates in: wizard step components, action payload builders, database schema handling; easy to miss edge cases
- Test coverage: No unit tests for transformation pipeline
- Recommendation: Add strict typing for each transformation stage; use schema validation (Zod) at boundaries; test matrix of input formats

**Row-Level Security Edge Cases:**
- Files: `flyway/sql/V27__security_fixes.sql` (security fixes) but gaps remain
- Why fragile: RLS policies on 20+ tables; SECURITY DEFINER functions can bypass RLS; easy to introduce authorization gaps
- Safe modification: After any RLS policy change, must test with: admin role, authenticated user, owner vs non-owner, SECURITY DEFINER function interactions
- Test coverage: Good test coverage in `tests/api/rls/` but not all table-role combinations tested
- Recommendation: Audit all SECURITY DEFINER functions to verify ownership checks; add test for each RLS table with all role types

**Database Function Ownership Chain:**
- Files: Multiple V* migrations, especially `V27__security_fixes.sql` lines 186-193
- Why fragile: Functions owned by 'recept' role grant privileges to 'anon'; if role permissions change, cascade failures
- Safe modification: Ownership changes must be tracked; test end-to-end flows for each role
- Test coverage: Security tests exist but don't verify entire permission chain
- Recommendation: Document role permission hierarchy; add integration test verifying both positive (should work) and negative (should fail) cases for each function

## Missing Critical Features

**Rate Limiting for Admin Operations:**
- Problem: Admin API endpoints (users, foods, units) lack rate limiting; could enable abuse
- Blocks: Cannot safely expose admin panel without DDoS protection
- Gap: Implementation exists for auth (login/signup) but not applied to other endpoints

**Request Signing/Verification:**
- Problem: Stripe webhooks signed (HMAC), but other integrations lack verification
- Blocks: Recipe import API, home invitations via email could be spoofed
- Gap: Only Stripe webhook properly authenticated

**Audit Logging:**
- Problem: Admin operations (delete user, approve food) not logged for accountability
- Blocks: Compliance; cannot investigate who made what changes
- Gap: No audit table; no operation logging

**Data Export/Backup for Users:**
- Problem: No way for users to export their recipes/shopping lists
- Blocks: GDPR right to data portability
- Gap: Delete account exists (V20) but not export

## Test Coverage Gaps

**API Route Unit Tests:**
- What's not tested: Individual API routes lack unit tests; only contract tests exist
- Files: 42 routes in `apps/frontend/app/api/` with no corresponding unit tests
- Risk: Business logic in routes (pagination, filtering, error handling) untested at unit level
- Priority: High for admin/sensitive routes (users, foods, credits); Medium for others

**Client-Side Form Validation:**
- What's not tested: Form components have validation rules but no unit tests
- Files: `apps/frontend/components/recipe-form.tsx`, `apps/frontend/components/ingredient-editor.tsx`
- Risk: Validation rules could silently break on refactor
- Priority: Medium

**Image Processing Pipeline:**
- What's not tested: Image download, resize, format conversion untested
- Files: `apps/frontend/lib/recipe-import/image-downloader.ts`, `apps/frontend/lib/image-processing.ts`
- Risk: Could silently corrupt images or fail on certain formats
- Priority: Medium

**Database Trigger Functions:**
- What's not tested: Triggers for timestamps, password hashing, email notifications not directly tested
- Files: Multiple V* migrations defining triggers
- Risk: Subtle bugs in trigger logic
- Priority: Medium - covered by integration tests but not isolated

**Error Recovery Paths:**
- What's not tested: Network failures, partial uploads, database rollbacks
- Files: Throughout action files and API routes
- Risk: Orphaned data on transaction failures
- Priority: High for data-modifying operations

## Scaling Limits

**Database Backup Strategy:**
- Current capacity: 157 backups × 1.5MB = ~235MB, auto-created before each migration
- Limit: If user has 10,000 recipes with images, database could grow to 10GB+; backups would be costly
- Scaling path: Archive old backups; implement incremental backups; consider WAL archival; move to external backup service (AWS RDS backup, pg_backup_api)

**In-Memory Food Data:**
- Current capacity: 2,660 Swedish foods as static JavaScript; scales to ~500KB gzipped
- Limit: Cannot add more countries/languages; search becomes slow beyond 50K+ items
- Scaling path: Move foods to database with search indexes; implement autocomplete service; consider cache layer for hot foods

**Session Cookie Size:**
- Current capacity: Auth token embedded in 7-day cookie; single user session
- Limit: If token payload grows (more claims), exceeds cookie size limits; no refresh token rotation
- Scaling path: Implement refresh token rotation; store long-lived cookies only in database; add sliding window expiry

**File Upload Storage:**
- Current capacity: Recipe images stored (location unclear from code review - appears to be local or external)
- Limit: Unbounded file storage; no quota per user
- Scaling path: Add storage quota per user; implement image compression; consider S3/CDN for scaling

## Dependencies at Risk

**Sharp (Image Processing):**
- Risk: Native dependency; compilation issues on different platforms; security patches required regularly
- Impact: Recipe import image processing fails if Sharp not available
- Migration plan: Consider ffmpeg-based alternative or serverless image processing (AWS Lambda, Cloudinary API)

**Playwright (Browser Testing):**
- Risk: Large dependency (100MB+); heavy resource usage; maintenance burden
- Impact: Slow CI/CD, large container images, hard to scale testing
- Migration plan: Consider lighter headless browser (Puppeteer) or contract-based testing instead of end-to-end

**PostgREST (REST API Layer):**
- Risk: External dependency not under control; PostgREST upgrades could introduce breaking changes
- Impact: If PostgREST breaks, entire API unavailable; locked to specific version
- Migration plan: Maintain custom API layer alongside for critical operations; implement fallback for core features

**Google Genai (@google/genai):**
- Risk: API-dependent; rate limits and cost concerns
- Impact: Recipe parsing and food review AI features fail if API unavailable/quota exceeded
- Current mitigation: Optional feature (GEMINI_API_KEY optional in env)
- Migration plan: Implement fallback parser; cache parsing results; queue-based rate limiting

**Zod (Runtime Validation):**
- Risk: Runtime validation adds overhead; bundle size impact
- Impact: Slower API requests due to validation
- Migration plan: Consider moving validation to database constraints; schema validation at build time instead of runtime for known inputs

---

*Concerns audit: 2026-01-27*
