# Recipe Notes

## Overview

Personal notes on recipes, visible only to the author and their household members. Intended for recording cooking adjustments, family preferences, and practical tips from actually making the recipe.

**Value Proposition:**
- Captures tribal cooking knowledge ("barnen vill ha mer ost")
- Private by design — not a public comments system
- Shared within homes, so household members benefit from each other's notes
- Low implementation complexity with high practical utility

## User Stories

1. Add a note to any recipe I've viewed
2. See my household's notes when viewing a recipe
3. Edit or delete my own notes
4. Notes show author name and date
5. Pin an important note to the top

## Database Schema

```sql
CREATE TABLE recipe_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    owner TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    home_id UUID REFERENCES homes(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX recipe_notes_recipe_id_idx ON recipe_notes(recipe_id);
CREATE INDEX recipe_notes_owner_idx ON recipe_notes(owner);

-- RLS: See own notes + notes from home members
ALTER TABLE recipe_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_notes_select ON recipe_notes FOR SELECT USING (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR home_id IN (
        SELECT home_id FROM home_members
        WHERE user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
);

CREATE POLICY recipe_notes_insert ON recipe_notes FOR INSERT
    WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY recipe_notes_update ON recipe_notes FOR UPDATE USING (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE POLICY recipe_notes_delete ON recipe_notes FOR DELETE USING (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
);
```

## API

Standard PostgREST CRUD on `recipe_notes` table. No RPC functions needed.

```
GET    /recipe_notes?recipe_id=eq.123&order=is_pinned.desc,created_at.desc
POST   /recipe_notes  { recipe_id, body, home_id }
PATCH  /recipe_notes?id=eq.uuid  { body, is_pinned }
DELETE /recipe_notes?id=eq.uuid
```

## UI/UX

### Notes Section (on recipe page)
```
── Anteckningar ──────────────────────
📌 Jonas, 12 jan:
   Behöver dubbla vitlöken. Barnen gillar
   extra ost på toppen.
   [Redigera]

   Anna, 3 feb:
   Bytte grädde mot kokosgrädde, funkar bra!
   [Redigera]

[+ Lägg till anteckning]
──────────────────────────────────────
```

### Add/Edit Note
Simple textarea, no rich text. Markdown optional for v2.

### Placement
Below the recipe instructions, above the "like" button or related recipes section.

## Edge Cases

1. **User not in a home**: Notes are private to user only (home_id = null)
2. **User leaves home**: Their notes remain but are no longer visible to former home members (home_id set to null via trigger or left as-is)
3. **Recipe deleted**: Notes cascade-deleted
4. **Empty notes**: Prevent saving empty/whitespace-only notes
5. **Long notes**: Allow up to 2000 characters, show truncated with "Visa mer"

## Success Metrics

- Adoption: % of active users who add at least one note
- Engagement: Average notes per recipe (among recipes with notes)
- Retention signal: Users who add notes tend to return more frequently
