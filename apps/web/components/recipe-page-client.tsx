
import { useState, useCallback, useMemo, useEffect, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { MemberFilter } from '@/components/member-filter'
import { RecipeGrid } from '@/components/recipe-grid'
import { CategoryFilter } from '@/components/category-filter'
import { IngredientFilterToggle } from '@/components/ingredient-filter-toggle'
import type { Recipe, CategoryGroup } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { loadMoreRecipes } from '@/lib/recipe-actions'
import { useRecipeFilters } from '@/lib/hooks/use-recipe-filters'

interface RecipePageClientProps {
  initialRecipes: Recipe[]
  initialPantry: PantryItem[]
  groupedCategories: CategoryGroup[]
  members: Array<{ id: string; name: string; isCurrentUser: boolean; type?: 'household' | 'shared-book' }>
  selectedMemberIds: string[]
  isAuthenticated: boolean
  totalCount?: number
  pageSize?: number
}

const PAGE_SIZE = 24

export function RecipePageClient({
  initialRecipes,
  initialPantry,
  groupedCategories,
  members,
  selectedMemberIds,
  isAuthenticated,
  totalCount = 0,
  pageSize = PAGE_SIZE,
}: RecipePageClientProps) {
  const {
    activeCategories,
    isFilterActive,
    minMatchPercentage,
    handleFilterToggle,
    handleMinMatchChange,
  } = useRecipeFilters()

  const router = useRouter()

  // Pagination state
  const [allRecipes, setAllRecipes] = useState<Recipe[]>(initialRecipes)
  const [offset, setOffset] = useState(initialRecipes.length)
  const [isLoadingMore, startLoadingMore] = useTransition()
  const hasMore = totalCount > 0 && offset < totalCount

  const hasPantry = initialPantry.length > 0
  const showAuthor = selectedMemberIds.length > 1

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
          ownerIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
        })
        if (newRecipes.length > 0) {
          setAllRecipes((prev) => [...prev, ...newRecipes])
          const newOffset = offset + newRecipes.length
          setOffset(newOffset)

          // Persist offset in URL so back-navigation restores pagination
          router.navigate({
            to: '/',
            search: (prev: { offset?: string; members?: string }) => ({
              offset: String(newOffset),
              members: prev.members ?? undefined,
            }),
            replace: true,
          })
        }
      } catch (error) {
        console.error('Failed to load more recipes:', error)
      }
    })
  }, [offset, pageSize, selectedMemberIds, router])

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
      recipes = allRecipes
    }

    // Apply category filter (OR logic)
    if (activeCategories.length > 0) {
      const categorySet = new Set(activeCategories.map((c) => c.toLowerCase()))
      recipes = recipes.filter((r) =>
        r.categories?.some((c) => categorySet.has(c.toLowerCase()))
      )
    }

    return recipes
  }, [isFilterActive, hasPantry, minMatchPercentage, allRecipes, activeCategories])

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
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Recept
        </h1>
      </header>

      {/* Member Filter Badges (only useful with multiple members) */}
      {members.length > 1 && (
        <MemberFilter members={members} selectedIds={selectedMemberIds} />
      )}

      {/* Category Filter */}
      <CategoryFilter groupedCategories={groupedCategories} />

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
        showAuthor={showAuthor}
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
