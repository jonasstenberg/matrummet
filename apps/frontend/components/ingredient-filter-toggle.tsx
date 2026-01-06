'use client'

import { useCallback } from 'react'
import { Filter } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { PantryItem } from '@/lib/ingredient-search-types'
import Link from 'next/link'

interface IngredientFilterToggleProps {
  pantryItems: PantryItem[]
  isFilterActive: boolean
  minMatchPercentage: number
  isLoading: boolean
  onFilterToggle: (active: boolean) => void
  onMinMatchChange: (value: number) => void
}

export function IngredientFilterToggle({
  pantryItems,
  isFilterActive,
  minMatchPercentage,
  isLoading,
  onFilterToggle,
  onMinMatchChange,
}: IngredientFilterToggleProps) {
  const hasPantryItems = pantryItems.length > 0

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (hasPantryItems) {
        onFilterToggle(checked)
      }
    },
    [hasPantryItems, onFilterToggle]
  )

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Toggle */}
        <div className="flex items-center gap-3">
          <Switch
            id="ingredient-filter"
            checked={isFilterActive}
            onCheckedChange={handleToggle}
            disabled={!hasPantryItems || isLoading}
          />
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <Label
              htmlFor="ingredient-filter"
              className={cn(
                'cursor-pointer font-medium',
                !hasPantryItems && 'text-muted-foreground'
              )}
            >
              Filtrera på mitt skafferi
            </Label>
          </div>
          {isFilterActive && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {pantryItems.length} ingredienser
            </span>
          )}
        </div>

        {/* Match slider - only shown when filter is active */}
        {isFilterActive && (
          <div className="flex items-center gap-3">
            <Label htmlFor="match-slider" className="whitespace-nowrap text-sm">
              Min matchning: {minMatchPercentage}%
            </Label>
            <Slider
              id="match-slider"
              value={[minMatchPercentage]}
              onValueChange={([value]) => onMinMatchChange(value)}
              min={50}
              max={100}
              step={5}
              className="w-32"
              aria-label="Minsta matchningsprocent"
            />
          </div>
        )}
      </div>

      {/* Empty pantry message */}
      {!hasPantryItems && (
        <p className="mt-2 text-sm text-muted-foreground">
          Lägg till ingredienser i{' '}
          <Link href="/mitt-skafferi" className="text-primary underline hover:no-underline">
            ditt skafferi
          </Link>{' '}
          för att filtrera recept.
        </p>
      )}
    </div>
  )
}
