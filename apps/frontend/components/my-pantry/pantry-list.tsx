'use client'

import { useState, useMemo, useRef } from 'react'
import { X, Search, ChevronLeft, ChevronRight, CalendarDays } from '@/lib/icons'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { cn } from '@/lib/utils'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

interface PantryListProps {
  items: PantryItem[]
  onRemoveItem: (foodId: string) => void
  onUpdateExpiry: (foodId: string, expiresAt: string | null) => void
}

const PAGE_SIZE = 15

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function ExpiryEditor({
  item,
  onUpdateExpiry,
}: {
  item: PantryItem
  onUpdateExpiry: (foodId: string, expiresAt: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasExpiry = !!item.expires_at
  const isExpired = item.is_expired ?? false

  const handleDateChange = (value: string) => {
    onUpdateExpiry(item.food_id, value || null)
    setOpen(false)
  }

  const handleClear = () => {
    onUpdateExpiry(item.food_id, null)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium transition-all',
            hasExpiry && !isExpired &&
              'bg-muted text-muted-foreground hover:bg-muted/80',
            hasExpiry && isExpired &&
              'bg-destructive/10 text-destructive hover:bg-destructive/20',
            !hasExpiry &&
              'text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-muted'
          )}
          aria-label={hasExpiry ? `Utgångsdatum: ${item.expires_at}` : 'Sätt utgångsdatum'}
        >
          {hasExpiry ? (
            formatDate(item.expires_at!)
          ) : (
            <CalendarDays className="h-3.5 w-3.5" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Utgångsdatum
          </label>
          <input
            ref={inputRef}
            type="date"
            defaultValue={item.expires_at?.split('T')[0] ?? ''}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {hasExpiry && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Ta bort datum
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function PantryList({ items, onRemoveItem, onUpdateExpiry }: PantryListProps) {
  const [filterValue, setFilterValue] = useState('')
  const [page, setPage] = useState(0)

  const filteredItems = useMemo(() => {
    if (!filterValue) return items
    const lowerFilter = filterValue.toLowerCase()
    return items.filter((item) =>
      item.food_name.toLowerCase().includes(lowerFilter)
    )
  }, [items, filterValue])

  const handleFilterChange = (value: string) => {
    setFilterValue(value)
    setPage(0)
  }

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE)
  const paginatedItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showFilter = items.length > PAGE_SIZE
  const showPagination = filteredItems.length > PAGE_SIZE

  if (items.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted-foreground">
        Ditt skafferi är tomt
      </div>
    )
  }

  return (
    <div>
      {/* Filter input — only when many items */}
      {showFilter && (
        <div className="relative border-b border-border/60 px-5 py-2.5">
          <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder="Filtrera ingredienser..."
            className="w-full bg-transparent py-0.5 pl-6 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>
      )}

      {/* Items */}
      <div className="divide-y divide-border/60">
        {paginatedItems.length > 0 ? (
          paginatedItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
            >
              <span className="flex-1 min-w-0 text-[15px] font-medium truncate">
                {item.food_name}
              </span>
              <ExpiryEditor item={item} onUpdateExpiry={onUpdateExpiry} />
              <button
                type="button"
                onClick={() => onRemoveItem(item.food_id)}
                className="shrink-0 rounded-full p-1.5 opacity-0 text-muted-foreground transition-all group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                aria-label={`Ta bort ${item.food_name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="px-5 py-6 text-center text-sm text-muted-foreground">
            Inga ingredienser matchar filtret
          </div>
        )}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between border-t border-border/60 px-5 py-2.5 text-sm">
          <span className="text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredItems.length)} av {filteredItems.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1.5 text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
