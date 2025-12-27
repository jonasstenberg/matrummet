import { scaleQuantity } from "@/lib/quantity-utils";

interface Ingredient {
  id?: string;
  name: string;
  quantity: string;
  measurement: string;
  group_id?: string | null;
}

interface IngredientGroup {
  id?: string;
  name: string;
  sort_order?: number;
}

interface IngredientsListProps {
  ingredients: Ingredient[];
  ingredientGroups?: IngredientGroup[];
  scaleFactor?: number;
}

export function IngredientsList({
  ingredients,
  ingredientGroups,
  scaleFactor = 1,
}: IngredientsListProps) {
  // Group ingredients by their group_id
  const groupedIngredients = new Map<string | null, Ingredient[]>();
  const groupDetails = new Map<string, { name: string; sort_order: number }>();

  // Build group details map
  ingredientGroups?.forEach((group) => {
    if (group.id) {
      groupDetails.set(group.id, {
        name: group.name,
        sort_order: group.sort_order || 0,
      });
    }
  });

  // Group ingredients
  ingredients.forEach((ingredient) => {
    const groupId = ingredient.group_id || null;
    if (!groupedIngredients.has(groupId)) {
      groupedIngredients.set(groupId, []);
    }
    groupedIngredients.get(groupId)!.push(ingredient);
  });

  // Sort groups by sort_order
  const sortedGroups = Array.from(groupedIngredients.entries()).sort(
    ([aId], [bId]) => {
      if (aId === null) return 1;
      if (bId === null) return -1;
      const aOrder = groupDetails.get(aId)?.sort_order || 0;
      const bOrder = groupDetails.get(bId)?.sort_order || 0;
      return aOrder - bOrder;
    }
  );

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
      <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Ingredienser</h2>
      </div>

      <div className="divide-y divide-border/30">
        {sortedGroups.map(([groupId, groupIngredients]) => {
          const groupName = groupId ? groupDetails.get(groupId)?.name : null;

          return (
            <div key={groupId || "ungrouped"} className="py-1">
              {groupName && (
                <div className="px-5 pb-1 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {groupName}
                  </span>
                </div>
              )}
              <ul>
                {groupIngredients.map((ingredient, index) => (
                  <li
                    key={ingredient.id || `${groupId}-${index}`}
                    className="px-5 py-2.5 text-sm transition-colors hover:bg-muted/30"
                  >
                    <span className="font-semibold tabular-nums">
                      {scaleQuantity(ingredient.quantity, scaleFactor)}
                      {ingredient.measurement ? ` ${ingredient.measurement}` : ""}
                    </span>{" "}
                    <span className="text-muted-foreground">{ingredient.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
