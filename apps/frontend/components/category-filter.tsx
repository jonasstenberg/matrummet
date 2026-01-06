'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ScrollShadowContainer } from '@/components/scroll-shadow-container'

interface CategoryFilterProps {
  categories: string[]
  className?: string
}

export function CategoryFilter({ categories, className }: CategoryFilterProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Parse active categories from URL (comma-separated)
  const activeCategories = searchParams.get('categories')?.split(',').filter(Boolean) ?? []

  const toggleCategory = useCallback(
    (category: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const current = params.get('categories')?.split(',').filter(Boolean) ?? []

      let updated: string[]
      if (current.includes(category)) {
        // Remove category
        updated = current.filter((c) => c !== category)
      } else {
        // Add category
        updated = [...current, category]
      }

      if (updated.length > 0) {
        params.set('categories', updated.join(','))
      } else {
        params.delete('categories')
      }

      const queryString = params.toString()
      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      })
    },
    [searchParams, router, pathname]
  )

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('categories')
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }, [searchParams, router, pathname])

  const isActive = (category: string) => activeCategories.includes(category)
  const hasActiveCategories = activeCategories.length > 0

  return (
    <div className={cn('w-full', className)}>
      <ScrollShadowContainer>
        <button type="button" onClick={clearAll}>
          <Badge
            variant={!hasActiveCategories ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer whitespace-nowrap transition-colors',
              !hasActiveCategories && 'bg-primary text-primary-foreground',
              hasActiveCategories && 'hover:bg-accent'
            )}
          >
            Alla
          </Badge>
        </button>

        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => toggleCategory(category)}
          >
            <Badge
              variant={isActive(category) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer whitespace-nowrap transition-colors',
                isActive(category) && 'bg-primary text-primary-foreground',
                !isActive(category) && 'hover:bg-accent'
              )}
            >
              {category}
            </Badge>
          </button>
        ))}
      </ScrollShadowContainer>
    </div>
  )
}
