import { useMemo } from 'react'
import { useRouterState } from '@tanstack/react-router'
import type { Recipe } from '@/lib/types'
import { useRecipePagination } from '@/lib/hooks/use-recipe-pagination'
import { useRecipeFilters } from '@/lib/hooks/use-recipe-filters'
import { applyRecipeFilters, pantryMatchSummary } from '@/lib/recipe-filters'

interface UseRecipeBrowserOptions {
  initialRecipes: Recipe[]
  totalCount: number
  pageSize: number
  loadMore: (offset: number, limit: number) => Promise<Recipe[]>
  onOffsetChange?: (offset: number) => void
  /** Whether the user has pantry items (enables the pantry match filter). */
  hasPantry: boolean
}

/**
 * Everything the home, search, and collection recipe grids share: accumulating
 * pagination, the URL-driven category/pantry filters, the resulting client-side
 * filtered list, the pantry summary line, and the in-flight navigation flag (to
 * dim only the grid on refetch). Each page supplies its own data source via
 * `loadMore` and renders its own grid + header; the filter UI is rendered with
 * <RecipeFilters /> using the filter state returned here.
 */
export function useRecipeBrowser({
  initialRecipes,
  totalCount,
  pageSize,
  loadMore,
  onOffsetChange,
  hasPantry,
}: UseRecipeBrowserOptions) {
  const { recipes, setRecipes, offset, setOffset, hasMore, isLoadingMore, handleLoadMore } =
    useRecipePagination({ initialRecipes, totalCount, pageSize, loadMore, onOffsetChange })

  const { activeCategories, isFilterActive, minMatchPercentage, handleFilterToggle, handleMinMatchChange } =
    useRecipeFilters()

  const isNavigating = useRouterState({ select: (s) => s.isLoading })

  const displayRecipes = useMemo(
    () => applyRecipeFilters(recipes, { activeCategories, isFilterActive, minMatchPercentage, hasPantry }),
    [recipes, activeCategories, isFilterActive, minMatchPercentage, hasPantry],
  )

  const resultsSummary = pantryMatchSummary(isFilterActive, displayRecipes.length)

  return {
    // accumulated (unfiltered) list + setters — for local mutations e.g. removing
    // a recipe from a collection without a refetch
    allRecipes: recipes,
    setRecipes,
    offset,
    setOffset,
    // pagination
    hasMore,
    isLoadingMore,
    handleLoadMore,
    // filter state (pass through to <RecipeFilters />)
    isFilterActive,
    minMatchPercentage,
    handleFilterToggle,
    handleMinMatchChange,
    // derived
    displayRecipes,
    resultsSummary,
    isNavigating,
  }
}
