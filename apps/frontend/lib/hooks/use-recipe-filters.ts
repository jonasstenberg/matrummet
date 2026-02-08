import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import type { Recipe } from '@/lib/types'

export const VIEW_TYPES = ['mine', 'all', 'liked'] as const
export type ViewType = (typeof VIEW_TYPES)[number]

interface UseRecipeFiltersOptions {
  initialRecipes: Recipe[]
}

interface UseRecipeFiltersReturn {
  // URL-derived state
  activeCategories: string[]
  authorFilter: string | null
  authorName: string | null

  // Pantry filter state
  isFilterActive: boolean
  minMatchPercentage: number

  // Handlers
  handleFilterToggle: (active: boolean) => void
  handleMinMatchChange: (value: number) => void
  handleAuthorClick: (authorId: string) => void
  clearAuthorFilter: () => void
}

export function useRecipeFilters({
  initialRecipes,
}: UseRecipeFiltersOptions): UseRecipeFiltersReturn {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  // Parse active categories from URL (comma-separated)
  const activeCategories = useMemo(() => {
    return searchParams.get('categories')?.split(',').filter(Boolean) ?? []
  }, [searchParams])

  // Parse author filter from URL
  const authorFilter = searchParams.get('author')

  // Get author name for display (from any recipe with that owner_id)
  const authorName = useMemo(() => {
    if (!authorFilter) return null
    const recipe = initialRecipes.find((r) => r.owner_id === authorFilter)
    return recipe?.owner_name ?? null
  }, [authorFilter, initialRecipes])

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

  // Handle author filter click
  const handleAuthorClick = useCallback(
    (authorId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (params.get('author') === authorId) {
        params.delete('author') // Toggle off if same author
      } else {
        params.set('author', authorId)
      }
      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      })
    },
    [searchParams, router, pathname]
  )

  // Clear author filter
  const clearAuthorFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('author')
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }, [searchParams, router, pathname])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current) {
        clearTimeout(sliderDebounceRef.current)
      }
    }
  }, [])

  return {
    activeCategories,
    authorFilter,
    authorName,
    isFilterActive,
    minMatchPercentage,
    handleFilterToggle,
    handleMinMatchChange,
    handleAuthorClick,
    clearAuthorFilter,
  }
}
