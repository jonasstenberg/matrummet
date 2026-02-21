import { RecipeCard } from "@/components/recipe-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "@/lib/icons";
import type { Recipe } from "@/lib/types";

interface RecipeGridProps {
  recipes: Recipe[];
  showPantryMatch?: boolean;
  showAuthor?: boolean;
  onAuthorClick?: (authorId: string) => void;
  emptyMessage?: string;
  emptyDescription?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
}

export function RecipeGrid({
  recipes,
  showPantryMatch,
  showAuthor,
  onAuthorClick,
  emptyMessage = "Inga recept hittades",
  emptyDescription = "Prova att justera dina filter eller sök efter något annat.",
  onLoadMore,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
}: RecipeGridProps) {
  if (recipes.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">
            {emptyMessage}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
        {recipes.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            showPantryMatch={showPantryMatch}
            showAuthor={showAuthor}
            onAuthorClick={onAuthorClick}
          />
        ))}
      </div>

      {onLoadMore && totalCount !== undefined && loadedCount !== undefined && (
        <div className="flex flex-col items-center gap-3 pt-4">
          <p className="text-sm text-muted-foreground">
            Visar {loadedCount} av {totalCount} recept
          </p>
          {hasMore && (
            <Button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="min-w-[200px]"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Laddar...
                </>
              ) : (
                "Ladda fler recept"
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
