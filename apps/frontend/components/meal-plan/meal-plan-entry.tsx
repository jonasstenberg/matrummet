'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RefreshCw, Sparkles, Clock } from '@/lib/icons'
import { getImageUrl } from '@/lib/utils'
import type { MealPlanEntry } from '@/lib/meal-plan/types'
import { MEAL_TYPES } from '@/lib/meal-plan/types'

interface MealPlanEntryCardProps {
  entry: MealPlanEntry
  onSwap: () => void
  onViewSuggestion?: () => void
}

export function MealPlanEntryCard({ entry, onSwap, onViewSuggestion }: MealPlanEntryCardProps) {
  const isExistingRecipe = !!entry.recipe_id
  const name = isExistingRecipe
    ? entry.recipe_name || 'Recept'
    : entry.suggested_name || 'Förslag'

  const totalTime =
    (entry.recipe_prep_time || 0) + (entry.recipe_cook_time || 0)

  const mealLabel = MEAL_TYPES.find((m) => m.id === entry.meal_type)?.label || entry.meal_type

  const thumbnail = isExistingRecipe && entry.recipe_image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getImageUrl(entry.recipe_image, 'thumb')!}
      alt=""
      className="h-20 w-20 rounded-xl object-cover shrink-0"
    />
  ) : (
    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-accent/15 shrink-0">
      <Sparkles className="h-6 w-6 text-warm/50" />
    </div>
  )

  const info = (
    <div className="flex items-center gap-3.5 flex-1 min-w-0 py-3.5 pr-1">
      {thumbnail}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {mealLabel}
        </p>
        <p className="text-[15px] font-semibold leading-snug truncate mt-0.5">{name}</p>
        {!isExistingRecipe && entry.suggested_description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {entry.suggested_description}
          </p>
        )}
        {isExistingRecipe && totalTime > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="h-3 w-3" />
            {totalTime} min
          </p>
        )}
      </div>
    </div>
  )

  const swapButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onSwap()
      }}
      className="shrink-0 h-8 w-8 p-0 rounded-full"
      aria-label="Byt recept"
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </Button>
  )

  const cardClass = "flex items-center gap-1 px-4 min-w-0"

  if (isExistingRecipe && entry.recipe_id) {
    return (
      <div className={cardClass}>
        <Link
          href={`/recept/${entry.recipe_id}`}
          className="flex items-center flex-1 min-w-0 transition-opacity hover:opacity-70"
        >
          {info}
        </Link>
        {swapButton}
      </div>
    )
  }

  if (entry.suggested_recipe && onViewSuggestion) {
    return (
      <div className={cardClass}>
        <button
          type="button"
          onClick={onViewSuggestion}
          className="flex items-center flex-1 min-w-0 text-left transition-opacity hover:opacity-70"
        >
          {info}
        </button>
        {swapButton}
      </div>
    )
  }

  return (
    <div className={cardClass}>
      {info}
      {swapButton}
    </div>
  )
}
