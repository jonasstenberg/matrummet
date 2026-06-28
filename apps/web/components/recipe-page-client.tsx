import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { RecipeGrid } from '@/components/recipe-grid'
import { CollectionsShelf } from '@/components/collections-shelf'
import { RecipeFilters } from '@/components/recipe-filters'
import type { Recipe, CategoryGroup, Collection } from '@/lib/types'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { loadMoreRecipes } from '@/lib/recipe-actions'
import { useRecipeBrowser } from '@/lib/hooks/use-recipe-browser'

interface RecipePageClientProps {
  initialRecipes: Recipe[]
  initialPantry: PantryItem[]
  groupedCategories: CategoryGroup[]
  members: Array<{ id: string; name: string; isCurrentUser: boolean; type?: 'household' | 'shared-book' }>
  selectedMemberIds: string[]
  isAuthenticated: boolean
  collections?: Collection[]
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
  collections = [],
  totalCount = 0,
  pageSize = PAGE_SIZE,
}: RecipePageClientProps) {
  const navigate = useNavigate()
  const hasPantry = initialPantry.length > 0
  const showAuthor = selectedMemberIds.length > 1

  const browser = useRecipeBrowser({
    initialRecipes,
    totalCount,
    pageSize,
    hasPantry,
    loadMore: (off, limit) =>
      loadMoreRecipes({
        offset: off,
        limit,
        ownerIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      }),
    // Persist offset in URL so back-navigation restores pagination. offset is
    // not in loaderDeps, so this won't re-run the loader or reset the scroll.
    onOffsetChange: (newOffset) =>
      navigate({
        to: '/',
        search: (prev) => ({
          offset: newOffset,
          members: prev.members ?? undefined,
        }),
        replace: true,
        resetScroll: false,
      }),
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Recept
        </h1>
      </header>

      {/* Collections shelf — navigates to collections; a distinct section,
          visually separate from the owner-filter pills below. */}
      {collections.length > 0 && <CollectionsShelf collections={collections} />}

      <RecipeFilters
        members={members}
        selectedMemberIds={selectedMemberIds}
        groupedCategories={groupedCategories}
        pantryItems={initialPantry}
        isAuthenticated={isAuthenticated}
        isFilterActive={browser.isFilterActive}
        minMatchPercentage={browser.minMatchPercentage}
        onFilterToggle={browser.handleFilterToggle}
        onMinMatchChange={browser.handleMinMatchChange}
        resultsSummary={browser.resultsSummary}
      />

      {/* Recipe Grid — dims while a filter refetch is in flight; the surrounding
          shell (header, filters) stays mounted. */}
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
          showAuthor={showAuthor}
          emptyMessage={
            browser.isFilterActive ? 'Inga matchande recept hittades' : 'Inga recept hittades'
          }
          emptyDescription={
            browser.isFilterActive
              ? 'Prova att sänka matchningsprocenten eller lägg till fler ingredienser i ditt skafferi.'
              : 'Prova att justera dina filter eller sök efter något annat.'
          }
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
