'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { MealPlanGenerator } from './meal-plan-generator'
import { MealPlanWeekView } from './meal-plan-week-view'
import { getMealPlan } from '@/lib/meal-plan-actions'
import type { MealPlan, MealPlanEntry, MealPlanSummary } from '@/lib/meal-plan/types'

interface MealPlanClientProps {
  initialPlan: MealPlan | null
  planList: MealPlanSummary[]
  homeId?: string
  homeName?: string
}

export function MealPlanClient({ initialPlan, planList, homeId, homeName }: MealPlanClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { credits, setCredits } = useAuth()
  const [plan, setPlan] = useState<MealPlan | null>(initialPlan)
  const [isNavigating, setIsNavigating] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine which view to show based on URL
  const isGeneratorView = searchParams.get('view') === 'new'

  // Sync with server-fetched plan on back-navigation (initialPlan changes on re-render)
  useEffect(() => {
    setPlan(initialPlan)
  }, [initialPlan])

  async function handleGenerate(preferences: {
    week_start: string
    categories: string[]
    meal_types: string[]
    days: number[]
    servings: number
    max_suggestions: number
  }) {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: preferences.week_start,
          preferences: {
            categories: preferences.categories,
            meal_types: preferences.meal_types,
            days: preferences.days,
            servings: preferences.servings,
            max_suggestions: preferences.max_suggestions,
          },
          home_id: homeId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 402 || data.code === 'INSUFFICIENT_CREDITS') {
          throw new Error('Du har inga AI-poäng kvar. Köp fler i menyn.')
        }
        throw new Error(data.error || 'Kunde inte generera matplan')
      }

      const data = await response.json()

      if (typeof data.remainingCredits === 'number') {
        setCredits(data.remainingCredits)
      }

      // Build a plan object from the response
      const newPlan: MealPlan = {
        id: data.plan_id || '',
        name: 'Veckoplan',
        week_start: preferences.week_start,
        preferences: {
          categories: preferences.categories,
          meal_types: preferences.meal_types,
          servings: preferences.servings,
        },
        status: 'active',
        entries: data.entries.map((e: Omit<MealPlanEntry, 'id'>, i: number) => ({
          ...e,
          id: `temp-${i}`,
          servings: preferences.servings,
          sort_order: i,
        })),
      }

      setPlan(newPlan)
      // Remove the ?view=new param after successful generation (no history entry)
      const basePath = homeId ? `/hem/${homeId}/matplan` : '/matplan'
      router.replace(basePath)
      // Refresh server component cache so back-navigation preserves the plan
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleNavigate(planId: string) {
    setIsNavigating(true)
    try {
      const fetched = await getMealPlan(planId, homeId)
      if (fetched) {
        setPlan(fetched)
      }
    } catch (err) {
      console.error('Error navigating to plan:', err)
    } finally {
      setIsNavigating(false)
    }
  }

  function handleNewPlan() {
    setError(null)
    // Push ?view=new to URL to show generator view
    const basePath = homeId ? `/hem/${homeId}/matplan` : '/matplan'
    router.push(`${basePath}?view=new`)
  }

  function handleEntrySwapped(entryId: string, update: Partial<MealPlanEntry>) {
    if (!plan) return
    setPlan({
      ...plan,
      entries: plan.entries.map((e) =>
        e.id === entryId ? { ...e, ...update } : e,
      ),
    })
  }

  return (
    <div>
      <div className="space-y-1 mb-6">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Veckoplanerare
        </h1>
        {homeName && (
          <p className="text-sm text-muted-foreground">{homeName}</p>
        )}
      </div>

      {isGeneratorView || !plan ? (
        <MealPlanGenerator
          onGenerate={handleGenerate}
          isLoading={isGenerating}
          error={error}
          credits={credits}
        />
      ) : (
        <MealPlanWeekView
          plan={plan}
          homeId={homeId}
          planList={planList}
          isNavigating={isNavigating}
          onNavigate={handleNavigate}
          onNewPlan={handleNewPlan}
          onEntrySwapped={handleEntrySwapped}
        />
      )}
    </div>
  )
}
