import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useLocation, useRouter, useSearch } from '@tanstack/react-router'
import { buildSearchUrl } from '@/lib/utils'

interface UseRecipeFiltersReturn {
  // URL-derived state
  activeCategories: string[]

  // Pantry filter state
  isFilterActive: boolean
  minMatchPercentage: number

  // Handlers
  handleFilterToggle: (active: boolean) => void
  handleMinMatchChange: (value: number) => void
}

export function useRecipeFilters(): UseRecipeFiltersReturn {
  const router = useRouter()
  const { pathname } = useLocation()
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined> & { categories?: string; pantry?: string; minMatch?: string }

  // Parse active categories from URL (comma-separated)
  const activeCategories = useMemo(() => {
    return searchParams.categories?.split(',').filter(Boolean) ?? []
  }, [searchParams.categories])

  // Parse pantry filter state from URL
  const urlPantryActive = searchParams.pantry === 'true'
  const urlMinMatch = parseInt(searchParams.minMatch ?? '50', 10)

  // Ingredient filter state (initialized from URL)
  const [isFilterActive, setIsFilterActive] = useState(urlPantryActive)
  const [minMatchPercentage, setMinMatchPercentage] = useState(
    urlMinMatch >= 50 && urlMinMatch <= 100 ? urlMinMatch : 50
  )

  // Debounce ref for slider
  const sliderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Helper to update URL params without adding a history entry
  const updateUrlParams = useCallback(
    (updates: { pantry?: boolean; minMatch?: number }) => {
      const newSearch = { ...searchParams }

      if (updates.pantry !== undefined) {
        if (updates.pantry) {
          newSearch.pantry = 'true'
        } else {
          delete newSearch.pantry
          delete newSearch.minMatch
        }
      }

      if (updates.minMatch !== undefined && updates.pantry !== false) {
        if (updates.minMatch !== 50) {
          newSearch.minMatch = String(updates.minMatch)
        } else {
          delete newSearch.minMatch
        }
      }

      router.history.replace(buildSearchUrl(pathname, newSearch))
    },
    [searchParams, pathname, router]
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

  return {
    activeCategories,
    isFilterActive,
    minMatchPercentage,
    handleFilterToggle,
    handleMinMatchChange,
  }
}
