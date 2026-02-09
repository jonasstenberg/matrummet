'use client'

import { useState, useTransition, useEffect } from 'react'
import { AddCustomItemInput } from '@/components/add-custom-item-input'
import { AddToPantryDialog } from '@/components/add-to-pantry-dialog'
import { ShoppingListItem } from '@/components/shopping-list-item'
import { clearCheckedItems } from '@/lib/actions'
import type { ShoppingListItem as ShoppingListItemType } from '@/lib/types'
import { ChevronDown, PackagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShoppingListProps {
  items: ShoppingListItemType[]
  listId?: string
}

export function ShoppingList({ items, listId }: ShoppingListProps) {
  const [localItems, setLocalItems] = useState(items)
  const [isPending, startTransition] = useTransition()
  const [checkedCollapsed, setCheckedCollapsed] = useState(false)
  const [pantryDialogOpen, setPantryDialogOpen] = useState(false)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const uncheckedItems = localItems.filter((item) => !item.is_checked)
  const checkedItems = localItems.filter((item) => item.is_checked)

  function handleAddItem(item: ShoppingListItemType) {
    setLocalItems((prev) => [...prev, item])
  }

  function handleClearChecked() {
    const checkedIds = new Set(checkedItems.map((item) => item.id))
    setLocalItems((prev) => prev.filter((item) => !checkedIds.has(item.id)))

    startTransition(async () => {
      const result = await clearCheckedItems(listId)
      if ('error' in result) {
        setLocalItems(items)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Main list card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        {/* Unchecked items */}
        {uncheckedItems.length > 0 && (
          <div className="divide-y divide-border/40">
            {uncheckedItems.map((item) => (
              <ShoppingListItem key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Add item input — inline at bottom of card */}
        <div className={cn(
          'border-t border-border/40 px-4 py-3',
          uncheckedItems.length === 0 && 'border-t-0'
        )}>
          <AddCustomItemInput listId={listId} onItemAdded={handleAddItem} />
        </div>
      </div>

      {/* Checked items — collapsible section */}
      {checkedItems.length > 0 && (
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <button
            type="button"
            onClick={() => setCheckedCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30"
          >
            <span className="font-medium">
              Avbockade ({checkedItems.length})
            </span>
            <div className="flex items-center gap-3">
              {!checkedCollapsed && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearChecked()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      handleClearChecked()
                    }
                  }}
                  className={cn(
                    'text-xs font-medium text-muted-foreground/70 hover:text-destructive transition-colors',
                    isPending && 'opacity-50 pointer-events-none'
                  )}
                >
                  Rensa
                </span>
              )}
              <ChevronDown className={cn(
                'h-4 w-4 transition-transform',
                checkedCollapsed && '-rotate-90'
              )} />
            </div>
          </button>
          {!checkedCollapsed && (
            <>
              <div className="divide-y divide-border/40 border-t border-border/40">
                {checkedItems.map((item) => (
                  <ShoppingListItem key={item.id} item={item} />
                ))}
              </div>
              {checkedItems.some((i) => i.food_id) && (
                <div className="border-t border-border/40 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setPantryDialogOpen(true)}
                    className="flex items-center gap-2 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    Lägg till i skafferiet
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AddToPantryDialog
        items={checkedItems}
        open={pantryDialogOpen}
        onOpenChange={setPantryDialogOpen}
      />
    </div>
  )
}
