import type {
  Ingredient,
  IngredientGroup,
  Recipe,
  ShoppingList,
} from "@/lib/types";

export type { Ingredient, IngredientGroup, Recipe, ShoppingList };

export interface AddToShoppingListDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface RecipeServingsScalerProps {
  servings: number;
  originalServings: number;
  maxServings: number;
  yieldName?: string | null;
  onServingsChange: (servings: number) => void;
}

export interface ShoppingListSelectorProps {
  lists: ShoppingList[];
  selectedListId: string;
  onSelectedListChange: (id: string) => void;
  isLoading: boolean;
  newListName: string;
  onNewListNameChange: (name: string) => void;
  onCreateList: () => void;
  isCreating: boolean;
}

export interface IngredientChecklistProps {
  ingredients: Ingredient[];
  ingredientGroups?: IngredientGroup[];
  selectedIngredients: Set<string>;
  onToggleIngredient: (id: string) => void;
  onToggleAll: () => void;
  scaleFactor: number;
  allSelected: boolean;
  someSelected: boolean;
}
