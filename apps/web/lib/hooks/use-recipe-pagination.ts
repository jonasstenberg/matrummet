import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from 'react'
import type { Recipe } from '@/lib/types'

interface UseRecipePaginationOptions {
  /** First page of recipes from the route loader. */
  initialRecipes: Recipe[]
  /** True total number of matches (drives "has more"). */
  totalCount: number
  /** How many to request per "load more". */
  pageSize: number
  /** Fetch the next page. Receives the current offset and the page size. */
  loadMore: (offset: number, limit: number) => Promise<Recipe[]>
  /** Optional: persist the new offset (e.g. to the URL) after a page loads. */
  onOffsetChange?: (offset: number) => void
}

interface UseRecipePaginationResult {
  recipes: Recipe[]
  setRecipes: Dispatch<SetStateAction<Recipe[]>>
  offset: number
  setOffset: Dispatch<SetStateAction<number>>
  hasMore: boolean
  isLoadingMore: boolean
  handleLoadMore: () => void
}

/**
 * Accumulating "load more" pagination for recipe grids.
 *
 * Owns the shared state machine used by the home, search, and collection pages:
 * the running list, the offset, the in-flight transition, and resetting when the
 * loader serves a new first page. Each caller supplies its own `loadMore` (the
 * data source differs) and, optionally, `onOffsetChange` (URL persistence).
 * `setRecipes` / `setOffset` are exposed for local mutations such as removing a
 * recipe from a collection without a refetch.
 */
export function useRecipePagination({
  initialRecipes,
  totalCount,
  pageSize,
  loadMore,
  onOffsetChange,
}: UseRecipePaginationOptions): UseRecipePaginationResult {
  const [recipes, setRecipes] = useState<Recipe[]>(initialRecipes)
  const [offset, setOffset] = useState(initialRecipes.length)
  const [isLoadingMore, startLoadingMore] = useTransition()
  const hasMore = totalCount > 0 && offset < totalCount

  // Reset when the loader serves a new first page (new query/filter, back-nav).
  useEffect(() => {
    setRecipes(initialRecipes)
    setOffset(initialRecipes.length)
  }, [initialRecipes])

  const handleLoadMore = useCallback(() => {
    startLoadingMore(async () => {
      try {
        const next = await loadMore(offset, pageSize)
        if (next.length > 0) {
          setRecipes((prev) => [...prev, ...next])
          const newOffset = offset + next.length
          setOffset(newOffset)
          onOffsetChange?.(newOffset)
        }
      } catch (error) {
        console.error('Failed to load more recipes:', error)
      }
    })
  }, [offset, pageSize, loadMore, onOffsetChange])

  return {
    recipes,
    setRecipes,
    offset,
    setOffset,
    hasMore,
    isLoadingMore,
    handleLoadMore,
  }
}
