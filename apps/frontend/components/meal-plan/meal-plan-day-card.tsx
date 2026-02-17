'use client'

import { MealPlanEntryCard } from './meal-plan-entry'
import type { MealPlanEntry } from '@/lib/meal-plan/types'

interface MealPlanDayCardProps {
  dayName: string
  date: string
  entries: MealPlanEntry[]
  onSwap: (entry: MealPlanEntry) => void
  onViewSuggestion: (entry: MealPlanEntry) => void
}

export function MealPlanDayCard({ dayName, date, entries, onSwap, onViewSuggestion }: MealPlanDayCardProps) {
  return (
    <div className="rounded-2xl bg-card shadow-(--shadow-card) overflow-hidden">
      <div className="px-5 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">{dayName} {date}</h3>
      </div>
      <div className="divide-y divide-border/30">
        {entries.map((entry) => (
          <MealPlanEntryCard
            key={entry.id}
            entry={entry}
            onSwap={() => onSwap(entry)}
            onViewSuggestion={entry.suggested_recipe ? () => onViewSuggestion(entry) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
