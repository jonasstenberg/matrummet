import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { RecipeGrid } from '@/components/recipe-grid'
import { RecipeFilters } from '@/components/recipe-filters'
import type { Recipe, CategoryGroup } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { loadMoreSearchRecipes } from '@/lib/recipe-actions'
import { useRecipeBrowser } from '@/lib/hooks/use-recipe-browser'

interface SearchResultsClientProps {
  query: string
  initialRecipes: Recipe[]
  totalCount: number
  members: Array<{ id: string; name: string; isCurrentUser: boolean; type?: 'household' | 'shared-book' }>
  selectedMemberIds: string[]
  groupedCategories: CategoryGroup[]
  pantryItems: PantryItem[]
  pageSize: number
}

export function SearchResultsClient({
  query,
  initialRecipes,
  totalCount,
  members,
  selectedMemberIds,
  groupedCategories,
  pantryItems,
  pageSize,
}: SearchResultsClientProps) {
  const navigate = useNavigate()
  const ownerIds = selectedMemberIds.length > 0 ? selectedMemberIds : undefined
  const hasPantry = pantryItems.length > 0

  const browser = useRecipeBrowser({
    initialRecipes,
    totalCount,
    pageSize,
    hasPantry,
    loadMore: (off, limit) =>
      loadMoreSearchRecipes({ q: query, offset: off, limit, ownerIds }),
    // Persist offset in the URL so back-navigation restores pagination.
    onOffsetChange: (newOffset) =>
      navigate({
        to: '/sok',
        search: (prev) => ({
          q: prev.q,
          members: prev.members ?? undefined,
          offset: newOffset,
        }),
        replace: true,
        resetScroll: false,
      }),
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          Sökresultat för &quot;{query}&quot;
        </h1>
        <p className="text-lg text-muted-foreground">
          {totalCount === 0 && 'Inga recept hittades'}
          {totalCount === 1 && '1 recept hittades'}
          {totalCount > 1 && `${totalCount} recept hittades`}
        </p>
      </header>

      <RecipeFilters
        members={members}
        selectedMemberIds={selectedMemberIds}
        groupedCategories={groupedCategories}
        pantryItems={pantryItems}
        isAuthenticated={true}
        isFilterActive={browser.isFilterActive}
        minMatchPercentage={browser.minMatchPercentage}
        onFilterToggle={browser.handleFilterToggle}
        onMinMatchChange={browser.handleMinMatchChange}
        resultsSummary={browser.resultsSummary}
      />

      <div
        className={cn(
          'transition-opacity duration-200',
          browser.isNavigating && 'pointer-events-none opacity-50',
        )}
        aria-busy={browser.isNavigating}
      >
        <RecipeGrid
          recipes={browser.displayRecipes}
          showPantryMatch={hasPantry}
          showAuthor={selectedMemberIds.length > 1}
          onLoadMore={browser.handleLoadMore}
          hasMore={browser.hasMore}
          isLoadingMore={browser.isLoadingMore}
          totalCount={totalCount}
          loadedCount={browser.offset}
        />
      </div>
    </div>
  )
}
