"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  addRecipeToShoppingList,
  createShoppingList,
  getUserShoppingLists,
} from "@/lib/actions";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { scaleQuantity } from "@/lib/quantity-utils";
import type { Ingredient, Recipe, ShoppingList } from "@/lib/types";
import { Loader2, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface AddToShoppingListDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToShoppingListDialog({
  recipe,
  open,
  onOpenChange,
}: AddToShoppingListDialogProps) {
  const router = useRouter();
  const originalServings = recipe.recipe_yield ?? 4;
  const [servings, setServings] = useState(originalServings);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(
    () => new Set(recipe.ingredients.map((i) => i.id ?? i.name))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shopping list selection state
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Fetch shopping lists when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoadingLists(true);
      getUserShoppingLists()
        .then((result) => {
          if (!("error" in result)) {
            setLists(result);
            // Select the default list, or the first one if no default
            const defaultList = result.find((l) => l.is_default) || result[0];
            if (defaultList) {
              setSelectedListId(defaultList.id);
            }
          }
        })
        .finally(() => setIsLoadingLists(false));
    }
  }, [open]);

  const scaleFactor = originalServings > 0 ? servings / originalServings : 1;
  const maxServings = Math.max(originalServings * 3, 12);
  const isModified = servings !== originalServings;

  const allSelected = selectedIngredients.size === recipe.ingredients.length;
  const someSelected = selectedIngredients.size > 0 && !allSelected;

  function toggleIngredient(id: string) {
    setSelectedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIngredients(new Set());
    } else {
      setSelectedIngredients(
        new Set(recipe.ingredients.map((i) => i.id ?? i.name))
      );
    }
  }

  // Group ingredients by their group_id for display
  const groupedIngredients = useMemo(() => {
    const groups = new Map<string | null, Ingredient[]>();
    const groupDetails = new Map<
      string,
      { name: string; sort_order: number }
    >();

    recipe.ingredient_groups?.forEach((group) => {
      if (group.id) {
        groupDetails.set(group.id, {
          name: group.name,
          sort_order: group.sort_order || 0,
        });
      }
    });

    recipe.ingredients.forEach((ingredient) => {
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
      .map(([groupId, ingredients]) => ({
        groupId,
        groupName: groupId ? groupDetails.get(groupId)?.name : null,
        ingredients,
      }));
  }, [recipe.ingredients, recipe.ingredient_groups]);

  async function handleCreateList() {
    if (!newListName.trim()) return;

    setIsCreatingList(true);
    try {
      const result = await createShoppingList(newListName.trim());
      if ("id" in result) {
        // Add the new list to the local state and select it
        const newList: ShoppingList = {
          id: result.id,
          name: newListName.trim(),
          is_default: lists.length === 0,
          item_count: 0,
          checked_count: 0,
          date_published: new Date().toISOString(),
          date_modified: new Date().toISOString(),
        };
        setLists((prev) => [newList, ...prev]);
        setSelectedListId(result.id);
        setNewListName("");
      } else {
        setError(result.error);
      }
    } finally {
      setIsCreatingList(false);
    }
  }

  async function handleSubmit() {
    if (selectedIngredients.size === 0) {
      setError("Välj minst en ingrediens");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ingredientIds = Array.from(selectedIngredients).filter((id) =>
        recipe.ingredients.some((i) => i.id === id)
      );

      const result = await addRecipeToShoppingList(recipe.id, {
        servings,
        ingredientIds: ingredientIds.length > 0 ? ingredientIds : undefined,
        listId: selectedListId || undefined,
      });

      if ("error" in result) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }

      // Close dialog and redirect to shopping list
      onOpenChange(false);
      router.push("/inkopslista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett oväntat fel uppstod");
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset state when closing
      setError(null);
      setNewListName("");
    }
    onOpenChange(newOpen);
  }

  const isMobile = useIsMobile();

  const content = (
    <>
      {/* Shopping list selector */}
      <div className="shrink-0 space-y-3 py-4 rounded-lg bg-muted/30">
        <label className="text-sm font-medium">Välj inköpslista</label>
        {isLoadingLists ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Laddar listor...</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger className="flex-1 bg-background">
                <SelectValue placeholder="Välj lista" />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                    {list.is_default && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (standard)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Create new list inline */}
            <Input
              placeholder="Ny lista..."
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateList();
                }
              }}
              className="w-24 sm:w-28 bg-background"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleCreateList}
              disabled={!newListName.trim() || isCreatingList}
              aria-label="Skapa ny lista"
              className="shrink-0 bg-background"
            >
              {isCreatingList ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Servings adjuster */}
      <div className="shrink-0 space-y-3 py-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-foreground">
            {servings} {recipe.recipe_yield_name || "portioner"}
          </span>
          {isModified && (
            <button
              onClick={() => setServings(originalServings)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Återställ till originalportioner"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Återställ ({originalServings})</span>
            </button>
          )}
        </div>
        <Slider
          value={[servings]}
          onValueChange={(values) => setServings(values[0])}
          min={1}
          max={maxServings}
          step={1}
          aria-label="Antal portioner"
        />
      </div>

      {/* Select all toggle */}
      <div className="shrink-0 flex items-center gap-3 py-3 border-y">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={toggleAll}
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
          {selectedIngredients.size} av {recipe.ingredients.length} valda
        </span>
      </div>

      {/* Ingredients list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="py-2 space-y-1">
          {groupedIngredients.map(({ groupId, groupName, ingredients }) => (
            <div key={groupId || "ungrouped"}>
              {groupName && (
                <div className="sticky top-0 text-xs font-semibold uppercase tracking-wider text-primary py-2 px-1 bg-background/95 backdrop-blur-sm border-b border-border/50 mb-1">
                  {groupName}
                </div>
              )}
              <div className="space-y-0.5">
                {ingredients.map((ingredient, index) => {
                  const id = ingredient.id ?? `${groupId}-${index}`;
                  const isSelected = selectedIngredients.has(id);

                  return (
                    <label
                      key={id}
                      className="flex items-center gap-3 py-3 sm:py-2 px-2 rounded-lg hover:bg-muted/50 active:bg-muted cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleIngredient(id)}
                        aria-label={`Välj ${ingredient.name}`}
                        className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
                      />
                      <span className="flex-1 text-sm">
                        <span className="font-semibold tabular-nums text-foreground">
                          {scaleQuantity(ingredient.quantity, scaleFactor)}
                          {ingredient.measurement
                            ? ` ${ingredient.measurement}`
                            : ""}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {ingredient.name}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="shrink-0 mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );

  const footer = (
    <>
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        Avbryt
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || selectedIngredients.size === 0}
      >
        {isSubmitting ? "Lägger till..." : "Lägg till i inköpslista"}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] flex flex-col gap-0 px-4 rounded-t-xl"
        >
          <SheetHeader className="shrink-0 pb-4 text-left">
            <SheetTitle>Lägg till i inköpslista</SheetTitle>
            <SheetDescription>
              Välj ingredienser från {recipe.name} att lägga till i din
              inköpslista.
            </SheetDescription>
          </SheetHeader>
          {content}
          <SheetFooter className="shrink-0 pt-4 border-t flex-row gap-2">
            {footer}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-lg gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Lägg till i inköpslista</DialogTitle>
          <DialogDescription>
            Välj ingredienser från {recipe.name} att lägga till i din
            inköpslista.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {content}
        </div>
        <DialogFooter className="shrink-0 pt-4 border-t gap-2">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
