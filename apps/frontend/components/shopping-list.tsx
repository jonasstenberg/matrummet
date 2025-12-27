'use client'

import { useState, useTransition, useEffect } from 'react'
import { ShoppingListItem } from '@/components/shopping-list-item'
import { Button } from '@/components/ui/button'
import { clearCheckedItems } from '@/lib/actions'
import type { ShoppingListItem as ShoppingListItemType } from '@/lib/api'
import { Trash2 } from 'lucide-react'

interface ShoppingListProps {
  items: ShoppingListItemType[]
  listId?: string
}

export function ShoppingList({ items, listId }: ShoppingListProps) {
  const [localItems, setLocalItems] = useState(items)
  const [isPending, startTransition] = useTransition()

  // Update local items when props change (e.g., when switching lists)
  useEffect(() => {
    setLocalItems(items)
  }, [items])

  // Separate unchecked and checked items
  const uncheckedItems = localItems.filter((item) => !item.is_checked)
  const checkedItems = localItems.filter((item) => item.is_checked)

  function handleClearChecked() {
    // Optimistic update - remove checked items from local state
    const checkedIds = new Set(checkedItems.map((item) => item.id))
    setLocalItems((prev) => prev.filter((item) => !checkedIds.has(item.id)))

    startTransition(async () => {
      const result = await clearCheckedItems(listId)
      if ('error' in result) {
        // Revert on error - restore the checked items
        setLocalItems(items)
      }
    })
  }

  if (localItems.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Unchecked items */}
      {uncheckedItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
          <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Att handla
            </h2>
          </div>
          <div className="divide-y divide-border/30 px-2 py-2">
            {uncheckedItems.map((item) => (
              <ShoppingListItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Checked items */}
      {checkedItems.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-4">
            <h2 className="text-lg font-semibold text-muted-foreground">
              Avbockade ({checkedItems.length})
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChecked}
              disabled={isPending}
              className="text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Rensa avbockade
            </Button>
          </div>
          <div className="divide-y divide-border/30 px-2 py-2">
            {checkedItems.map((item) => (
              <ShoppingListItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
