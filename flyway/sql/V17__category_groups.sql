-- Migration: Category groups
-- Organizes the 56 predefined categories into 7 logical groups for better UX.

-- =============================================================================
-- 1. Create category_groups table
-- =============================================================================

CREATE TABLE public.category_groups (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    date_published timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_modified timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT category_groups_pkey PRIMARY KEY (id),
    CONSTRAINT category_groups_name_key UNIQUE (name)
);

-- =============================================================================
-- 2. RLS policies for category_groups (same pattern as categories)
-- =============================================================================

ALTER TABLE public.category_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY category_groups_policy_select ON public.category_groups
    FOR SELECT USING (true);

CREATE POLICY category_groups_policy_insert ON public.category_groups
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY category_groups_policy_update ON public.category_groups
    FOR UPDATE USING (public.is_admin());

CREATE POLICY category_groups_policy_delete ON public.category_groups
    FOR DELETE USING (public.is_admin());

-- =============================================================================
-- 3. Grants
-- =============================================================================

GRANT SELECT ON TABLE public.category_groups TO anon;
GRANT SELECT ON TABLE public.category_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.category_groups TO authenticated;

-- =============================================================================
-- 4. Add group_id FK to categories
-- =============================================================================

ALTER TABLE public.categories
    ADD COLUMN group_id uuid REFERENCES public.category_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_categories_group_id ON public.categories(group_id);

-- =============================================================================
-- 5. Insert the 7 groups
-- =============================================================================

INSERT INTO public.category_groups (name, sort_order) VALUES
    ('Måltid', 0),
    ('Typ', 1),
    ('Kök', 2),
    ('Kost', 3),
    ('Egenskap', 4),
    ('Huvudingrediens', 5),
    ('Säsong', 6);

INSERT INTO public.categories (name, owner) VALUES ('Lamm', 'system');
UPDATE public.categories SET owner = 'system';

-- =============================================================================
-- 6. Rename categories
-- =============================================================================

UPDATE public.categories SET name = 'Semester/Sommar' WHERE name = 'Sommar';
UPDATE public.categories SET name = 'Snabbt (under 30 min)' WHERE name = 'Snabbt';

-- =============================================================================
-- 7. Assign categories to groups
-- =============================================================================

-- Måltid
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Måltid')
WHERE name IN ('Frukost', 'Lunch', 'Middag', 'Brunch', 'Mellanmål', 'Fika', 'Förrätt', 'Huvudrätt', 'Efterrätt', 'Buffé');

-- Typ
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Typ')
WHERE name IN ('Soppa', 'Sallad', 'Bakverk', 'Bröd', 'Dryck', 'Smoothie', 'Sås & tillbehör', 'Plockmat', 'Grillat');

-- Kök
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Kök')
WHERE name IN ('Svenskt', 'Asiatiskt', 'Italienskt', 'Indiskt', 'Mellanöstern', 'Amerikanskt', 'Franskt', 'Grekiskt', 'Mexikanskt', 'Spanskt');

-- Kost
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Kost')
WHERE name IN ('Vegetariskt', 'Veganskt', 'Glutenfritt', 'Laktosfritt', 'LCHF/Keto', 'Nyckelhålsmärkt');

-- Egenskap
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Egenskap')
WHERE name IN ('Billigt', 'Snabbt (under 30 min)', 'Enkelt', 'Barnvänligt', 'Mealprep', 'Klimatsmart', 'Festligt');

-- Huvudingrediens
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Huvudingrediens')
WHERE name IN ('Kyckling', 'Nötkött', 'Fläsk', 'Fisk & skaldjur', 'Pasta', 'Ris', 'Baljväxter', 'Potatis', 'Ägg', 'Lamm');

-- Säsong
UPDATE public.categories SET group_id = (SELECT id FROM public.category_groups WHERE name = 'Säsong')
WHERE name IN ('Midsommar', 'Jul', 'Påsk', 'Kräftskiva', 'Semester/Sommar');
