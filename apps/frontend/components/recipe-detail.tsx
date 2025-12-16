"use client";

import { useState } from "react";
import type { Recipe } from "@/lib/types";
import { IMAGE_BLUR_DATA_URL } from "@/lib/utils";
import {
  Calendar,
  ChefHat,
  Clock,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Image from "next/image";
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

function PlaceholderHero() {
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
        <div className="rounded-full bg-card/60 p-8 shadow-sm backdrop-blur-sm">
          <UtensilsCrossed
            className="h-16 w-16 text-primary/40"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}

export function RecipeDetail({ recipe }: RecipeDetailProps) {
  const hasImage = !!recipe.image;
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
      {/* Hero Image */}
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl shadow-[0_4px_20px_-4px_rgba(139,90,60,0.15)]">
        {hasImage ? (
          <>
            <Image
              src={`/uploads/${recipe.image}`}
              alt={recipe.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              placeholder="blur"
              blurDataURL={IMAGE_BLUR_DATA_URL}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </>
        ) : (
          <PlaceholderHero />
        )}
      </div>

      {/* Header */}
      <header className="space-y-4">
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
        <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-muted-foreground">
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
      </header>

      {/* Recipe Info Bar */}
      {infoItems.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {totalTime && (
            <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-[0_2px_8px_-2px_rgba(139,90,60,0.08)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Tid
                </p>
                <p className="font-semibold text-foreground">{totalTime}</p>
              </div>
            </div>
          )}

          {recipe.recipe_yield && (
            <div className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-[0_2px_8px_-2px_rgba(139,90,60,0.08)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                <Users className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Portioner
                </p>
                <p className="font-semibold text-foreground">
                  {recipe.recipe_yield} {recipe.recipe_yield_name || "st"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

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
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Gör så här</h2>
              <p className="text-sm text-muted-foreground">
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
