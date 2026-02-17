'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Plus, ShoppingCart } from '@/lib/icons'
import { MealPlanDayCard } from './meal-plan-day-card'
import { MealPlanSwapSheet } from './meal-plan-swap-sheet'
import { MealPlanSuggestionSheet } from './meal-plan-suggestion-sheet'
import { MealPlanShoppingDialog } from './meal-plan-shopping-dialog'
import { toast } from 'sonner'
import { swapMealPlanEntry } from '@/lib/meal-plan-actions'
import type { MealPlan, MealPlanEntry, MealPlanSummary } from '@/lib/meal-plan/types'
import { DAY_NAMES } from '@/lib/meal-plan/types'

/** Parse "YYYY-MM-DD" as local date (not UTC) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface MealPlanWeekViewProps {
  plan: MealPlan
  homeId?: string
  planList: MealPlanSummary[]
  isNavigating: boolean
  onNavigate: (planId: string) => void
  onNewPlan: () => void
  onEntrySwapped: (entryId: string, update: Partial<MealPlanEntry>) => void
}

export function MealPlanWeekView({
  plan,
  homeId,
  planList,
  isNavigating,
  onNavigate,
  onNewPlan,
  onEntrySwapped,
}: MealPlanWeekViewProps) {
  const [swapEntry, setSwapEntry] = useState<MealPlanEntry | null>(null)
  const [viewEntry, setViewEntry] = useState<MealPlanEntry | null>(null)
  const [shoppingDialogOpen, setShoppingDialogOpen] = useState(false)

  // Group entries by day
  const entriesByDay = new Map<number, MealPlanEntry[]>()
  for (const entry of plan.entries) {
    const existing = entriesByDay.get(entry.day_of_week) || []
    existing.push(entry)
    entriesByDay.set(entry.day_of_week, existing)
  }

  async function handleSwap(
    recipeId: string | null,
    recipeName: string | null,
    recipeDescription: string | null,
  ) {
    if (!swapEntry) return

    if (swapEntry.id.startsWith('temp-')) {
      // Plan hasn't synced from server yet — refresh to get real IDs
      window.location.reload()
      return
    }

    try {
      const result = await swapMealPlanEntry(
        swapEntry.id,
        recipeId,
        recipeId ? null : recipeName,
        recipeId ? null : recipeDescription,
        null, // Clear suggested_recipe on swap
      )

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      onEntrySwapped(swapEntry.id, {
        recipe_id: recipeId,
        suggested_name: recipeId ? null : recipeName,
        suggested_description: recipeId ? null : recipeDescription,
        suggested_recipe: null,
        recipe_name: recipeName || undefined,
      })
      setSwapEntry(null)
    } catch {
      toast.error('Ett fel uppstod. Försök igen.')
    }
  }

  const weekDate = parseLocalDate(plan.week_start)
  const hasEntries = plan.entries.length > 0

  // Plan navigation — planList is sorted by week_start DESC (newest first)
  const currentIndex = planList.findIndex((p) => p.id === plan.id)
  const hasNewer = currentIndex > 0
  const hasOlder = currentIndex >= 0 && currentIndex < planList.length - 1

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {planList.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!hasOlder || isNavigating}
              onClick={() => hasOlder && onNavigate(planList[currentIndex + 1].id)}
              aria-label="Äldre plan"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Vecka {getWeekNumber(weekDate)} &middot;{' '}
            {weekDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
          </p>
          {planList.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={!hasNewer || isNavigating}
              onClick={() => hasNewer && onNavigate(planList[currentIndex - 1].id)}
              aria-label="Nyare plan"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onNewPlan}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Ny plan
        </Button>
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => i + 1).map((dayNum) => {
          const dayEntries = entriesByDay.get(dayNum) || []
          if (dayEntries.length === 0) return null

          // Compute date for this day (dayNum 1 = Monday = week_start)
          const dayDate = parseLocalDate(plan.week_start)
          dayDate.setDate(dayDate.getDate() + (dayNum - 1))
          const formattedDate = `${dayDate.getDate()} ${dayDate.toLocaleDateString('sv-SE', { month: 'short' })}`

          return (
            <MealPlanDayCard
              key={dayNum}
              dayName={DAY_NAMES[dayNum - 1]}
              date={formattedDate}
              entries={dayEntries}
              onSwap={setSwapEntry}
              onViewSuggestion={setViewEntry}
            />
          )
        })}
      </div>

      {/* Shopping list action bar */}
      {plan.id && hasEntries && (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            onClick={() => setShoppingDialogOpen(true)}
            className="shadow-lg"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            Lägg till i inköpslistan
          </Button>
        </div>
      )}

      <MealPlanShoppingDialog
        open={shoppingDialogOpen}
        onOpenChange={setShoppingDialogOpen}
        homeId={homeId}
        entries={plan.entries}
      />

      {/* Swap sheet */}
      <MealPlanSwapSheet
        open={swapEntry !== null}
        onOpenChange={(isOpen: boolean) => !isOpen && setSwapEntry(null)}
        onSwap={handleSwap}
        currentEntry={swapEntry}
        homeId={homeId}
      />

      {/* Suggestion detail sheet */}
      <MealPlanSuggestionSheet
        open={viewEntry !== null}
        onOpenChange={(isOpen: boolean) => !isOpen && setViewEntry(null)}
        entry={viewEntry}
        onSaved={(entryId, recipeId) => {
          onEntrySwapped(entryId, {
            recipe_id: recipeId,
            suggested_name: null,
            suggested_description: null,
            suggested_recipe: null,
            recipe_name: viewEntry?.suggested_recipe?.recipe_name,
          })
          setViewEntry(null)
        }}
      />
    </div>
  )
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
