# Recipe Collections

## Overview

User-curated groupings of recipes, separate from the taxonomy-based category system. Collections are personal and themed (e.g., "Julmat 2025", "Snabba vardagsmiddagar", "Grillkvällar").

**Value Proposition:**
- Categories are global taxonomy; collections are personal curation
- Supports seasonal planning, event prep, and personal organization
- Shareable collections enable recipe discovery between users
- Natural complement to likes (save one recipe) and meal plans (plan a week)

## User Stories

1. Create a named collection with an optional description
2. Add/remove recipes to/from collections
3. View all my collections on a dedicated page
4. Share a collection via a public link
5. Browse shared collections from other users
6. Reorder recipes within a collection

## Database Schema

```sql
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    cover_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE collection_recipes (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (collection_id, recipe_id)
);

CREATE INDEX collections_owner_idx ON collections(owner);
CREATE INDEX collection_recipes_recipe_id_idx ON collection_recipes(recipe_id);

-- RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Anyone can see public collections; owner sees all their own
CREATE POLICY collections_select ON collections FOR SELECT USING (
    is_public = true
    OR owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE POLICY collections_insert ON collections FOR INSERT
    WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY collections_update ON collections FOR UPDATE USING (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE POLICY collections_delete ON collections FOR DELETE USING (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
);

-- Collection recipes follow parent collection visibility
ALTER TABLE collection_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY collection_recipes_select ON collection_recipes FOR SELECT USING (
    collection_id IN (
        SELECT id FROM collections
        WHERE is_public = true
        OR owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
);

CREATE POLICY collection_recipes_insert ON collection_recipes FOR INSERT
    WITH CHECK (collection_id IN (
        SELECT id FROM collections
        WHERE owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    ));

CREATE POLICY collection_recipes_delete ON collection_recipes FOR DELETE USING (
    collection_id IN (
        SELECT id FROM collections
        WHERE owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    ));
```

## API

Standard PostgREST CRUD. No RPC needed for basic operations.

```
GET    /collections?owner=eq.user@example.com&order=updated_at.desc
POST   /collections  { name, description, is_public }
PATCH  /collections?id=eq.uuid  { name, description, is_public }
DELETE /collections?id=eq.uuid

GET    /collection_recipes?collection_id=eq.uuid&order=sort_order
POST   /collection_recipes  { collection_id, recipe_id, sort_order }
DELETE /collection_recipes?collection_id=eq.uuid&recipe_id=eq.123
```

### Collection with Recipe Details (view)
```sql
CREATE VIEW collection_details AS
SELECT
    c.id, c.name, c.description, c.is_public, c.owner, c.created_at,
    COUNT(cr.recipe_id) AS recipe_count,
    (SELECT r.image FROM recipes r WHERE r.id = c.cover_recipe_id) AS cover_image
FROM collections c
LEFT JOIN collection_recipes cr ON cr.collection_id = c.id
GROUP BY c.id;
```

## UI/UX

### My Collections Page (`/samlingar`)
```
Mina samlingar
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  [Cover Img] │ │  [Cover Img] │ │     +        │
│  Julmat 2025 │ │  Snabba      │ │  Ny samling  │
│  8 recept    │ │  middagar    │ │              │
│  🔒 Privat   │ │  12 recept   │ │              │
└──────────────┘ │  🌐 Delad    │ └──────────────┘
                 └──────────────┘
```

### Collection Detail Page (`/samlingar/[id]`)
```
Julmat 2025                    [Redigera] [Dela]
En samling klassiska julrecept.

┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Julskinka│ │ Janssons│ │ Köttbull│ │ Risgryn │
│         │ │         │ │         │ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### Adding to Collection (from recipe page)
```
[♡ Gilla]  [📁 Lägg i samling ▼]
           ├── Julmat 2025
           ├── Snabba middagar
           └── + Ny samling...
```

### Shared Collection View
Public URL: `/samlingar/[id]` — same page, but read-only for non-owners.

## Edge Cases

1. **Recipe deleted**: Removed from all collections (CASCADE), cover_recipe_id set to null
2. **Empty collection**: Show placeholder with "Lägg till recept"
3. **Duplicate add**: Primary key prevents duplicates, show toast
4. **Public toggle**: Warn before making public, warn before making private (breaks shared links)
5. **Max collections**: Soft limit of 50 per user (configurable via subscription tier)
6. **Collection with 100+ recipes**: Paginate, show load more

## Success Metrics

- Adoption: % of users who create at least one collection
- Engagement: Average recipes per collection
- Sharing: % of collections marked as public
- Discovery: Views on public collections from non-owners
