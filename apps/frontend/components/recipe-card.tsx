import type { Recipe } from "@/lib/types";
import { cn, getImageUrl, getImageSrcSet } from "@/lib/utils";
import { Clock, Heart, Users, UtensilsCrossed } from "lucide-react";
import Link from "next/link";

export interface RecipeMatchData {
  percentage: number;
  matchingIngredients: number;
  totalIngredients: number;
  missingFoodNames?: string[];
}

interface RecipeCardProps {
  recipe: Recipe;
  className?: string;
  matchData?: RecipeMatchData;
}

function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} tim`;
  }

  return `${hours} tim ${minutes} min`;
}

function calculateTotalTime(
  prepTime: number | null,
  cookTime: number | null
): string | null {
  if (!prepTime && !cookTime) return null;

  const totalMinutes = (prepTime ?? 0) + (cookTime ?? 0);
  return totalMinutes > 0 ? formatDuration(totalMinutes) : null;
}

function PlaceholderImage() {
  return (
    <div className="absolute inset-0 bg-linear-to-br from-muted via-muted/80 to-muted/60">
      {/* Decorative dot pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle, var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: "16px 16px",
        }}
      />
      {/* Centered icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-card/60 p-5 shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
          <UtensilsCrossed
            className="h-10 w-10 text-primary/50"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}

function getMatchColor(percentage: number): string {
  if (percentage >= 80) return "text-green-600";
  if (percentage >= 60) return "text-yellow-600";
  return "text-orange-600";
}

function getMatchBgColor(percentage: number): string {
  if (percentage >= 80) return "bg-green-600";
  if (percentage >= 60) return "bg-yellow-600";
  return "bg-orange-600";
}

export function RecipeCard({ recipe, className, matchData }: RecipeCardProps) {
  const totalTime = calculateTotalTime(recipe.prep_time, recipe.cook_time);
  const imageUrl = getImageUrl(recipe.image, 'medium');
  const imageSrcSet = getImageSrcSet(recipe.image);
  const hasImage = !!imageUrl;

  return (
    <Link href={`/recept/${recipe.id}`} className="block">
      <article
        className={cn(
          "group relative overflow-hidden rounded-2xl bg-card",
          "shadow-[0_2px_8px_-2px_rgba(139,90,60,0.08),0_4px_16px_-4px_rgba(139,90,60,0.12)]",
          "transition-all duration-300 ease-out",
          "hover:shadow-[0_8px_24px_-4px_rgba(139,90,60,0.15),0_12px_32px_-8px_rgba(139,90,60,0.2)]",
          "hover:-translate-y-1",
          className
        )}
      >
        <div className="relative aspect-4/3 w-full overflow-hidden">
          {hasImage && imageUrl ? (
            <>
              <img
                src={imageUrl}
                srcSet={imageSrcSet ?? undefined}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                alt={recipe.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/40 via-black/5 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-40" />
            </>
          ) : (
            <PlaceholderImage />
          )}

          {/* Match percentage badge */}
          {matchData && (
            <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
              <span className={cn("text-sm font-semibold", getMatchColor(matchData.percentage))}>
                {matchData.percentage}%
              </span>
            </div>
          )}

          {/* Like indicator */}
          {recipe.is_liked && (
            <div className="absolute right-2 top-2">
              <div className="rounded-full bg-white/90 p-1.5 shadow-sm backdrop-blur-sm">
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              </div>
            </div>
          )}

          {recipe.categories && recipe.categories.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
              {recipe.categories.slice(0, 2).map((category) => (
                <span
                  key={category}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
                    hasImage
                      ? "bg-white/90 text-foreground/80"
                      : "bg-card/80 text-foreground/70"
                  )}
                >
                  {category}
                </span>
              ))}
              {recipe.categories.length > 2 && (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
                    hasImage
                      ? "bg-white/70 text-foreground/60"
                      : "bg-card/60 text-foreground/50"
                  )}
                >
                  +{recipe.categories.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-4">
          <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
            {recipe.name}
          </h2>

          {recipe.description && recipe.description !== "-" && !matchData && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {recipe.description}
            </p>
          )}

          {/* Match progress bar */}
          {matchData && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {matchData.matchingIngredients}/{matchData.totalIngredients} ingredienser
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all duration-300", getMatchBgColor(matchData.percentage))}
                  style={{ width: `${matchData.percentage}%` }}
                />
              </div>
            </div>
          )}

          {(totalTime || recipe.recipe_yield) && (
            <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3 text-sm text-muted-foreground">
              {totalTime && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary/60" />
                  <span>{totalTime}</span>
                </div>
              )}
              {recipe.recipe_yield && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-primary/60" />
                  <span>
                    {recipe.recipe_yield}{" "}
                    {recipe.recipe_yield_name || "portioner"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
