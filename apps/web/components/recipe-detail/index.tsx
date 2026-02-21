
import { useState } from "react";
import type { Recipe } from "@/lib/types";
import { getImageUrl, getImageSrcSet } from "@/lib/utils";
import { RecipeHero } from "./recipe-hero";
import { RecipeContent } from "./recipe-content";
import { RecipeAdditional } from "./recipe-additional";
import { calculateTotalTime } from "./utils";

interface RecipeDetailProps {
  recipe: Recipe;
  actionButton?: React.ReactNode;
}

export function RecipeDetail({ recipe, actionButton }: RecipeDetailProps) {
  const imageUrl = getImageUrl(recipe.image, "large");
  const imageSrcSet = getImageSrcSet(recipe.image);
  const totalTime = calculateTotalTime(recipe.prep_time, recipe.cook_time);

  // Servings state for scaling
  const originalServings = recipe.recipe_yield ?? 0;
  const [servings, setServings] = useState(originalServings);
  const scaleFactor = originalServings > 0 ? servings / originalServings : 1;

  return (
    <article className="space-y-8">
      <RecipeHero
        recipe={recipe}
        actionButton={actionButton}
        imageUrl={imageUrl}
        imageSrcSet={imageSrcSet}
        totalTime={totalTime}
      />
      <RecipeContent
        recipe={recipe}
        originalServings={originalServings}
        servings={servings}
        onServingsChange={setServings}
        scaleFactor={scaleFactor}
      />
      {recipe.cuisine && <RecipeAdditional cuisine={recipe.cuisine} />}
    </article>
  );
}
