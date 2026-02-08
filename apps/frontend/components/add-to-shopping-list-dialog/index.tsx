"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  addRecipeToShoppingList,
  createShoppingList,
  getUserShoppingLists,
} from "@/lib/actions";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IngredientChecklist } from "./ingredient-checklist";
import { RecipeServingsScaler } from "./recipe-servings-scaler";
import { ShoppingListSelector } from "./shopping-list-selector";
import type { AddToShoppingListDialogProps, ShoppingList } from "./types";

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

  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  const hasInitializedSelection = useRef(false);

  useEffect(() => {
    if (open) {
      setIsLoadingLists(true);
      getUserShoppingLists()
        .then((result) => {
          if (!("error" in result)) {
            setLists(result);
            const defaultList = result.find((l) => l.is_default) || result[0];
            if (defaultList) {
              setSelectedListId(defaultList.id);
            }
          }
        })
        .finally(() => setIsLoadingLists(false));

      hasInitializedSelection.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (open && !hasInitializedSelection.current) {
      const hasPantryData = recipe.ingredients.some((i) => i.in_pantry);
      if (hasPantryData) {
        const missingIngredients = recipe.ingredients.filter(
          (i) => !i.in_pantry
        );
        setSelectedIngredients(
          new Set(missingIngredients.map((i) => i.id ?? i.name))
        );
      }
      hasInitializedSelection.current = true;
    }
  }, [open, recipe.ingredients]);

  const scaleFactor = originalServings > 0 ? servings / originalServings : 1;
  const maxServings = Math.max(originalServings * 3, 12);

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

  async function handleCreateList() {
    if (!newListName.trim()) return;

    setIsCreatingList(true);
    try {
      const result = await createShoppingList(newListName.trim());
      if ("id" in result) {
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

      onOpenChange(false);
      router.push("/inkopslista");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett oväntat fel uppstod");
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setError(null);
      setNewListName("");
    }
    onOpenChange(newOpen);
  }

  const isMobile = useIsMobile();

  const content = (
    <>
      <ShoppingListSelector
        lists={lists}
        selectedListId={selectedListId}
        onSelectedListChange={setSelectedListId}
        isLoading={isLoadingLists}
        newListName={newListName}
        onNewListNameChange={setNewListName}
        onCreateList={handleCreateList}
        isCreating={isCreatingList}
      />

      <RecipeServingsScaler
        servings={servings}
        originalServings={originalServings}
        maxServings={maxServings}
        yieldName={recipe.recipe_yield_name}
        onServingsChange={setServings}
      />

      <IngredientChecklist
        ingredients={recipe.ingredients}
        ingredientGroups={recipe.ingredient_groups}
        selectedIngredients={selectedIngredients}
        onToggleIngredient={toggleIngredient}
        onToggleAll={toggleAll}
        scaleFactor={scaleFactor}
        allSelected={allSelected}
        someSelected={someSelected}
      />

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
