'use client'

import { useState, useCallback, useMemo, useEffect, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { HomeHeader } from '@/components/home-header'
import { RecipeViewToggle } from '@/components/recipe-view-toggle'
import { RecipeGrid } from '@/components/recipe-grid'
import { CategoryFilter } from '@/components/category-filter'
import { IngredientFilterToggle } from '@/components/ingredient-filter-toggle'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import type { Recipe, CategoryGroup } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { loadMoreRecipes } from '@/lib/recipe-actions'
import { useRecipeFilters } from '@/lib/hooks/use-recipe-filters'

interface RecipePageClientProps {
  initialRecipes: Recipe[]
  initialPantry: PantryItem[]
  groupedCategories: CategoryGroup[]
  activeView?: 'mine' | 'all' | 'liked'
  isAuthenticated: boolean
  totalCount?: number
  pageSize?: number
}

const PAGE_SIZE = 24

export function RecipePageClient({
  initialRecipes,
  initialPantry,
  groupedCategories,
  activeView = 'mine',
  isAuthenticated,
  totalCount = 0,
  pageSize = PAGE_SIZE,
}: RecipePageClientProps) {
  // Use the extracted filter hook
  const {
    activeCategories,
    authorFilter,
    authorName,
    isFilterActive,
    minMatchPercentage,
    handleFilterToggle,
    handleMinMatchChange,
    handleAuthorClick,
    clearAuthorFilter,
  } = useRecipeFilters({ initialRecipes })

  const pathname = usePathname()

  // Pagination state
  const [allRecipes, setAllRecipes] = useState<Recipe[]>(initialRecipes)
  const [offset, setOffset] = useState(initialRecipes.length)
  const [isLoadingMore, startLoadingMore] = useTransition()
  const hasMore = totalCount > 0 && offset < totalCount

  const hasPantry = initialPantry.length > 0

  // Reset pagination when initialRecipes changes (e.g., page navigation)
  useEffect(() => {
    setAllRecipes(initialRecipes)
    setOffset(initialRecipes.length)
  }, [initialRecipes])

  // Handle load more
  const handleLoadMore = useCallback(() => {
    startLoadingMore(async () => {
      try {
        const newRecipes = await loadMoreRecipes({
          offset,
          limit: pageSize,
          view: activeView,
        })
        if (newRecipes.length > 0) {
          setAllRecipes((prev) => [...prev, ...newRecipes])
          const newOffset = offset + newRecipes.length
          setOffset(newOffset)

          // Persist offset in URL so back-navigation restores pagination
          const params = new URLSearchParams(window.location.search)
          params.set('offset', String(newOffset))
          window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
        }
      } catch (error) {
        console.error('Failed to load more recipes:', error)
      }
    })
  }, [offset, pageSize, activeView, pathname])

  // Prepare recipes for display
  const displayRecipes = useMemo(() => {
    let recipes: Recipe[]

    if (isFilterActive && hasPantry) {
      // When filter is active: filter recipes by min match percentage
      recipes = allRecipes.filter((recipe) => {
        const percentage = recipe.pantry_match_percentage ?? 0
        return percentage >= minMatchPercentage
      })
      // Sort by match percentage descending
      recipes.sort((a, b) => {
        return (b.pantry_match_percentage ?? 0) - (a.pantry_match_percentage ?? 0)
      })
    } else {
      // When filter is inactive: show all loaded recipes
      recipes = allRecipes
    }

    // Apply category filter (OR logic)
    if (activeCategories.length > 0) {
      const categorySet = new Set(activeCategories.map((c) => c.toLowerCase()))
      recipes = recipes.filter((r) =>
        r.categories?.some((c) => categorySet.has(c.toLowerCase()))
      )
    }

    // Apply author filter
    if (authorFilter) {
      recipes = recipes.filter((r) => r.owner_id === authorFilter)
    }

    return recipes
  }, [isFilterActive, hasPantry, minMatchPercentage, allRecipes, activeCategories, authorFilter])

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
      <HomeHeader activeView={activeView} />

      {/* View Toggle Tabs */}
      <RecipeViewToggle activeView={activeView} />

      {/* Category Filter */}
      <CategoryFilter groupedCategories={groupedCategories} />

      {/* Author Filter Badge */}
      {authorFilter && authorName && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrerar efter:</span>
          <Badge variant="secondary" className="gap-1 pr-1">
            {authorName}
            <button
              type="button"
              onClick={clearAuthorFilter}
              className="ml-1 rounded-full p-0.5 hover:bg-muted"
              aria-label="Ta bort författarfilter"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}

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
        showPantryMatch={hasPantry}
        showAuthor={activeView === 'all'}
        onAuthorClick={handleAuthorClick}
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
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        totalCount={totalCount}
        loadedCount={offset}
      />
    </div>
  )
}
