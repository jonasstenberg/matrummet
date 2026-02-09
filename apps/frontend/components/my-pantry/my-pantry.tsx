'use client'

import { useState, useCallback, useMemo } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'
import type { PantryItem, CommonPantryItem } from '@/lib/ingredient-search-types'
import { addToPantry, removeFromPantry, updatePantryItemExpiry } from '@/lib/ingredient-search-actions'
import { cn } from '@/lib/utils'
import { IngredientSearch } from './ingredient-search'
import { PantryList } from './pantry-list'

interface MyPantryProps {
  initialPantry?: PantryItem[]
  commonPantryItems?: CommonPantryItem[]
}

type CategoryKey = 'basic' | 'seasoning' | 'herb' | 'spice'

const categoryLabels: Record<CategoryKey, string> = {
  basic: 'Basvaror',
  seasoning: 'Smaksättare',
  herb: 'Örter',
  spice: 'Kryddor',
}

const categoryOrder: CategoryKey[] = ['basic', 'seasoning', 'herb', 'spice']

export function MyPantry({ initialPantry = [], commonPantryItems = [] }: MyPantryProps) {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>(initialPantry)
  const [isLoading, setIsLoading] = useState(false)
  const [commonCollapsed, setCommonCollapsed] = useState(false)
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('basic')

  const existingFoodIds = useMemo(() => {
    return new Set(pantryItems.map((item) => item.food_id))
  }, [pantryItems])

  const commonByCategory = useMemo(() => {
    const grouped: Record<CategoryKey, CommonPantryItem[]> = {
      basic: [],
      seasoning: [],
      herb: [],
      spice: [],
    }
    commonPantryItems.forEach((item) => {
      if (grouped[item.category as CategoryKey]) {
        grouped[item.category as CategoryKey].push(item)
      }
    })
    return grouped
  }, [commonPantryItems])

  const availableCategories = useMemo(
    () => categoryOrder.filter((cat) => commonByCategory[cat].length > 0),
    [commonByCategory]
  )

  const handleIngredientAdd = useCallback(
    async (ingredient: { id: string; name: string }, expiresAt?: string) => {
      if (existingFoodIds.has(ingredient.id)) return

      setIsLoading(true)

      addToPantry([ingredient.id], expiresAt).catch((err) => {
        console.error('Failed to save to pantry:', err)
      })

      const newItem: PantryItem = {
        id: crypto.randomUUID(),
        food_id: ingredient.id,
        food_name: ingredient.name,
        quantity: null,
        unit: null,
        added_at: new Date().toISOString(),
        expires_at: expiresAt ?? null,
        is_expired: expiresAt ? new Date(expiresAt) < new Date(new Date().toDateString()) : false,
      }
      setPantryItems((prev) => [newItem, ...prev])
      setIsLoading(false)
    },
    [existingFoodIds]
  )

  const handleRemoveItem = useCallback(async (foodId: string) => {
    removeFromPantry(foodId).catch((err) => {
      console.error('Failed to remove from pantry:', err)
    })
    setPantryItems((prev) => prev.filter((item) => item.food_id !== foodId))
  }, [])

  const handleUpdateExpiry = useCallback((foodId: string, expiresAt: string | null) => {
    updatePantryItemExpiry(foodId, expiresAt).catch((err) => {
      console.error('Failed to update expiry:', err)
    })
    setPantryItems((prev) =>
      prev.map((item) =>
        item.food_id === foodId
          ? {
              ...item,
              expires_at: expiresAt,
              is_expired: expiresAt ? new Date(expiresAt) < new Date(new Date().toDateString()) : false,
            }
          : item
      )
    )
  }, [])

  return (
    <div className="space-y-4">
      {/* Main pantry card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <PantryList items={pantryItems} onRemoveItem={handleRemoveItem} onUpdateExpiry={handleUpdateExpiry} />

        {/* Inline search input */}
        <div
          className={cn(
            'border-t border-border/60 px-4 py-3',
            pantryItems.length === 0 && 'border-t-0'
          )}
        >
          <IngredientSearch
            existingFoodIds={existingFoodIds}
            onIngredientAdd={handleIngredientAdd}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Common ingredients — collapsible card */}
      {availableCategories.length > 0 && (
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <button
            type="button"
            onClick={() => setCommonCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30"
          >
            <span className="font-medium">Vanliga ingredienser</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                commonCollapsed && '-rotate-90'
              )}
            />
          </button>

          {!commonCollapsed && (
            <div className="border-t border-border/40">
              {/* Category tabs */}
              <div className="flex gap-1 px-4 pt-3 pb-2">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      activeCategory === cat
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {categoryLabels[cat]}
                  </button>
                ))}
              </div>

              {/* Ingredient pills */}
              <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                {commonByCategory[activeCategory].map((item) => {
                  const isInPantry = existingFoodIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                        isInPantry
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-primary hover:text-primary-foreground'
                      )}
                      onClick={() => {
                        if (isInPantry) {
                          handleRemoveItem(item.id)
                        } else {
                          handleIngredientAdd({ id: item.id, name: item.name })
                        }
                      }}
                    >
                      {isInPantry ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                      {item.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
