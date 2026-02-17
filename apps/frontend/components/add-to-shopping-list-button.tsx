"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AddToShoppingListDialog } from "@/components/add-to-shopping-list-dialog";
import { useAuth } from "@/components/auth-provider";
import { ShoppingCart } from "@/lib/icons";
import type { Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddToShoppingListButtonProps {
  recipe: Recipe;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  showLabel?: boolean;
}

export function AddToShoppingListButton({
  recipe,
  className,
  variant = "outline",
  showLabel = true,
}: AddToShoppingListButtonProps) {
  const { homes } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't render if there are no ingredients
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setIsDialogOpen(true)}
        className={cn(showLabel ? "" : "px-3", className)}
        aria-label="Lägg till i inköpslista"
      >
        <ShoppingCart className="h-4 w-4" />
        {showLabel && <span className="ml-2">Inköpslista</span>}
      </Button>

      <AddToShoppingListDialog
        recipe={recipe}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        homes={homes}
      />
    </>
  );
}
