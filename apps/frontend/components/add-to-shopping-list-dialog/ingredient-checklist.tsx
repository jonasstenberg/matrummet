"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { scaleQuantity } from "@/lib/quantity-utils";
import { Check } from "@/lib/icons";
import { useMemo } from "react";
import type { Ingredient, IngredientChecklistProps } from "./types";

export function IngredientChecklist({
  ingredients,
  ingredientGroups,
  selectedIngredients,
  onToggleIngredient,
  onToggleAll,
  scaleFactor,
  allSelected,
  someSelected,
}: IngredientChecklistProps) {
  const ingredientsInPantry = ingredients.filter((i) => i.in_pantry);
  const hasPantryInfo = ingredientsInPantry.length > 0;

  const groupedIngredients = useMemo(() => {
    const groups = new Map<string | null, Ingredient[]>();
    const groupDetails = new Map<
      string,
      { name: string; sort_order: number }
    >();

    ingredientGroups?.forEach((group) => {
      if (group.id) {
        groupDetails.set(group.id, {
          name: group.name,
          sort_order: group.sort_order || 0,
        });
      }
    });

    ingredients.forEach((ingredient) => {
      const groupId = ingredient.group_id || null;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(ingredient);
    });

    return Array.from(groups.entries())
      .sort(([aId], [bId]) => {
        if (aId === null) return 1;
        if (bId === null) return -1;
        const aOrder = groupDetails.get(aId)?.sort_order || 0;
        const bOrder = groupDetails.get(bId)?.sort_order || 0;
        return aOrder - bOrder;
      })
      .map(([groupId, groupIngredients]) => ({
        groupId,
        groupName: groupId ? groupDetails.get(groupId)?.name : null,
        ingredients: groupIngredients,
      }));
  }, [ingredients, ingredientGroups]);

  return (
    <>
      {/* Pantry summary */}
      {hasPantryInfo && ingredientsInPantry.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 py-3 px-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
          <span className="text-sm text-foreground">
            <span className="font-medium">{ingredientsInPantry.length}</span> av{" "}
            {ingredients.length} ingredienser finns i ditt skafferi
          </span>
        </div>
      )}

      {/* Select all toggle */}
      <div className="shrink-0 flex items-center gap-3 py-3 border-y">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={onToggleAll}
          aria-label={allSelected ? "Avmarkera alla" : "Välj alla"}
          className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
        />
        <label
          htmlFor="select-all"
          className="text-sm font-medium cursor-pointer select-none flex-1"
        >
          {allSelected ? "Avmarkera alla" : "Välj alla"}
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {selectedIngredients.size} av {ingredients.length} valda
        </span>
      </div>

      {/* Ingredients list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="py-2 space-y-1">
          {groupedIngredients.map(({ groupId, groupName, ingredients: groupIngredients }) => (
            <div key={groupId || "ungrouped"}>
              {groupName && (
                <div className="sticky top-0 text-xs font-semibold uppercase tracking-wider text-primary py-2 px-1 bg-background/95 backdrop-blur-sm border-b border-border/50 mb-1">
                  {groupName}
                </div>
              )}
              <div className="space-y-0.5">
                {groupIngredients.map((ingredient, index) => {
                  const id = ingredient.id ?? `${groupId}-${index}`;
                  const isSelected = selectedIngredients.has(id);
                  const isInPantry = ingredient.in_pantry;

                  return (
                    <label
                      key={id}
                      className="flex items-center gap-3 py-3 sm:py-2 px-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleIngredient(id)}
                        aria-label={`Välj ${ingredient.name}`}
                        className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-semibold tabular-nums text-foreground">
                          {scaleQuantity(ingredient.quantity, scaleFactor)}
                          {ingredient.measurement
                            ? ` ${ingredient.measurement}`
                            : ""}
                          {ingredient.form ? ` ${ingredient.form}` : ""}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {ingredient.name}
                        </span>
                      </span>
                      {isInPantry && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
