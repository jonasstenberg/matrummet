'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import { HomeHeader } from '@/components/home-header'
import { RecipeViewToggle } from '@/components/recipe-view-toggle'
import { RecipeGrid } from '@/components/recipe-grid'
import { CategoryFilter } from '@/components/category-filter'
import { IngredientFilterToggle } from '@/components/ingredient-filter-toggle'
import type { Recipe } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'

interface RecipePageClientProps {
  initialRecipes: Recipe[]
  initialPantry: PantryItem[]
  categories: string[]
  activeView?: 'mine' | 'all' | 'liked'
  isAuthenticated: boolean
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

  // Debounce ref for slider
  const sliderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  const hasPantry = initialPantry.length > 0

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
      window.history.replaceState(null, '', newUrl)
    },
    [searchParams, pathname]
  )

  // Handle filter toggle
  const handleFilterToggle = useCallback(
    (active: boolean) => {
      setIsFilterActive(active)
      updateUrlParams({ pantry: active, minMatch: minMatchPercentage })
    },
    [updateUrlParams, minMatchPercentage]
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
      }, 300)
    },
    [updateUrlParams]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current) {
        clearTimeout(sliderDebounceRef.current)
      }
    }
  }, [])

  // Prepare recipes for display
  const displayRecipes = useMemo(() => {
    let recipes: Recipe[]

    if (isFilterActive && hasPantry) {
      // When filter is active: filter recipes by min match percentage
      recipes = initialRecipes.filter((recipe) => {
        const percentage = recipe.pantry_match_percentage ?? 0
        return percentage >= minMatchPercentage
      })
      // Sort by match percentage descending
      recipes.sort((a, b) => {
        return (b.pantry_match_percentage ?? 0) - (a.pantry_match_percentage ?? 0)
      })
    } else {
      // When filter is inactive: show all initial recipes
      recipes = initialRecipes
    }

    // Apply category filter (OR logic)
    if (activeCategories.length > 0) {
      const categorySet = new Set(activeCategories.map((c) => c.toLowerCase()))
      recipes = recipes.filter((r) =>
        r.categories?.some((c) => categorySet.has(c.toLowerCase()))
      )
    }

    return recipes
  }, [isFilterActive, hasPantry, minMatchPercentage, initialRecipes, activeCategories])

  // Results summary text
  const resultsSummary = useMemo(() => {
    if (!isFilterActive) {
      return null
    }
    const count = displayRecipes.length
    if (count === 0) {
      return 'Inga matchande recept hittades'
    }
    if (count === 1) {
      return '1 recept matchar ditt skafferi'
    }
    return `${count} recept matchar ditt skafferi`
  }, [isFilterActive, displayRecipes.length])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <HomeHeader />

      {/* View Toggle Tabs */}
      <RecipeViewToggle activeView={activeView} />

      {/* Category Filter */}
      <CategoryFilter categories={categories} />

      {/* Ingredient Filter (only for authenticated users with pantry) */}
      {isAuthenticated && (
        <IngredientFilterToggle
          pantryItems={initialPantry}
          isFilterActive={isFilterActive}
          minMatchPercentage={minMatchPercentage}
          isLoading={false}
          onFilterToggle={handleFilterToggle}
          onMinMatchChange={handleMinMatchChange}
        />
      )}

      {/* Results summary */}
      {resultsSummary && (
        <p className="text-sm text-muted-foreground">{resultsSummary}</p>
      )}

      {/* Recipe Grid */}
      <RecipeGrid
        recipes={displayRecipes}
        showPantryMatch={isFilterActive && hasPantry}
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
    </div>
  )
}
