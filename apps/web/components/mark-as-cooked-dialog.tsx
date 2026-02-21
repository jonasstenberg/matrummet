
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
import {
  getCommonPantryItems,
  getUserPantry,
  removeFromPantry,
} from "@/lib/ingredient-search-actions";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import type { Recipe } from "@/lib/types";
import { Check } from "@/lib/icons";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface MarkAsCookedDialogProps {
  recipe: Recipe;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DeductionEntry {
  food_id: string;
  ingredientName: string;
  recipeQty: string;
  recipeMeasurement: string;
  checked: boolean;
  isStaple: boolean;
}

export function MarkAsCookedDialog({
  recipe,
  open,
  onOpenChange,
}: MarkAsCookedDialogProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deductions, setDeductions] = useState<DeductionEntry[] | null>(null);

  // null = loading, [] = loaded but empty, [...] = loaded with items
  const isLoading = open && deductions === null && !error;

  useEffect(() => {
    if (open) {
      Promise.all([getUserPantry(), getCommonPantryItems()])
        .then(([pantryResult, commonItems]) => {
          if ("error" in pantryResult) {
            setError(pantryResult.error);
            return;
          }

          const pantryFoodIds = new Set(pantryResult.map((p) => p.food_id));
          const stapleIds = new Set(commonItems.map((c) => c.id));

          // Deduplicate by food_id (e.g. Olivolja used in two ingredient groups)
          const seen = new Set<string>();
          const entries: DeductionEntry[] = [];

          for (const ingredient of recipe.ingredients) {
            if (!ingredient.in_pantry || !ingredient.food_id) continue;
            if (!pantryFoodIds.has(ingredient.food_id)) continue;
            if (seen.has(ingredient.food_id)) continue;
            seen.add(ingredient.food_id);

            const isStaple = stapleIds.has(ingredient.food_id);

            entries.push({
              food_id: ingredient.food_id,
              ingredientName: ingredient.name,
              recipeQty: ingredient.quantity,
              recipeMeasurement: ingredient.measurement,
              checked: !isStaple,
              isStaple,
            });
          }

          setDeductions(entries);
        });
    }
  }, [open, recipe.ingredients]);

  function toggleItem(index: number) {
    setDeductions((prev) =>
      prev?.map((d, i) => (i === index ? { ...d, checked: !d.checked } : d)) ?? null
    );
  }

  const checkedCount = deductions?.filter((d) => d.checked).length ?? 0;
  const skippedCount = recipe.ingredients.filter(
    (i) => !i.in_pantry || !i.food_id
  ).length;

  async function handleSubmit() {
    const itemsToRemove = (deductions ?? [])
      .filter((d) => d.checked)
      .map((d) => d.food_id);

    if (itemsToRemove.length === 0) {
      setError("Välj minst en ingrediens att ta bort");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      for (const foodId of itemsToRemove) {
        const result = await removeFromPantry(foodId);
        if ("error" in result) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }
      }

      setSuccess(true);
      setIsSubmitting(false);

      setTimeout(() => {
        onOpenChange(false);
        router.invalidate();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ett oväntat fel uppstod"
      );
      setIsSubmitting(false);
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setError(null);
      setSuccess(false);
      setDeductions(null);
    }
    onOpenChange(newOpen);
  }

  function renderRow(entry: DeductionEntry, index: number) {
    return (
      <label
        key={entry.food_id}
        className="flex items-center gap-3 py-3 sm:py-2 px-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
      >
        <Checkbox
          checked={entry.checked}
          onCheckedChange={() => toggleItem(index)}
          className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{entry.ingredientName}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {entry.recipeQty}
            {entry.recipeMeasurement ? ` ${entry.recipeMeasurement}` : ""}
          </span>
        </div>
      </label>
    );
  }

  const mainItems = deductions?.filter((d) => !d.isStaple) ?? [];
  const stapleItems = deductions?.filter((d) => d.isStaple) ?? [];

  const content = (
    <>
      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Laddar skafferi...
        </div>
      ) : success ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium">
            Skafferiet har uppdaterats!
          </p>
        </div>
      ) : (
        <>
          {!deductions || deductions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Inga ingredienser att ta bort från skafferiet.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="py-2 space-y-0.5">
                {mainItems.map((entry) => {
                  const index = deductions!.indexOf(entry);
                  return renderRow(entry, index);
                })}

                {stapleItems.length > 0 && (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2 px-2 mt-2 border-t">
                      Basvaror
                    </div>
                    {stapleItems.map((entry) => {
                      const index = deductions!.indexOf(entry);
                      return renderRow(entry, index);
                    })}
                  </>
                )}
              </div>
            </div>
          )}

          {skippedCount > 0 && (
            <p className="text-xs text-muted-foreground px-2 pt-2">
              {skippedCount} ingrediens{skippedCount !== 1 ? "er" : ""} finns
              inte i ditt skafferi och hoppas över.
            </p>
          )}

          {error && (
            <Alert variant="destructive" className="shrink-0 mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </>
      )}
    </>
  );

  const footer = success ? null : (
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
        disabled={isSubmitting || checkedCount === 0}
      >
        {isSubmitting
          ? "Uppdaterar..."
          : `Ta bort från skafferiet (${checkedCount})`}
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
            <SheetTitle>Jag har lagat detta</SheetTitle>
            <SheetDescription>
              Välj vilka ingredienser du använde upp och vill ta bort från
              skafferiet.
            </SheetDescription>
          </SheetHeader>
          {content}
          {footer && (
            <SheetFooter className="shrink-0 pt-4 border-t flex-row gap-2">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-lg gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Jag har lagat detta</DialogTitle>
          <DialogDescription>
            Välj vilka ingredienser du använde upp och vill ta bort från
            skafferiet.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {content}
        </div>
        {footer && (
          <DialogFooter className="shrink-0 pt-4 border-t gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
