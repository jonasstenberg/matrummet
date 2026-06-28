import { useNavigate } from '@tanstack/react-router'
import { MemberFilter } from '@/components/member-filter'
import { RecipeGrid } from '@/components/recipe-grid'
import type { Recipe } from '@/lib/types'
import { loadMoreSearchRecipes } from '@/lib/recipe-actions'
import { useRecipePagination } from '@/lib/hooks/use-recipe-pagination'

interface SearchResultsClientProps {
  query: string
  initialRecipes: Recipe[]
  totalCount: number
  members: Array<{ id: string; name: string; isCurrentUser: boolean; type?: 'household' | 'shared-book' }>
  selectedMemberIds: string[]
  pageSize: number
}

export function SearchResultsClient({
  query,
  initialRecipes,
  totalCount,
  members,
  selectedMemberIds,
  pageSize,
}: SearchResultsClientProps) {
  const navigate = useNavigate()
  const ownerIds = selectedMemberIds.length > 0 ? selectedMemberIds : undefined

  const { recipes, offset, hasMore, isLoadingMore, handleLoadMore } =
    useRecipePagination({
      initialRecipes,
      totalCount,
      pageSize,
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
    <div className="space-y-8">
      {members.length > 1 && (
        <MemberFilter members={members} selectedIds={selectedMemberIds} />
      )}

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

      <RecipeGrid
        recipes={recipes}
        showAuthor={selectedMemberIds.length > 1}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        totalCount={totalCount}
        loadedCount={offset}
      />
    </div>
  )
}
