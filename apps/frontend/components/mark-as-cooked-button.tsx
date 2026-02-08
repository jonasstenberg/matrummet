"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MarkAsCookedDialog } from "@/components/mark-as-cooked-dialog";
import { ChefHat } from "@/lib/icons";
import type { Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MarkAsCookedButtonProps {
  recipe: Recipe;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  showLabel?: boolean;
}

export function MarkAsCookedButton({
  recipe,
  className,
  variant = "outline",
  showLabel = true,
}: MarkAsCookedButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't render if there are no ingredients
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return null;
  }

  // Don't render if no ingredients match the pantry
  const hasPantryMatches = recipe.ingredients.some(
    (i) => i.in_pantry && i.food_id
  );
  if (!hasPantryMatches) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setIsDialogOpen(true)}
        className={cn(showLabel ? "" : "px-3", className)}
        aria-label="Jag har lagat detta"
      >
        <ChefHat className="h-4 w-4" />
        {showLabel && <span className="ml-2">Lagat</span>}
      </Button>

      <MarkAsCookedDialog
        recipe={recipe}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
