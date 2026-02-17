import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'

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

  return {
    activeCategories,
    isFilterActive,
    minMatchPercentage,
    handleFilterToggle,
    handleMinMatchChange,
  }
}
