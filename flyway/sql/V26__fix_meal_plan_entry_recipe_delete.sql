-- Fix: deleting a recipe that was saved from a meal plan suggestion fails
-- because ON DELETE SET NULL leaves both recipe_id and suggested_name as null,
-- violating the check constraint.
-- Change to ON DELETE CASCADE — removing a recipe should remove the meal plan entry.

ALTER TABLE meal_plan_entries
    DROP CONSTRAINT meal_plan_entries_recipe_id_fkey,
    ADD CONSTRAINT meal_plan_entries_recipe_id_fkey
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE;
