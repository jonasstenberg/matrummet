# Recept Codebase Architecture & Patterns

Reference document for implementing new features consistently.

## 1. Database Schema Structure

### User Management
- **users** table: Core user data (id, email, name, measures_system, role, owner)
- **user_passwords** table: Password hashes using bcrypt encryption
- **user_roles**: Two-tier system (user, admin) via `role` column
- **user_api_keys** table: API key authentication for external integrations

**Key Pattern**: Email (`owner` field) is the primary identifier for ownership across all tables. JWT token contains user's email as claim identifier.

### Content Tables
- **recipes**: Core recipe data with full-text search vector (`tsv`)
- **ingredients**: Individual ingredients with food_id and unit_id FKs
- **instructions**: Recipe steps
- **categories**: Reusable category tags
- **recipe_categories**: Junction table (many-to-many)
- **ingredient_groups** / **instruction_groups**: Grouping mechanisms

### Supplementary Tables
- **foods**: Normalized food database (read-only, public access)
- **units**: Normalized measurement units (read-only, public access)
- **recipe_likes**: User likes tracking (private, user can only see own likes)
- **shopping_lists** / **shopping_list_items**: Shopping list feature (already exists!)

## 2. RLS Policy Patterns

### Standard Pattern (most tables)
```sql
-- SELECT: Public
CREATE POLICY xxx_select ON xxx FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: Owner-only
CREATE POLICY xxx_insert ON xxx FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');
```

### Private Access Pattern (likes, shopping_lists)
```sql
-- SELECT: Only user's own data
CREATE POLICY xxx_select ON xxx FOR SELECT
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');
```

### Admin-Protected Pattern
```sql
-- Uses is_admin() function check
CREATE POLICY xxx_admin ON xxx FOR ALL USING (is_admin());
```

## 3. PostgREST RPC Functions

### Atomic Operations Pattern
```sql
CREATE OR REPLACE FUNCTION xxx(params...)
RETURNS type
LANGUAGE plpgsql
SECURITY DEFINER  -- Bypasses RLS
SET search_path = public
AS $func$
DECLARE
    v_user_email TEXT := current_setting('request.jwt.claims', true)::jsonb->>'email';
BEGIN
    -- Implementation
END;
$func$;
```

### Parameter Naming
- Use `p_` prefix for parameters
- Use `v_` prefix for local variables

## 4. Frontend Architecture

### Auth Context (`useAuth()` hook)
```tsx
interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login(email, password): Promise<void>;
  logout(): Promise<void>;
}
```

### Server Actions Pattern
```typescript
// lib/actions.ts - marked with 'use server'
export async function createRecipe(data): Promise<{id} | {error}> {
  const session = await getSession();
  // Get JWT, call PostgREST /rpc/* endpoint
  revalidatePath('/');
  return result;
}
```

### Data Fetching Pattern
```typescript
// lib/api.ts - PostgREST queries
const recipes = await fetch(`${POSTGREST_URL}/recipes_and_categories?${params}`);
```

## 5. Implementation Checklist for New Features

### Database
- [ ] Create table with UUID primary key, timestamps
- [ ] Add `owner TEXT` column referencing `users(email)` with ON DELETE CASCADE
- [ ] Create RLS policies (SELECT public, others owner-only)
- [ ] Add indexes on owner, foreign keys, frequently queried fields
- [ ] Create migration: `flyway/sql/V{n}__{description}.sql`

### API
- [ ] Create RPC function with `SECURITY DEFINER` for atomic operations
- [ ] Extract email from JWT: `current_setting('request.jwt.claims', true)::jsonb->>'email'`
- [ ] GRANT EXECUTE to appropriate roles (anon/authenticated)

### Frontend
- [ ] Add TypeScript types in `lib/types.ts`
- [ ] Create query function in `lib/api.ts`
- [ ] Create server action in `lib/actions.ts`
- [ ] Build client component using `useAuth()` for context
- [ ] Revalidate cache paths after mutations
