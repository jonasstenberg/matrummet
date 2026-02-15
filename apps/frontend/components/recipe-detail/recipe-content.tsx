"use client";

import type { Recipe } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { IngredientsList } from "@/components/ingredients-list";
import { InstructionsChecklist } from "@/components/instructions-checklist";
import { ServingsSlider } from "@/components/servings-slider";

interface RecipeContentProps {
  recipe: Recipe;
  originalServings: number;
  servings: number;
  onServingsChange: (servings: number) => void;
  scaleFactor: number;
}

export function RecipeContent({
  recipe,
  originalServings,
  servings,
  onServingsChange,
  scaleFactor,
}: RecipeContentProps) {
  return (
    <div className="grid grid-cols-1 gap-8 landscape:sm:grid-cols-3 lg:grid-cols-3">
      {/* Ingredients */}
      <div className="landscape:sm:col-span-1 lg:col-span-1">
        <div>
          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <div className="space-y-4">
              {originalServings > 0 && (
                <Card className="rounded-2xl p-4">
                  <ServingsSlider
                    originalServings={originalServings}
                    servingsName={recipe.recipe_yield_name || "portioner"}
                    value={servings}
                    onChange={onServingsChange}
                  />
                </Card>
              )}
              <IngredientsList
                ingredients={recipe.ingredients}
                ingredientGroups={recipe.ingredient_groups}
                scaleFactor={scaleFactor}
              />
            </div>
          ) : (
            <Card className="overflow-hidden rounded-2xl">
              <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Ingredienser
                </h2>
              </div>
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Inga ingredienser angivna.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="landscape:sm:col-span-2 lg:col-span-2">
        {recipe.instructions && recipe.instructions.length > 0 ? (
          <InstructionsChecklist
            recipe={recipe}
            instructions={recipe.instructions}
            instructionGroups={recipe.instruction_groups}
            scaleFactor={scaleFactor}
          />
        ) : (
          <Card className="overflow-hidden rounded-2xl">
            <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">
                Gör så här
              </h2>
            </div>
            <p className="px-5 py-4 text-sm text-muted-foreground">
              Inga instruktioner angivna.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
