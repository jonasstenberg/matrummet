
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CategorySelector } from '@/components/category-selector'
import { Sparkles, Loader2, Minus, Plus, Calendar as CalendarIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { MEAL_TYPE_PRESETS, ALL_DAYS } from '@/lib/meal-plan/types'

const DAY_LABELS_SHORT = ['M', 'Ti', 'O', 'To', 'F', 'L', 'S'] as const
const DAY_LABELS_LONG = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'] as const

const LOADING_MESSAGES = [
  'Analyserar dina recept...',
  'Planerar veckans måltider...',
  'Skapar nya receptförslag...',
  'Balanserar variation och smak...',
  'Nästan klart...',
]

const PREFERENCE_CATEGORY_GROUPS = ['Kost', 'Kök', 'Egenskap']

function toMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function getNextMonday(): Date {
  const now = new Date()
  now.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
  return toMonday(now)
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatWeekLabel(date: Date): string {
  const end = new Date(date)
  end.setDate(end.getDate() + 6)
  return `${format(date, 'd MMM', { locale: sv })} – ${format(end, 'd MMM', { locale: sv })}`
}

interface MealPlanGeneratorProps {
  onGenerate: (preferences: {
    week_start: string
    categories: string[]
    meal_types: string[]
    days: number[]
    servings: number
    max_suggestions: number
  }) => void
  isLoading: boolean
  error: string | null
  credits: number | null
}

const ALL_DAYS_ARRAY = [...ALL_DAYS]

export function MealPlanGenerator({
  onGenerate,
  isLoading,
  error,
  credits,
}: MealPlanGeneratorProps) {
  const [categories, setCategories] = useLocalStorage<string[]>('meal-plan-categories', [])
  const [servings, setServings] = useLocalStorage('meal-plan-servings', 4)
  const [days, setDays] = useLocalStorage<number[]>('meal-plan-days', ALL_DAYS_ARRAY)
  const [mealPreset, setMealPreset] = useState('dinner_only')
  const [weekStart, setWeekStart] = useState<Date>(getNextMonday)
  const [maxSuggestions, setMaxSuggestions] = useState(3)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Progressive loading messages
  useEffect(() => {
    if (!isLoading) {
      setLoadingMessageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setLoadingMessageIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1))
    }, 5000)
    return () => clearInterval(interval)
  }, [isLoading])

  const selectedPreset = MEAL_TYPE_PRESETS.find((p) => p.id === mealPreset)
  const mealTypes = selectedPreset?.types || ['middag']
  const totalEntries = days.length * mealTypes.length
  const effectiveMaxSuggestions = Math.min(maxSuggestions, totalEntries)

  function toggleDay(day: number) {
    setDays((prev) => {
      if (prev.includes(day)) {
        // Don't allow deselecting all days
        if (prev.length <= 1) return prev
        return prev.filter((d) => d !== day)
      }
      return [...prev, day].sort()
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onGenerate({
      week_start: toDateString(weekStart),
      categories,
      meal_types: [...mealTypes],
      days: [...days],
      servings,
      max_suggestions: effectiveMaxSuggestions,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Week picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild disabled={isLoading}>
          <button
            type="button"
            className="w-full rounded-2xl bg-card shadow-(--shadow-card) overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <span className="text-[15px] font-medium">Vecka</span>
                  <p className="text-xs text-muted-foreground">{formatWeekLabel(weekStart)}</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {format(weekStart, 'd MMM yyyy', { locale: sv })}
              </span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={weekStart}
            onSelect={(date) => {
              if (date) {
                setWeekStart(toMonday(date))
                setCalendarOpen(false)
              }
            }}
            defaultMonth={weekStart}
          />
        </PopoverContent>
      </Popover>

      {/* Grouped settings card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card) overflow-hidden divide-y divide-border/40">
        {/* Day selection */}
        <div className="px-5 py-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dagar
          </span>
          <div className="flex gap-1.5 mt-3">
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                disabled={isLoading}
                className={cn(
                  'flex-1 h-9 rounded-full text-sm font-medium transition-all',
                  days.includes(day)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70',
                )}
              >
                <span className="sm:hidden">{DAY_LABELS_SHORT[day - 1]}</span>
                <span className="hidden sm:inline">{DAY_LABELS_LONG[day - 1]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category preferences (Kost, Kök, Egenskap) */}
        <div className="px-5 py-4">
          <CategorySelector
            selectedCategories={categories}
            onChange={setCategories}
            groups={PREFERENCE_CATEGORY_GROUPS}
            disabled={isLoading}
          />
        </div>

        {/* Meal types */}
        <div className="px-5 py-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Måltider
          </span>
          <div className="flex flex-wrap gap-2 mt-3">
            {MEAL_TYPE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setMealPreset(preset.id)}
                disabled={isLoading}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
                  mealPreset === preset.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/70',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Servings — inline stepper row */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-[15px] font-medium">Portioner</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              disabled={isLoading || servings <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 transition-colors hover:bg-muted disabled:opacity-30"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-lg font-semibold tabular-nums">
              {servings}
            </span>
            <button
              type="button"
              onClick={() => setServings((s) => Math.min(12, s + 1))}
              disabled={isLoading || servings >= 12}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 transition-colors hover:bg-muted disabled:opacity-30"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI suggestions — inline stepper row with description */}
        <div className="px-5 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium">Nya AI-förslag</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMaxSuggestions((s) => Math.max(0, s - 1))}
                disabled={isLoading || maxSuggestions <= 0}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-6 text-center text-lg font-semibold tabular-nums">
                {effectiveMaxSuggestions}
              </span>
              <button
                type="button"
                onClick={() => setMaxSuggestions((s) => Math.min(totalEntries, s + 1))}
                disabled={isLoading || effectiveMaxSuggestions >= totalEntries}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {effectiveMaxSuggestions === 0
              ? 'Alla måltider väljs från dina befintliga recept.'
              : effectiveMaxSuggestions >= totalEntries
                ? 'Alla måltider blir nya AI-förslag.'
                : `AI föreslår ${effectiveMaxSuggestions} nya rätter, resten väljs från dina recept.`}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Generate button */}
      <div className="pt-2 space-y-3 flex flex-col items-center">
        <Button
          type="submit"
          disabled={isLoading || !credits}
          size="lg"
          className="bg-warm text-warm-foreground hover:bg-warm/90 h-12 px-8 text-[15px] rounded-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {LOADING_MESSAGES[loadingMessageIndex]}
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generera veckoplan
              <span className="ml-2 text-xs opacity-70">1 poäng</span>
            </>
          )}
        </Button>

        {credits !== null && (
          <p className="text-center text-xs text-muted-foreground">
            {credits} AI-poäng kvar
          </p>
        )}
      </div>
    </form>
  )
}
