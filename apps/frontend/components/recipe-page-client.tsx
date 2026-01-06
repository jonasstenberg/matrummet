'use client'

import { useState, useCallback, useRef, useEffect, useMemo, startTransition } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { HomeHeader } from '@/components/home-header'
import { RecipeViewToggle } from '@/components/recipe-view-toggle'
import { RecipeGrid } from '@/components/recipe-grid'
import { CategoryFilter } from '@/components/category-filter'
import { IngredientFilterToggle } from '@/components/ingredient-filter-toggle'
import type { RecipeMatchData } from '@/components/recipe-card'
import type { Recipe } from '@/lib/types'
import type { PantryItem, RecipeMatch } from '@/lib/ingredient-search-types'
import { findRecipesByIngredients } from '@/lib/ingredient-search-actions'

interface RecipePageClientProps {
  initialRecipes: Recipe[]
  initialPantry: PantryItem[]
  categories: string[]
  activeView?: 'mine' | 'all' | 'liked'
  isAuthenticated: boolean
}

// Convert RecipeMatch to Recipe format
function recipeMatchToRecipe(match: RecipeMatch): Recipe {
  return {
    id: match.recipe_id,
    name: match.name,
    author: null,
    description: match.description ?? '',
    url: null,
    recipe_yield: match.recipe_yield,
    recipe_yield_name: match.recipe_yield_name,
    prep_time: match.prep_time,
    cook_time: match.cook_time,
    cuisine: null,
    image: match.image,
    thumbnail: null,
    owner: match.owner,
    date_published: null,
    date_modified: null,
    categories: match.categories ?? [],
    ingredient_groups: [],
    ingredients: [],
    instruction_groups: [],
    instructions: [],
  }
}

