'use client'

import { useState, useCallback, useMemo } from 'react'
import type { PantryItem, CommonPantryItem } from '@/lib/ingredient-search-types'
import { addToPantry, removeFromPantry } from '@/lib/ingredient-search-actions'
import { IngredientSearch } from './ingredient-search'
import { PantryTable } from './pantry-table'
import { PantrySuggestions } from './pantry-suggestions'

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
    <div className="space-y-8">
      {/* Add new ingredients */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Lägg till ingrediens</h2>
        <IngredientSearch
          selectedIngredients={[]}
          onIngredientsChange={() => {}}
          onIngredientAdd={handleIngredientAdd}
          isLoading={isLoading}
        />
        {commonPantryItems.length > 0 && (
          <PantrySuggestions
            items={commonPantryItems}
            existingFoodIds={existingFoodIds}
            onAddItem={handleIngredientAdd}
            onRemoveItem={handleRemoveItem}
          />
        )}
      </section>

      {/* Pantry table */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          Mitt skafferi ({pantryItems.length} ingredienser)
        </h2>
        <PantryTable
          items={pantryItems}
          selectedIds={new Set()}
          onSelectionChange={() => {}}
          onRemoveItem={handleRemoveItem}
          showSelection={false}
        />
      </section>
    </div>
  )
}
