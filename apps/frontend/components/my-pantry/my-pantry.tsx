'use client'

import { useState, useCallback, useMemo } from 'react'
import type { PantryItem, CommonPantryItem } from '@/lib/ingredient-search-types'
import { addToPantry, removeFromPantry } from '@/lib/ingredient-search-actions'
import { IngredientSearch } from './ingredient-search'
import { PantryList } from './pantry-list'

interface MyPantryProps {
  initialPantry?: PantryItem[]
  commonPantryItems?: CommonPantryItem[]
}

export function MyPantry({ initialPantry = [], commonPantryItems = [] }: MyPantryProps) {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(initialPantry)
  const [isLoading, setIsLoading] = useState(false)

  // Set of food IDs already in pantry (for suggestions)
  const existingFoodIds = useMemo(() => {
    return new Set(pantryItems.map((item) => item.food_id))
  }, [pantryItems])

  const handleIngredientAdd = useCallback(
    async (ingredient: { id: string; name: string }) => {
      // Check if already in pantry
      if (existingFoodIds.has(ingredient.id)) {
        return
      }

      setIsLoading(true)

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
      setIsLoading(false)
    },
    [existingFoodIds]
  )

  const handleRemoveItem = useCallback(async (foodId: string) => {
    // Remove from pantry in background
    removeFromPantry(foodId).catch((err) => {
      console.error('Failed to remove from pantry:', err)
    })

    // Optimistically remove from local state
    setPantryItems((prev) => prev.filter((item) => item.food_id !== foodId))
  }, [])

  return (
    <div className="space-y-6">
      {/* Unified search with common ingredients in dropdown */}
      <IngredientSearch
        pantryItems={pantryItems}
        commonPantryItems={commonPantryItems}
        onIngredientAdd={handleIngredientAdd}
        isLoading={isLoading}
      />

      {/* Pantry list */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          I skafferiet ({pantryItems.length})
        </h2>
        <PantryList
          items={pantryItems}
          onRemoveItem={handleRemoveItem}
        />
      </section>
    </div>
  )
}
