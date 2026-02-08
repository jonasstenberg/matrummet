'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { RecipeMatch, PantryItem } from '@/lib/ingredient-search-types'
import { findRecipesByIngredients, addToPantry, removeFromPantry } from '@/lib/ingredient-search-actions'
import { IngredientSearch } from './ingredient-search'
import { PantryTable } from './pantry-table'
import { SearchResults } from './search-results'

interface WhatCanIMakeProps {
  initialPantry?: PantryItem[]
}

export function WhatCanIMake({ initialPantry = [] }: WhatCanIMakeProps) {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(initialPantry)
  const [selectedFoodIds, setSelectedFoodIds] = useState<Set<string>>(
    () => new Set(initialPantry.map((item) => item.food_id))
  )
  const [results, setResults] = useState<RecipeMatch[]>([])
  const [isLoading, setIsLoading] = useState(initialPantry.length > 0)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minMatchPercentage, setMinMatchPercentage] = useState(50)
  const [onlyOwnRecipes, setOnlyOwnRecipes] = useState(false)
  const sliderDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Convert selected food IDs to ingredient format for search
  const selectedIngredients = useMemo(() => {
    return pantryItems
      .filter((item) => selectedFoodIds.has(item.food_id))
      .map((item) => ({ id: item.food_id, name: item.food_name }))
  }, [pantryItems, selectedFoodIds])

  const performSearch = useCallback(
    async (foodIds: string[], options?: { minMatch?: number; onlyOwn?: boolean }) => {
      if (foodIds.length === 0) {
        setResults([])
        setHasSearched(false)
        return
      }

      setIsLoading(true)
      setError(null)
      setHasSearched(true)

      try {
        const response = await findRecipesByIngredients(foodIds, {
          minMatchPercentage: options?.minMatch ?? minMatchPercentage,
          onlyOwnRecipes: options?.onlyOwn ?? onlyOwnRecipes,
          limit: 30,
        })

        if ('error' in response) {
          setError(response.error)
          setResults([])
        } else {
          setResults(response)
        }
      } catch (err) {
        console.error('Search error:', err)
        setError('Ett fel uppstod vid sökning')
        setResults([])
      } finally {
        setIsLoading(false)
      }
    },
    [minMatchPercentage, onlyOwnRecipes]
  )

  // Perform initial search if pantry has items
  const initialSearchDone = useRef(false)
  useEffect(() => {
    if (initialPantry.length > 0 && !initialSearchDone.current) {
      initialSearchDone.current = true
      const foodIds = initialPantry.map((item) => item.food_id)
      performSearch(foodIds)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger search when selection changes
  const handleSelectionChange = useCallback(
    (newSelectedIds: Set<string>) => {
      setSelectedFoodIds(newSelectedIds)
      performSearch(Array.from(newSelectedIds))
    },
    [performSearch]
  )

  const handleIngredientAdd = useCallback(
    async (ingredient: { id: string; name: string }) => {
      // Add to pantry in background
      addToPantry([ingredient.id]).catch((err) => {
        console.error('Failed to save to pantry:', err)
      })

      // Optimistically add to local state
      const newItem: PantryItem = {
        id: crypto.randomUUID(),
        food_id: ingredient.id,
        food_name: ingredient.name,
        quantity: null,
        unit: null,
        added_at: new Date().toISOString(),
        expires_at: null,
      }
      setPantryItems((prev) => [newItem, ...prev])

      // Also select it for search
      const newSelectedIds = new Set(selectedFoodIds)
      newSelectedIds.add(ingredient.id)
      setSelectedFoodIds(newSelectedIds)
      performSearch(Array.from(newSelectedIds))
    },
    [selectedFoodIds, performSearch]
  )

  const handleRemoveItem = useCallback(
    async (foodId: string) => {
      // Remove from pantry in background
      removeFromPantry(foodId).catch((err) => {
        console.error('Failed to remove from pantry:', err)
      })

      // Optimistically remove from local state
      setPantryItems((prev) => prev.filter((item) => item.food_id !== foodId))

      // Also remove from selection
      const newSelectedIds = new Set(selectedFoodIds)
      newSelectedIds.delete(foodId)
      setSelectedFoodIds(newSelectedIds)
      performSearch(Array.from(newSelectedIds))
    },
    [selectedFoodIds, performSearch]
  )

  const handleMinMatchChange = useCallback(
    (value: number) => {
      setMinMatchPercentage(value)

      // Debounce the search to avoid excessive API calls while sliding
      if (sliderDebounceRef.current) {
        clearTimeout(sliderDebounceRef.current)
      }

      sliderDebounceRef.current = setTimeout(() => {
        if (selectedFoodIds.size > 0) {
          performSearch(Array.from(selectedFoodIds), { minMatch: value, onlyOwn: onlyOwnRecipes })
        }
      }, 300)
    },
    [selectedFoodIds, onlyOwnRecipes, performSearch]
  )

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current) {
        clearTimeout(sliderDebounceRef.current)
      }
    }
  }, [])

  const handleOnlyOwnChange = useCallback(
    (value: boolean) => {
      setOnlyOwnRecipes(value)
      if (selectedFoodIds.size > 0) {
        performSearch(Array.from(selectedFoodIds), { minMatch: minMatchPercentage, onlyOwn: value })
      }
    },
    [selectedFoodIds, minMatchPercentage, performSearch]
  )

  return (
    <div className="space-y-8">
      {/* Add new ingredients */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Lägg till ingrediens</h2>
        <IngredientSearch
          existingFoodIds={selectedFoodIds}
          onIngredientAdd={handleIngredientAdd}
          isLoading={isLoading}
        />
      </section>

      {/* Pantry table */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Mitt skafferi</h2>
        <PantryTable
          items={pantryItems}
          selectedIds={selectedFoodIds}
          onSelectionChange={handleSelectionChange}
          onRemoveItem={handleRemoveItem}
        />
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Search results */}
      <SearchResults
        results={results}
        isLoading={isLoading}
        hasSearched={hasSearched}
        selectedIngredients={selectedIngredients}
        minMatchPercentage={minMatchPercentage}
        onMinMatchChange={handleMinMatchChange}
        onlyOwnRecipes={onlyOwnRecipes}
        onOnlyOwnChange={handleOnlyOwnChange}
      />
    </div>
  )
}
