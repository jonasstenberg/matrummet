"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, LogIn } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RecipeDetail } from "@/components/recipe-detail";
import { useAuth } from "@/components/auth-provider";
import { copySharedRecipe } from "@/lib/recipe-actions";
import type { SharedRecipe, Recipe } from "@/lib/types";
import Link from "next/link";

interface SharedRecipeViewProps {
  recipe: SharedRecipe;
  token: string;
}

// Convert SharedRecipe to Recipe format for RecipeDetail component
function sharedToRecipe(shared: SharedRecipe): Recipe {
  return {
    id: shared.id,
    name: shared.name,
    author: shared.author,
    description: shared.description,
    url: shared.url,
    recipe_yield: shared.recipe_yield,
    recipe_yield_name: shared.recipe_yield_name,
    prep_time: shared.prep_time,
    cook_time: shared.cook_time,
    cuisine: shared.cuisine,
    image: shared.image,
    thumbnail: shared.thumbnail,
    date_published: shared.date_published,
    date_modified: shared.date_modified,
    categories: shared.categories,
    ingredient_groups: shared.ingredient_groups,
    ingredients: shared.ingredients,
    instruction_groups: shared.instruction_groups,
    instructions: shared.instructions,
    // These fields are not relevant for shared recipes
    is_liked: false,
    is_owner: false,
    owner_name: shared.owner_name,
  };
}

export function SharedRecipeView({ recipe, token }: SharedRecipeViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isLoggedIn = !!user;

  function handleSaveRecipe() {
    setError(null);

    startTransition(async () => {
      const result = await copySharedRecipe(token);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      // Success - redirect to the saved recipe
      router.push(`/recept/${result.newRecipeId}`);
    });
  }

  // Action button for saving the recipe
  const saveButton = isLoggedIn ? (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white text-foreground">
          <BookmarkPlus className="mr-2 h-4 w-4" />
          Spara
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Spara recept</DialogTitle>
          <DialogDescription>
            Receptet sparas i din samling där du kan redigera det när du vill.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button onClick={handleSaveRecipe} disabled={isPending}>
            {isPending ? "Sparar..." : "Spara till mina recept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : (
    <Button
      asChild
      className="h-10 rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white text-foreground"
    >
      <Link href="/auth/login">
        <LogIn className="mr-2 h-4 w-4" />
        Logga in för att spara
      </Link>
    </Button>
  );

  const recipeData = sharedToRecipe(recipe);

  return (
    <div className="space-y-6">
      {/* Attribution banner */}
      <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Delat av <span className="font-medium">{recipe.shared_by_name}</span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {saveButton}
      </div>

      {/* Recipe Detail */}
      <RecipeDetail recipe={recipeData} />
    </div>
  );
}
