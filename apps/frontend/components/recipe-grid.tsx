import { RecipeCard } from '@/components/recipe-card'
import type { Recipe } from '@/lib/types'

interface RecipeGridProps {
  recipes: Recipe[]
  showPantryMatch?: boolean
  emptyMessage?: string
  emptyDescription?: string
}

export function RecipeGrid({
  recipes,
  showPantryMatch,
  emptyMessage = 'Inga recept hittades',
  emptyDescription = 'Prova att justera dina filter eller sök efter något annat.',
}: RecipeGridProps) {
  if (recipes.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">{emptyMessage}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          showPantryMatch={showPantryMatch}
        />
      ))}
    </div>
  )
}
