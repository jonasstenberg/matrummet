'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Loader2, Search, X } from '@/lib/icons'
import { cn, getImageUrl } from '@/lib/utils'
import type { MealPlanEntry } from '@/lib/meal-plan/types'

interface RecipeSearchResult {
  id: string
  name: string
  image: string | null
  categories: string[]
  prep_time: number | null
  cook_time: number | null
}

// Categories to deprioritize per meal type (sorted to bottom of list)
const DEPRIORITIZE_FOR_MEAL: Record<string, string[]> = {
  middag: [
    'Frukost', 'Mellanmål', 'Fika', 'Brunch', 'Efterrätt',
    'Bakverk', 'Bröd', 'Dryck', 'Smoothie', 'Sås & tillbehör',
  ],
  lunch: [
    'Frukost', 'Mellanmål', 'Fika', 'Efterrätt',
    'Bakverk', 'Bröd', 'Dryck', 'Smoothie',
  ],
  frukost: [
    'Middag', 'Huvudrätt', 'Förrätt', 'Grillat',
  ],
  mellanmal: [
    'Middag', 'Huvudrätt', 'Förrätt', 'Frukost', 'Lunch', 'Grillat',
  ],
}

function sortByMealRelevance(
  recipes: RecipeSearchResult[],
  mealType: string | undefined,
): RecipeSearchResult[] {
  if (!mealType) return recipes
  const deprioritized = DEPRIORITIZE_FOR_MEAL[mealType]
  if (!deprioritized) return recipes

  const depSet = new Set(deprioritized.map((c) => c.toLowerCase()))

  return [...recipes].sort((a, b) => {
    const aIrrelevant = a.categories.some((c) => depSet.has(c.toLowerCase()))
    const bIrrelevant = b.categories.some((c) => depSet.has(c.toLowerCase()))
    if (aIrrelevant === bIrrelevant) return 0
    return aIrrelevant ? 1 : -1
  })
}

interface MealPlanSwapSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwap: (
    recipeId: string | null,
    recipeName: string | null,
    recipeDescription: string | null,
  ) => void
  currentEntry: MealPlanEntry | null
  homeId?: string
}

export function MealPlanSwapSheet({
  open,
  onOpenChange,
  onSwap,
  currentEntry,
  homeId,
}: MealPlanSwapSheetProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RecipeSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const initialFetchDoneRef = useRef(false)

  const fetchRecipes = useCallback(async (searchQuery: string) => {
    // Cancel any in-flight request so stale responses are discarded
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim())
      }
      if (homeId) {
        params.set('home_id', homeId)
      }

      const response = await fetch(`/api/recipes/search?${params}`, {
        signal: controller.signal,
      })
      if (response.ok) {
        const data = await response.json()
        setResults(data)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      // Ignore other errors
    } finally {
      // Only clear loading if this request wasn't aborted
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [homeId])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      abortControllerRef.current?.abort()
      initialFetchDoneRef.current = false
      return
    }

    // Load recent recipes on open
    initialFetchDoneRef.current = true
    fetchRecipes('')
  }, [open, fetchRecipes])

  useEffect(() => {
    if (!open) return
    // Skip debounced fetch if the initial open fetch already covers this
    if (query === '' && initialFetchDoneRef.current) {
      initialFetchDoneRef.current = false
      return
    }
    const timer = setTimeout(() => {
      fetchRecipes(query)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, open, fetchRecipes])

  const sortedResults = sortByMealRelevance(results, currentEntry?.meal_type)

  const totalTime = (recipe: RecipeSearchResult) => {
    const prep = recipe.prep_time || 0
    const cook = recipe.cook_time || 0
    return prep + cook
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl px-0 pb-6">
        {/* Drag indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-9 h-1 rounded-full bg-muted" />
        </div>

        <div className="px-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-center">
              Byt recept
              {currentEntry && (
                <span className="block mt-1 font-normal text-sm text-muted-foreground">
                  {currentEntry.recipe_name || currentEntry.suggested_name}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Apple-style search field */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Sök bland dina recept..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full bg-muted/40 pl-10 pr-10 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-muted/60 transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground/60" />
              </button>
            )}
          </div>
        </div>

        {/* Recipe list with refined styling */}
        <div className="max-h-[50vh] overflow-y-auto px-6 -mx-6">
          <div className="px-6">
            {loading && sortedResults.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sortedResults.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">
                {query ? 'Inga recept hittades' : 'Inga recept'}
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {sortedResults.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onSwap(recipe.id, recipe.name, null)}
                    className={cn(
                      'flex w-full items-center gap-3.5 py-3.5 text-left transition-all',
                      'hover:bg-muted/30 hover:rounded-xl hover:-mx-3 hover:px-3',
                    )}
                  >
                    {recipe.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getImageUrl(recipe.image, 'thumb')!}
                        alt=""
                        className="h-11 w-11 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-xl bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{recipe.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {recipe.categories.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {recipe.categories.join(', ')}
                          </p>
                        )}
                        {totalTime(recipe) > 0 && (
                          <>
                            {recipe.categories.length > 0 && (
                              <span className="text-xs text-muted-foreground/50">•</span>
                            )}
                            <p className="text-xs text-muted-foreground shrink-0">
                              {totalTime(recipe)} min
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
