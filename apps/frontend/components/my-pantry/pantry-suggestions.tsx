'use client'

import { Plus, Check } from 'lucide-react'
import type { CommonPantryItem } from '@/lib/ingredient-search-types'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

interface PantrySuggestionsProps {
  items: CommonPantryItem[]
  existingFoodIds: Set<string>
  onAddItem: (item: { id: string; name: string }) => void
  onRemoveItem?: (foodId: string) => void
}

type PantryCategory = CommonPantryItem['category']

const categoryLabels: Record<PantryCategory, string> = {
  basic: 'Basvaror',
  seasoning: 'Smaksättare',
  herb: 'Orter',
  spice: 'Kryddor',
}

// Order categories for display, with 'basic' first
const categoryOrder: PantryCategory[] = ['basic', 'seasoning', 'herb', 'spice']

export function PantrySuggestions({
  items,
  existingFoodIds,
  onAddItem,
  onRemoveItem,
}: PantrySuggestionsProps) {
  // Group items by category
  const itemsByCategory = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = []
      }
      acc[item.category].push(item)
      return acc
    },
    {} as Record<PantryCategory, CommonPantryItem[]>
  )

  // Get categories that have items, in the defined order
  const categories = categoryOrder.filter(
    (cat) => itemsByCategory[cat]?.length > 0
  )

  if (categories.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Vanliga ingredienser
      </h3>
      <Accordion
        type="multiple"
        defaultValue={['basic']}
        className="w-full"
      >
        {categories.map((category) => (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              {categoryLabels[category]}
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap gap-2">
                {itemsByCategory[category].map((item) => {
                  const isInPantry = existingFoodIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (isInPantry && onRemoveItem) {
                          onRemoveItem(item.id)
                        } else if (!isInPantry) {
                          onAddItem({ id: item.id, name: item.name })
                        }
                      }}
                      className="cursor-pointer"
                    >
                      <Badge
                        variant={isInPantry ? 'default' : 'outline'}
                        className={cn(
                          'gap-1 transition-colors',
                          isInPantry
                            ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                            : 'hover:bg-primary hover:text-primary-foreground'
                        )}
                      >
                        {isInPantry ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        {item.name}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
