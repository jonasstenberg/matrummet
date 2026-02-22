
import { useState, useTransition, useEffect, useCallback } from 'react'
import { AddCustomItemInput } from '@/components/add-custom-item-input'
import { ShoppingListItem } from '@/components/shopping-list-item'
import { clearCheckedItems, toggleShoppingListItem } from '@/lib/actions'
import type { ShoppingListItem as ShoppingListItemType } from '@/lib/types'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface ShoppingListProps {
  items: ShoppingListItemType[]
  listId?: string
  pantryMap?: Record<string, string | null>
  homeId?: string
}

export function ShoppingList({ items, listId, pantryMap, homeId }: ShoppingListProps) {
  const [localItems, setLocalItems] = useState(items)
  const [isPending, startTransition] = useTransition()
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [checkedCollapsed, setCheckedCollapsed] = useState(false)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  const uncheckedItems = localItems.filter((item) => !item.is_checked)
  const checkedItems = localItems.filter((item) => item.is_checked)

  const handleToggle = useCallback(async (itemId: string) => {
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_checked: !item.is_checked } : item
      )
    )
    setTogglingIds((prev) => new Set(prev).add(itemId))

    const result = await toggleShoppingListItem(itemId, homeId)
    setTogglingIds((prev) => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })

    if ('error' in result) {
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_checked: !item.is_checked } : item
        )
      )
    }
  }, [homeId])

  function handleAddItem(item: ShoppingListItemType) {
    setLocalItems((prev) => [...prev, item])
  }

  function handleClearChecked() {
    const checkedIds = new Set(checkedItems.map((item) => item.id))
    setLocalItems((prev) => prev.filter((item) => !checkedIds.has(item.id)))

    startTransition(async () => {
      const result = await clearCheckedItems(listId, homeId)
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
              <ShoppingListItem key={item.id} item={item} checked={item.is_checked} toggling={togglingIds.has(item.id)} onToggle={() => handleToggle(item.id)} homeId={homeId} />
            ))}
          </div>
        )}

        {/* Add item input — inline at bottom of card */}
        <div className={cn(
          'border-t border-border/40 px-4 py-3',
          uncheckedItems.length === 0 && 'border-t-0'
        )}>
          <AddCustomItemInput listId={listId} onItemAdded={handleAddItem} homeId={homeId} />
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
            <div className="divide-y divide-border/40 border-t border-border/40">
              {checkedItems.map((item) => (
                <ShoppingListItem key={item.id} item={item} checked={item.is_checked} toggling={togglingIds.has(item.id)} onToggle={() => handleToggle(item.id)} pantryMap={pantryMap} homeId={homeId} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
