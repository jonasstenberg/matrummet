
import type { Recipe } from "@/lib/types";
import { Calendar, ChefHat, Clock, Copy, Users } from "@/lib/icons";
import { Link } from "@tanstack/react-router";
import { PlaceholderImage } from "./placeholder-image";
import { formatDate } from "./utils";

interface RecipeHeroProps {
  recipe: Recipe;
  actionButton?: React.ReactNode;
  imageUrl: string | null;
  imageSrcSet: string | null;
  totalTime: string | null;
}

export function RecipeHero({
  recipe,
  actionButton,
  imageUrl,
  imageSrcSet,
  totalTime,
}: RecipeHeroProps) {
  const hasImage = !!imageUrl;
  const hasDescription = recipe.description && recipe.description !== "-";
  const infoItems = [totalTime, recipe.recipe_yield].filter(Boolean);

  return (
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

        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {recipe.name}
        </h1>

        {hasDescription && (
          <p className="text-lg leading-relaxed text-muted-foreground">
            {recipe.description}
          </p>
        )}

        {/* Meta Information */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {(recipe.author || recipe.owner_name) && (
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary/60" />
              {recipe.owner_id && !recipe.is_owner ? (
                <Link
                  to="/sok"
                  search={{ q: recipe.owner_name || recipe.author || '' }}
                  className="hover:text-primary transition-colors"
                >
                  {recipe.author || recipe.owner_name}
                </Link>
              ) : (
                <span>{recipe.author || recipe.owner_name}</span>
              )}
            </div>
          )}

          {recipe.date_published && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary/60" />
              <span>{formatDate(recipe.date_published)}</span>
            </div>
          )}
        </div>

        {/* Attribution for copied recipes */}
        {recipe.copied_from_author_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Copy className="h-4 w-4 text-primary/60" />
            <span>Kopierat från {recipe.copied_from_author_name}</span>
          </div>
        )}

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
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-(--shadow-card-hover)">
          {hasImage && imageUrl ? (
            <img
              src={imageUrl}
              srcSet={imageSrcSet ?? undefined}
              sizes="(max-width: 768px) 100vw, 50vw"
              alt={recipe.name}
              loading="eager"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <PlaceholderImage />
          )}
          {/* Action button overlay */}
          {actionButton && (
            <div className="absolute right-3 top-3">{actionButton}</div>
          )}
        </div>
      </div>
    </div>
  );
}
