'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { X, Check, ChevronDown } from '@/lib/icons'
import type { CategoryGroup } from '@/lib/types'

interface CategoryFilterProps {
  groupedCategories: CategoryGroup[]
  className?: string
}

export function CategoryFilter({
  groupedCategories,
  className,
}: CategoryFilterProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  const activeCategories =
    searchParams.get('categories')?.split(',').filter(Boolean) ?? []

  const toggleCategory = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const current =
        params.get('categories')?.split(',').filter(Boolean) ?? []
      const updated = current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category]

      if (updated.length > 0) {
        params.set('categories', updated.join(','))
      } else {
        params.delete('categories')
      }

      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('categories')
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [searchParams, router, pathname])

  const isActive = (category: string) => activeCategories.includes(category)
  const hasActive = activeCategories.length > 0

  return (
    <div className={cn('', className)}>
      {/* ── Inline bar: trigger + active selections ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 -mx-1 px-1">
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(
            'shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95',
            hasActive
              ? 'bg-foreground text-background shadow-sm'
              : 'bg-card text-foreground/80 shadow-sm shadow-black/[0.04] hover:bg-card/80'
          )}
        >
          Kategorier
          {hasActive ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background/20 px-1 text-[11px] font-bold leading-none">
              {activeCategories.length}
            </span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          )}
        </button>

        {/* Active category pills — quick removal */}
        {activeCategories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => toggleCategory(category)}
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-foreground/10 px-3 py-1.5 text-sm font-medium text-foreground transition-all duration-150 active:scale-95"
          >
            {category}
            <X className="h-3 w-3 opacity-50" />
          </button>
        ))}

        {/* Clear all */}
        {activeCategories.length > 1 && (
          <button
            type="button"
            onClick={clearAll}
            className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap px-1"
          >
            Rensa
          </button>
        )}
      </div>

      {/* ── Sheet: grouped category browser ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[85vh] pt-3 md:mx-auto md:max-w-lg md:rounded-t-2xl"
        >
          {/* Drag indicator */}
          <div className="flex justify-center pb-3">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
          </div>

          <SheetHeader className="pb-3">
            <SheetTitle className="text-base font-semibold">
              Kategorier
            </SheetTitle>
            {hasActive && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-1 text-sm font-medium text-primary"
              >
                Rensa alla
              </button>
            )}
            <SheetDescription className="sr-only">
              Välj kategorier att filtrera efter
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 overflow-y-auto max-h-[calc(85vh-7rem)] pb-8 -mx-6 px-6">
            {groupedCategories.map((group) => (
              <div key={group.name}>
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-2.5 select-none">
                  {group.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {group.categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95',
                        isActive(category)
                          ? 'border-foreground bg-card text-foreground shadow-sm'
                          : 'border-transparent bg-card text-foreground/80 shadow-sm shadow-black/[0.04]'
                      )}
                    >
                      <Check
                        className={cn(
                          'h-3.5 w-3.5 transition-opacity duration-150',
                          isActive(category) ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
