'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleShoppingListItem } from '@/lib/actions'
import { addToPantry } from '@/lib/ingredient-search-actions'
import { cn } from '@/lib/utils'
import { PackagePlus, X } from 'lucide-react'
import type { ShoppingListItem as ShoppingListItemType } from '@/lib/types'

interface ShoppingListItemProps {
  item: ShoppingListItemType
  pantryMap?: Record<string, string | null>
}

export function ShoppingListItem({ item, pantryMap }: ShoppingListItemProps) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(item.is_checked)
  const [isPending, startTransition] = useTransition()
  const [pantryExpanded, setPantryExpanded] = useState(false)
  const [pantryDate, setPantryDate] = useState<string | null>(null)

  function handleToggle() {
    startTransition(async () => {
      setOptimisticChecked(!optimisticChecked)
      await toggleShoppingListItem(item.id)
    })
  }

  function handleAddToPantry(expiresAt?: string) {
    if (!item.food_id) return
    addToPantry([item.food_id], expiresAt).catch((err) => {
      console.error('Failed to add to pantry:', err)
    })
    setPantryExpanded(false)
    setPantryDate(expiresAt ?? '')
  }

  const formattedQuantity = item.quantity % 1 === 0
    ? item.quantity.toString()
    : item.quantity.toFixed(1)

  const isCustomItem = item.quantity === 1 && !item.unit_name
  const quantityUnit = isCustomItem
    ? null
    : [formattedQuantity, item.unit_name].filter(Boolean).join(' ')

  // Pantry state: local (just added this session) takes priority over server data
  const serverDate = item.food_id ? pantryMap?.[item.food_id] : undefined
  const inPantry = pantryDate !== null || serverDate !== undefined
  const displayDate = pantryDate ?? serverDate
  const hasPantryAction = optimisticChecked && item.food_id

  return (
    <div>
      <label
        className={cn(
          'flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors',
          optimisticChecked ? 'bg-muted/20' : 'hover:bg-muted/30',
          isPending && 'opacity-60'
        )}
      >
        <Checkbox
          checked={optimisticChecked}
          onCheckedChange={handleToggle}
          disabled={isPending}
          className="h-[22px] w-[22px] shrink-0 rounded-full"
          aria-label={optimisticChecked ? 'Markera som ej köpt' : 'Markera som köpt'}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'text-[15px] font-medium transition-all',
                optimisticChecked && 'text-muted-foreground line-through'
              )}
            >
              {item.item_name}
            </span>
            {quantityUnit && (
              <span
                className={cn(
                  'text-sm text-muted-foreground transition-all',
                  optimisticChecked && 'line-through opacity-60'
                )}
              >
                {quantityUnit}
              </span>
            )}
          </div>

          {item.source_recipes && item.source_recipes.length > 0 && (
            <p
              className={cn(
                'mt-0.5 text-xs text-muted-foreground/60 truncate',
                optimisticChecked && 'opacity-50'
              )}
            >
              {item.source_recipes.join(', ')}
            </p>
          )}
        </div>

        {hasPantryAction && !pantryExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setPantryExpanded(true)
            }}
            className={cn(
              'shrink-0 rounded-full transition-colors',
              inPantry
                ? 'px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10'
                : 'p-1.5 text-muted-foreground/40 hover:text-primary hover:bg-primary/10'
            )}
            aria-label={inPantry ? 'Ändra utgångsdatum' : 'Lägg till i skafferiet'}
          >
            {inPantry ? (
              displayDate
                ? new Date(displayDate + 'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
                : 'I skafferiet'
            ) : (
              <PackagePlus className="h-4 w-4" />
            )}
          </button>
        )}
      </label>

      {pantryExpanded && (
        <div className="flex items-center gap-2 bg-primary/5 px-5 py-2 pl-[3.75rem]">
          <PackagePlus className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Skafferi?</span>
          <input
            type="date"
            defaultValue={displayDate ?? undefined}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (e.target.value) handleAddToPantry(e.target.value)
            }}
            className="h-7 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Utgångsdatum"
          />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); handleAddToPantry() }}
            className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            Utan datum
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setPantryExpanded(false) }}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Stäng"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
