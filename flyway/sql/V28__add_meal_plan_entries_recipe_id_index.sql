--
-- V28: Add missing indexes on meal plan tables
--

-- Index on meal_plan_entries(recipe_id) to avoid sequential scan on recipe DELETE CASCADE
CREATE INDEX meal_plan_entries_recipe_id_idx ON meal_plan_entries(recipe_id);

-- Composite index on meal_plans(home_id, status) for common query pattern
-- (e.g. finding the active plan for a given home)
CREATE INDEX meal_plans_home_id_status_idx ON meal_plans(home_id, status);
