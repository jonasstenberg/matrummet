'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { addToPantry } from '@/lib/ingredient-search-actions'
import { useIsMobile } from '@/lib/hooks/use-media-query'
import { Check } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { ShoppingListItem } from '@/lib/types'

interface AddToPantryDialogProps {
  items: ShoppingListItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PantryEntry {
  food_id: string
  name: string
  checked: boolean
  expiresAt: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export function AddToPantryDialog({
  items,
  open,
  onOpenChange,
}: AddToPantryDialogProps) {
  const isMobile = useIsMobile()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Only items with food_id can be added to pantry
  const eligibleItems = items.filter((i) => i.food_id)

  const [entries, setEntries] = useState<PantryEntry[]>(() =>
    eligibleItems.map((item) => ({
      food_id: item.food_id!,
      name: item.item_name,
      checked: true,
      expiresAt: '',
    }))
  )

  // Re-initialize when dialog opens with new items
  const [prevItemCount, setPrevItemCount] = useState(items.length)
  if (items.length !== prevItemCount) {
    setPrevItemCount(items.length)
    setEntries(
      items
        .filter((i) => i.food_id)
        .map((item) => ({
          food_id: item.food_id!,
          name: item.item_name,
          checked: true,
          expiresAt: '',
        }))
    )
  }

  function toggleItem(index: number) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, checked: !e.checked } : e))
    )
  }

  function setExpiry(index: number, value: string) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, expiresAt: value } : e))
    )
  }

  const checkedCount = entries.filter((e) => e.checked).length

  async function handleSubmit() {
    const toAdd = entries.filter((e) => e.checked)
    if (toAdd.length === 0) return

    setIsSubmitting(true)

    try {
      for (const entry of toAdd) {
        const result = await addToPantry(
          [entry.food_id],
          entry.expiresAt || undefined
        )
        if ('error' in result) {
          setIsSubmitting(false)
          return
        }
      }

      setSuccess(true)
      setIsSubmitting(false)

      setTimeout(() => {
        onOpenChange(false)
      }, 1200)
    } catch {
      setIsSubmitting(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setSuccess(false)
    }
    onOpenChange(newOpen)
  }

  const content = (
    <>
      {success ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium">
            Tillagt i skafferiet!
          </p>
        </div>
      ) : eligibleItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Inga avbockade varor kan läggas till i skafferiet.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="py-2 space-y-0.5">
            {entries.map((entry, index) => (
              <div
                key={entry.food_id}
                className="flex items-center gap-3 py-3 sm:py-2 px-2 rounded-lg"
              >
                <label className="flex flex-1 items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={entry.checked}
                    onCheckedChange={() => toggleItem(index)}
                    className="h-5 w-5 sm:h-4 sm:w-4 shrink-0"
                  />
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {entry.name}
                  </span>
                </label>
                {entry.checked && (
                  <div className="shrink-0 relative">
                    <input
                      type="date"
                      value={entry.expiresAt}
                      onChange={(e) => setExpiry(index, e.target.value)}
                      className={cn(
                        'rounded-md border bg-background px-2 py-1 text-xs transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-ring',
                        entry.expiresAt ? 'text-foreground' : 'text-muted-foreground/50'
                      )}
                      aria-label={`Utgångsdatum för ${entry.name}`}
                    />
                    {entry.expiresAt && (
                      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-primary px-1 py-px text-[9px] font-medium text-primary-foreground leading-tight">
                        {formatDate(entry.expiresAt)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  const footer = success ? null : (
    <>
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSubmitting}
      >
        Avbryt
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || checkedCount === 0}
      >
        {isSubmitting
          ? 'Lägger till...'
          : `Lägg till i skafferiet (${checkedCount})`}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[85dvh] flex flex-col gap-0 px-4 rounded-t-xl"
        >
          <SheetHeader className="shrink-0 pb-4 text-left">
            <SheetTitle>Lägg till i skafferiet</SheetTitle>
            <SheetDescription>
              Välj vilka varor du vill spara i ditt skafferi.
            </SheetDescription>
          </SheetHeader>
          {content}
          {footer && (
            <SheetFooter className="shrink-0 pt-4 border-t flex-row gap-2">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-lg gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Lägg till i skafferiet</DialogTitle>
          <DialogDescription>
            Välj vilka varor du vill spara i ditt skafferi.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {content}
        </div>
        {footer && (
          <DialogFooter className="shrink-0 pt-4 border-t gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