export function RecipePageClient({
  initialRecipes,
  initialPantry,
  categories,
  activeView = 'mine',
  isAuthenticated,
}: RecipePageClientProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Parse active categories from URL (comma-separated)
  const activeCategories = useMemo(() => {
    return searchParams.get('categories')?.split(',').filter(Boolean) ?? []
  }, [searchParams])

  // Parse pantry filter state from URL
  const urlPantryActive = searchParams.get('pantry') === 'true'
  const urlMinMatch = parseInt(searchParams.get('minMatch') ?? '50', 10)

  // Ingredient filter state (initialized from URL)
  const [isFilterActive, setIsFilterActive] = useState(urlPantryActive)
  const [minMatchPercentage, setMinMatchPercentage] = useState(
    urlMinMatch >= 50 && urlMinMatch <= 100 ? urlMinMatch : 50
  )

  // Search results state
  const [matchResults, setMatchResults] = useState<RecipeMatch[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Track if initial search has been performed
  const initialSearchDone = useRef(false)

  // Debounce ref for slider
  const sliderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Helper to update URL params without triggering re-render
  const updateUrlParams = useCallback(
    (updates: { pantry?: boolean; minMatch?: number }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.pantry !== undefined) {
        if (updates.pantry) {
          params.set('pantry', 'true')
        } else {
          params.delete('pantry')
          params.delete('minMatch')
        }
      }

      if (updates.minMatch !== undefined && updates.pantry !== false) {
        if (updates.minMatch !== 50) {
          params.set('minMatch', String(updates.minMatch))
        } else {
          params.delete('minMatch')
        }
      }

      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname

      // Use History API to update URL without triggering Next.js navigation/re-render
      startTransition(() => {
        window.history.replaceState(null, '', newUrl)
      })
    },
    [searchParams, pathname]
  )

  // Perform ingredient search using all pantry items
  const performSearch = useCallback(
    async (options?: { minMatch?: number }) => {
      const foodIds = initialPantry.map((item) => item.food_id)
      if (foodIds.length === 0) {
        setMatchResults([])
        return
      }

      setIsSearching(true)

      try {
        const response = await findRecipesByIngredients(foodIds, {
          minMatchPercentage: options?.minMatch ?? minMatchPercentage,
          onlyOwnRecipes: activeView === 'mine',
          limit: 50,
        })

        if ('error' in response) {
          console.error('Search error:', response.error)
          setMatchResults([])
        } else {
          // Filter by categories if any are active (OR logic)
          let filtered = response
          if (activeCategories.length > 0) {
            const categorySet = new Set(activeCategories.map((c) => c.toLowerCase()))
            filtered = response.filter((r) =>
              r.categories?.some((c) => categorySet.has(c.toLowerCase()))
            )
          }
          setMatchResults(filtered)
        }
      } catch (err) {
        console.error('Search error:', err)
        setMatchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [initialPantry, minMatchPercentage, activeView, activeCategories]
  )

  // Handle filter toggle
  const handleFilterToggle = useCallback(
    (active: boolean) => {
      setIsFilterActive(active)
      updateUrlParams({ pantry: active, minMatch: minMatchPercentage })
      if (active) {
        performSearch()
      }
    },
    [performSearch, updateUrlParams, minMatchPercentage]
  )

  // Handle min match percentage change with debounce
  const handleMinMatchChange = useCallback(
    (value: number) => {
      setMinMatchPercentage(value)

      if (sliderDebounceRef.current) {
        clearTimeout(sliderDebounceRef.current)
      }

      sliderDebounceRef.current = setTimeout(() => {
        updateUrlParams({ minMatch: value })
        if (isFilterActive) {
          performSearch({ minMatch: value })
        }
      }, 300)
    },
    [isFilterActive, performSearch, updateUrlParams]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current) {
        clearTimeout(sliderDebounceRef.current)
      }
    }
  }, [])

  // Perform initial search if pantry filter is active from URL
  useEffect(() => {
    if (urlPantryActive && !initialSearchDone.current && initialPantry.length > 0) {
      initialSearchDone.current = true
      performSearch({ minMatch: urlMinMatch })
    }
  }, [urlPantryActive, urlMinMatch, performSearch, initialPantry.length])

  // Re-search when categories or view changes (if filter is active)
  useEffect(() => {
    if (isFilterActive && initialSearchDone.current) {
      performSearch()
    }
  }, [activeCategories, activeView]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prepare recipes and match data for display
  const displayRecipes = useMemo(() => {
    if (isFilterActive) {
      return matchResults.map(recipeMatchToRecipe)
    }
    // Filter initial recipes by categories if needed (OR logic)
    if (activeCategories.length > 0) {
      const categorySet = new Set(activeCategories.map((c) => c.toLowerCase()))
      return initialRecipes.filter((r) =>
        r.categories?.some((c) => categorySet.has(c.toLowerCase()))
      )
    }
    return initialRecipes
  }, [isFilterActive, matchResults, initialRecipes, activeCategories])

  // Prepare match data map for recipe cards
  const matchDataMap = useMemo(() => {
    if (!isFilterActive) {
      return undefined
    }
    const map = new Map<string, RecipeMatchData>()
    for (const match of matchResults) {
      map.set(match.recipe_id, {
        percentage: match.match_percentage,
        matchingIngredients: match.matching_ingredients,
        totalIngredients: match.total_ingredients,
        missingFoodNames: match.missing_food_names,
      })
    }
    return map
  }, [isFilterActive, matchResults])

  // Results summary text
  const resultsSummary = useMemo(() => {
    if (!isFilterActive) {
      return null
    }
    if (matchResults.length === 0) {
      return 'Inga matchande recept hittades'
    }
    if (matchResults.length === 1) {
      return '1 recept matchar ditt skafferi'
    }
    return `${matchResults.length} recept matchar ditt skafferi`
  }, [isFilterActive, matchResults.length])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <HomeHeader />

      {/* View Toggle Tabs */}
      <RecipeViewToggle activeView={activeView} />

      {/* Category Filter */}
      <CategoryFilter categories={categories} />

      {/* Ingredient Filter (only for authenticated users) */}
      {isAuthenticated && (
        <IngredientFilterToggle
          pantryItems={initialPantry}
          isFilterActive={isFilterActive}
          minMatchPercentage={minMatchPercentage}
          isLoading={isSearching}
          onFilterToggle={handleFilterToggle}
          onMinMatchChange={handleMinMatchChange}
        />
      )}

      {/* Results summary */}
      {resultsSummary && (
        <p className="text-sm text-muted-foreground">{resultsSummary}</p>
      )}

      {/* Loading state */}
      {isSearching && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Recipe Grid */}
      {!isSearching && (
        <RecipeGrid
          recipes={displayRecipes}
          matchDataMap={matchDataMap}
          emptyMessage={
            isFilterActive
              ? 'Inga matchande recept hittades'
              : 'Inga recept hittades'
          }
          emptyDescription={
            isFilterActive
              ? 'Prova att sänka matchningsprocenten eller lägg till fler ingredienser i ditt skafferi.'
              : 'Prova att justera dina filter eller sök efter något annat.'
          }
        />
      )}
    </div>
  )
}
