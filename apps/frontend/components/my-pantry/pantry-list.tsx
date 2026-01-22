'use client'

import { useState, useMemo } from 'react'
import { X, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PantryItem } from '@/lib/ingredient-search-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PantryListProps {
  items: PantryItem[]
  onRemoveItem: (foodId: string) => void
}

const PAGE_SIZE = 10

export function PantryList({ items, onRemoveItem }: PantryListProps) {
  const [filterValue, setFilterValue] = useState('')
  const [page, setPage] = useState(0)

  const filteredItems = useMemo(() => {
    if (!filterValue) return items
    const lowerFilter = filterValue.toLowerCase()
    return items.filter((item) =>
      item.food_name.toLowerCase().includes(lowerFilter)
    )
  }, [items, filterValue])

  // Reset to first page when filter changes
  const handleFilterChange = (value: string) => {
    setFilterValue(value)
    setPage(0)
  }

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE)
  const paginatedItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const showFilter = items.length > 10
  const showPagination = filteredItems.length > PAGE_SIZE

  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-white py-12 text-center text-muted-foreground">
        Ditt skafferi är tomt. Lägg till ingredienser ovan.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Filter input - only show when more than 10 items */}
      {showFilter && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrera ingredienser..."
            value={filterValue}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="bg-white pl-10"
          />
        </div>
      )}

      {/* List with white background */}
      <div className="rounded-md border bg-white">
        {paginatedItems.length > 0 ? (
          <ul className="divide-y">
            {paginatedItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="font-medium">{item.food_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveItem(item.food_id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Ta bort ${item.food_name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            Inga ingredienser matchar filtret.
          </p>
        )}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredItems.length)} av {filteredItems.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
