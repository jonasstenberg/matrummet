'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn, getImageUrl, getImageSrcSet } from '@/lib/utils'
import type { RecipeMatch, SelectedIngredient } from '@/lib/ingredient-search-types'
import { SubstitutionDialog } from './substitution-dialog'
import Link from 'next/link'

interface SearchResultsProps {
  results: RecipeMatch[]
  isLoading: boolean
  hasSearched: boolean
  selectedIngredients: SelectedIngredient[]
  minMatchPercentage: number
  onMinMatchChange: (value: number) => void
  onlyOwnRecipes: boolean
  onOnlyOwnChange: (value: boolean) => void
}

export function SearchResults({
  results,
  isLoading,
  hasSearched,
  selectedIngredients,
  minMatchPercentage,
  onMinMatchChange,
  onlyOwnRecipes,
  onOnlyOwnChange,
}: SearchResultsProps) {
  if (!hasSearched && selectedIngredients.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Börja med att välja ingredienser</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sök efter ingredienser du har hemma för att hitta matchande recept
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <Label htmlFor="match-slider" className="text-sm font-medium">
            Minsta matchning: {minMatchPercentage}%
          </Label>
          <Slider
            id="match-slider"
            value={[minMatchPercentage]}
            onValueChange={([value]) => onMinMatchChange(value)}
            min={50}
            max={100}
            step={5}
            className="w-full max-w-xs"
            aria-label="Minsta matchningsprocent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="only-own"
            checked={onlyOwnRecipes}
            onCheckedChange={(checked) => onOnlyOwnChange(checked === true)}
          />
          <Label htmlFor="only-own" className="text-sm cursor-pointer">
            Endast mina recept
          </Label>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Results */}
      {!isLoading && hasSearched && (
        <>
          <p className="text-sm text-muted-foreground">
            {results.length === 0 && 'Inga matchande recept hittades'}
            {results.length === 1 && '1 recept matchar'}
            {results.length > 1 && `${results.length} recept matchar`}
          </p>

          {results.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
              {results.map((recipe) => (
                <RecipeMatchCard
                  key={recipe.recipe_id}
                  recipe={recipe}
                  availableIngredients={selectedIngredients}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface RecipeMatchCardProps {
  recipe: RecipeMatch
  availableIngredients: SelectedIngredient[]
}

function RecipeMatchCard({ recipe, availableIngredients }: RecipeMatchCardProps) {
  const [showMissing, setShowMissing] = useState(false)
  const [showSubstitutions, setShowSubstitutions] = useState(false)

  const imageUrl = getImageUrl(recipe.image, 'medium')
  const imageSrcSet = getImageSrcSet(recipe.image)
  const hasImage = !!imageUrl

  const matchColor = getMatchColor(recipe.match_percentage)
  const missingCount = recipe.total_ingredients - recipe.matching_ingredients

  return (
    <>
      <article
        className={cn(
          'group relative overflow-hidden rounded-2xl bg-card',
          'shadow-[0_2px_8px_-2px_rgba(139,90,60,0.08),0_4px_16px_-4px_rgba(139,90,60,0.12)]',
          'transition-all duration-300 ease-out',
          'hover:shadow-[0_8px_24px_-4px_rgba(139,90,60,0.15),0_12px_32px_-8px_rgba(139,90,60,0.2)]'
        )}
      >
        <Link href={`/recept/${recipe.recipe_id}`} className="block">
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
              <div className="absolute inset-0 bg-linear-to-br from-muted via-muted/80 to-muted/60" />
            )}

            {/* Match percentage overlay */}
            <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
              <span className={cn('text-sm font-semibold', matchColor)}>
                {recipe.match_percentage}%
              </span>
            </div>

            {recipe.categories && recipe.categories.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
                {recipe.categories.slice(0, 2).map((category) => (
                  <span
                    key={category}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm',
                      hasImage
                        ? 'bg-white/90 text-foreground/80'
                        : 'bg-card/80 text-foreground/70'
                    )}
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
              {recipe.name}
            </h2>

            {/* Match progress bar */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {recipe.matching_ingredients}/{recipe.total_ingredients} ingredienser
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', matchColor.replace('text-', 'bg-'))}
                  style={{ width: `${recipe.match_percentage}%` }}
                />
              </div>
            </div>
          </div>
        </Link>

        {/* Missing ingredients section */}
        {missingCount > 0 && (
          <div className="border-t px-4 pb-4">
            <button
              type="button"
              onClick={() => setShowMissing(!showMissing)}
              className="flex w-full items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <span>Saknas {missingCount} ingrediens{missingCount > 1 ? 'er' : ''}</span>
              {showMissing ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showMissing && (
              <div className="space-y-2">
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {recipe.missing_food_names.map((name, index) => (
                    <li key={recipe.missing_food_ids[index]} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                      {name}
                    </li>
                  ))}
                </ul>

                {missingCount <= 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSubstitutions(true)}
                    className="mt-2 w-full"
                  >
                    Föreslå ersättningar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </article>

      {showSubstitutions && (
        <SubstitutionDialog
          open={showSubstitutions}
          onOpenChange={setShowSubstitutions}
          recipeId={recipe.recipe_id}
          recipeName={recipe.name}
          missingFoodIds={recipe.missing_food_ids}
          missingFoodNames={recipe.missing_food_names}
          availableFoodIds={availableIngredients.map((i) => i.id)}
        />
      )}
    </>
  )
}

function getMatchColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-600'
  if (percentage >= 60) return 'text-yellow-600'
  return 'text-orange-600'
}
