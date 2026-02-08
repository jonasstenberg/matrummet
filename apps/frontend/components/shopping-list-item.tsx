'use client'

import { useOptimistic, useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { toggleShoppingListItem } from '@/lib/actions'
import { cn } from '@/lib/utils'
import type { ShoppingListItem as ShoppingListItemType } from '@/lib/types'

interface ShoppingListItemProps {
  item: ShoppingListItemType
}

export function ShoppingListItem({ item }: ShoppingListItemProps) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(item.is_checked)
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(async () => {
      setOptimisticChecked(!optimisticChecked)
      await toggleShoppingListItem(item.id)
    })
  }

  const formattedQuantity = item.quantity % 1 === 0
    ? item.quantity.toString()
    : item.quantity.toFixed(1)

  // For custom items (no unit), show just the name
  const isCustomItem = item.quantity === 1 && !item.unit_name
  const quantityUnit = isCustomItem
    ? null
    : [formattedQuantity, item.unit_name].filter(Boolean).join(' ')

  return (
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
    </label>
  )
}
