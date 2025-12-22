"use client";

import type { Recipe } from "@/lib/types";
import { getImageUrl } from "@/lib/utils";
import { Calendar, ChefHat, Clock, Users, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { IngredientsList } from "./ingredients-list";
import { InstructionsChecklist } from "./instructions-checklist";
import { ServingsSlider } from "./servings-slider";

interface RecipeDetailProps {
  recipe: Recipe;
}

function calculateTotalTime(
  prepTime: number | null,
  cookTime: number | null
): string | null {
  const prep = prepTime ?? 0;
  const cook = cookTime ?? 0;
  const totalMinutes = prep + cook;

  if (totalMinutes === 0) return null;

  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (remainingMinutes === 0) return `${hours} tim`;
  return `${hours} tim ${remainingMinutes} min`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function PlaceholderImage() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-muted/60">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-card/60 p-6 shadow-sm backdrop-blur-sm">
          <UtensilsCrossed
            className="h-12 w-12 text-primary/40"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const imageUrl = getImageUrl(recipe.image);
  const hasImage = !!imageUrl;
  const totalTime = calculateTotalTime(recipe.prep_time, recipe.cook_time);
  const hasDescription = recipe.description && recipe.description !== "-";

  // Servings state for scaling
  const originalServings = recipe.recipe_yield ?? 0;
  const [servings, setServings] = useState(originalServings);
  const scaleFactor = originalServings > 0 ? servings / originalServings : 1;

  // Count how many info items we have
  const infoItems = [totalTime, recipe.recipe_yield].filter(Boolean);

  return (
    <article className="space-y-8">
      {/* Hero Section: Metadata left, Image right */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        {/* Left: Metadata */}
        <div className="flex flex-col justify-center space-y-4 order-2 md:order-1">
          {/* Categories */}
          {recipe.categories && recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.categories.map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-secondary/10 px-3 py-1 text-sm font-medium text-secondary"
                >
                  {category}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {recipe.name}
          </h1>

          {hasDescription && (
            <p className="text-lg leading-relaxed text-muted-foreground">
              {recipe.description}
            </p>
          )}

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {recipe.author && (
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-primary/60" />
                <span>{recipe.author}</span>
              </div>
            )}

            {recipe.date_published && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary/60" />
                <span>{formatDate(recipe.date_published)}</span>
              </div>
            )}
          </div>

          {/* Recipe Info */}
          {infoItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {totalTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary/60" />
                  <span>{totalTime}</span>
                </div>
              )}

              {recipe.recipe_yield && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-secondary" />
                  <span>
                    {recipe.recipe_yield}{" "}
                    {recipe.recipe_yield_name || "portioner"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Image */}
        <div className="order-1 md:order-2">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-[0_4px_20px_-4px_rgba(139,90,60,0.15)]">
            {hasImage && imageUrl ? (
              <img
                src={imageUrl}
                alt={recipe.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <PlaceholderImage />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Ingredients */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            {recipe.ingredients && recipe.ingredients.length > 0 ? (
              <div className="space-y-4">
                {originalServings > 0 && (
                  <div className="rounded-2xl bg-card p-4 shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
                    <ServingsSlider
                      originalServings={originalServings}
                      servingsName={recipe.recipe_yield_name || "portioner"}
                      value={servings}
                      onChange={setServings}
                    />
                  </div>
                )}
                <IngredientsList
                  ingredients={recipe.ingredients}
                  ingredientGroups={recipe.ingredient_groups}
                  scaleFactor={scaleFactor}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
                <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    Ingredienser
                  </h2>
                </div>
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  Inga ingredienser angivna.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="lg:col-span-2">
          {recipe.instructions && recipe.instructions.length > 0 ? (
            <InstructionsChecklist
              recipeId={recipe.id}
              instructions={recipe.instructions}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
              <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Gör så här
                </h2>
              </div>
              <p className="px-5 py-4 text-sm text-muted-foreground">
                Inga instruktioner angivna.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Additional Info */}
      {recipe.cuisine && (
        <div className="rounded-xl bg-card p-5 shadow-[0_2px_8px_-2px_rgba(139,90,60,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Kök
          </h3>
          <p className="mt-1 text-foreground">{recipe.cuisine}</p>
        </div>
      )}
    </article>
  );
}
