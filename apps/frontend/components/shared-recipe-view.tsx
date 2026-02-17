"use client";

import { useState, useTransition } from "react";
import { BookmarkPlus, Check, LogIn } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);

  const isLoggedIn = !!user;

  function handleSaveRecipe() {
    if (savedRecipeId || isPending) return;
    setError(null);

    startTransition(async () => {
      const result = await copySharedRecipe(token);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setSavedRecipeId(result.newRecipeId);
    });
  }

  const saveButton = isLoggedIn ? (
    <Button
      onClick={handleSaveRecipe}
      disabled={isPending || !!savedRecipeId}
      className={`h-10 rounded-full shadow-md backdrop-blur-sm ${
        savedRecipeId
          ? "bg-green-600 text-white hover:bg-green-600"
          : "bg-white/90 hover:bg-white text-foreground"
      }`}
    >
      {savedRecipeId ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Sparat!
        </>
      ) : isPending ? (
        "Sparar..."
      ) : (
        <>
          <BookmarkPlus className="mr-2 h-4 w-4" />
          Spara
        </>
      )}
    </Button>
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
      {/* Success banner */}
      {savedRecipeId && (
        <div className="rounded-xl bg-muted px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-foreground/60">
            Receptet har sparats i din samling
          </p>
          <Link
            href={`/recept/${savedRecipeId}`}
            className="text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
          >
            Visa recept &rarr;
          </Link>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Attribution banner */}
      <div className="rounded-xl bg-muted px-4 py-3">
        <p className="text-sm text-foreground/60">
          Delat av{" "}
          <span className="font-medium text-foreground">
            {recipe.shared_by_name}
          </span>
        </p>
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
