'use client'

import { useState, useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleShoppingListItem } from '@/lib/actions'
import { cn } from '@/lib/utils'
import type { ShoppingListItem as ShoppingListItemType } from '@/lib/api'

interface ShoppingListItemProps {
  item: ShoppingListItemType
}

export function ShoppingListItem({ item }: ShoppingListItemProps) {
  const [isChecked, setIsChecked] = useState(item.is_checked)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    // Optimistic update
    setIsChecked((prev) => !prev)

    startTransition(async () => {
      const result = await toggleShoppingListItem(item.id)
      // Revert on error
      if ('error' in result) {
        setIsChecked((prev) => !prev)
      }
    })
  }

  // Format quantity - show as integer if whole number, otherwise 1 decimal
  const formattedQuantity = item.quantity % 1 === 0
    ? item.quantity.toString()
    : item.quantity.toFixed(1)

  // Build display string: "500 g Mjöl" or "2 st Ägg"
  const displayText = [
    formattedQuantity,
    item.unit_name,
    item.item_name,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg px-3 py-3 transition-colors',
        isChecked ? 'bg-muted/30' : 'hover:bg-muted/50',
        isPending && 'opacity-70'
      )}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={handleToggle}
        disabled={isPending}
        className="mt-0.5 h-5 w-5 shrink-0"
        aria-label={isChecked ? 'Markera som ej köpt' : 'Markera som köpt'}
      />

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-base leading-relaxed transition-all',
            isChecked && 'text-muted-foreground line-through opacity-50'
          )}
        >
          {displayText}
        </p>

        {item.source_recipes && item.source_recipes.length > 0 && (
          <p
            className={cn(
              'mt-0.5 text-xs text-muted-foreground truncate',
              isChecked && 'opacity-50'
            )}
            title={item.source_recipes.join(', ')}
          >
            {item.source_recipes.join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}
