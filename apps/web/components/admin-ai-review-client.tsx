import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Check,
} from '@/lib/icons'

// ── Types ──────────────────────────────────────────────────────────────

interface AiReviewRun {
  id: string
  started_at: string
  completed_at: string | null
  run_by: string | null
  status: 'running' | 'pending_approval' | 'applied' | 'partially_applied' | 'failed'
  total_processed: number
  summary: { alias?: number; create?: number; reject?: number; delete?: number }
}

interface AiReviewSuggestion {
  id: string
  run_id: string
  food_id: string
  food_name: string
  suggested_action: 'alias' | 'create' | 'reject' | 'delete'
  target_food_id: string | null
  target_food_name: string | null
  extracted_unit: string | null
  extracted_quantity: number | null
  ai_reasoning: string
  status: 'pending' | 'approved' | 'rejected' | 'applied' | 'skipped'
  ingredient_count: number
}

type Decision = 'approve_alias' | 'approve_new' | 'reject_food' | 'delete_food' | 'skip'

interface StreamProgress {
  processed: number
  suggestions: number
  total: number
}

// ── SSE helper ──────────────────────────────────────────────────────────

async function consumeSSE(
  url: string,
  body: unknown,
  handlers: {
    onStarted: (data: { runId: string; total: number }) => void
    onBatch: (data: { processed: number; suggestions: number }) => void
    onDone: () => void
    onError: (message: string) => void
  }
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Kunde inte starta granskning')
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    let eventType = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7)
      } else if (line.startsWith('data: ') && eventType) {
        try {
          const data = JSON.parse(line.slice(6))
          switch (eventType) {
            case 'started':
              handlers.onStarted(data)
              break
            case 'batch':
              handlers.onBatch(data)
              break
            case 'done':
              handlers.onDone()
              break
            case 'error':
              handlers.onError(data.message || 'Granskningen misslyckades')
              break
          }
        } catch {
          // ignore parse errors
        }
        eventType = ''
      }
    }
  }
}

// ── Action config per suggestion type ───────────────────────────────────

interface ActionOption {
  decision: Decision
  label: string
  variant: 'primary' | 'secondary' | 'muted'
}

const ACTIONS_BY_TYPE: Record<string, ActionOption[]> = {
  alias: [
    { decision: 'approve_alias', label: 'Länka', variant: 'primary' },
    { decision: 'approve_new', label: 'Ny matvara', variant: 'secondary' },
    { decision: 'skip', label: 'Hoppa över', variant: 'muted' },
  ],
  create: [
    { decision: 'approve_new', label: 'Godkänn', variant: 'primary' },
    { decision: 'approve_alias', label: 'Alias', variant: 'secondary' },
    { decision: 'skip', label: 'Hoppa över', variant: 'muted' },
  ],
  delete: [
    { decision: 'delete_food', label: 'Ta bort', variant: 'primary' },
    { decision: 'approve_new', label: 'Behåll', variant: 'secondary' },
    { decision: 'skip', label: 'Hoppa över', variant: 'muted' },
  ],
  reject: [
    { decision: 'reject_food', label: 'Avvisa', variant: 'primary' },
    { decision: 'approve_new', label: 'Behåll', variant: 'secondary' },
    { decision: 'skip', label: 'Hoppa över', variant: 'muted' },
  ],
}

/** The default (AI-recommended) decision for a suggestion type */
function defaultDecision(action: string): Decision {
  return ACTIONS_BY_TYPE[action]?.[0]?.decision ?? 'skip'
}

const GROUP_LABELS: Record<string, string> = {
  alias: 'Alias',
  create: 'Nya matvaror',
  reject: 'Avvisa',
  delete: 'Ta bort',
}

const GROUP_DESCRIPTIONS: Record<string, string> = {
  alias: '"Länka" gör att varianten (t.ex. "hackad lök") behandlas som samma matvara (t.ex. "Lök"). Har du matvaran i skafferiet matchar den automatiskt.',
  create: 'Nya unika matvaror. "Godkänn" lägger till dem i databasen. "Alias" länkar dem till en befintlig matvara istället.',
  reject: 'Ogiltiga namn (skräptext). "Avvisa" markerar dem som avvisade.',
  delete: 'Oanvända matvaror utan ingredienser. "Ta bort" raderar dem permanent.',
}

const EXPLANATION_STEPS = [
  {
    title: 'Normaliserar namn',
    description: 'Tar bort tillagningsinstruktioner, t.ex. "hackad lök" blir "Lök".',
  },
  {
    title: 'Föreslår alias',
    description: 'Om en matvara redan finns godkänd föreslås varianten som alias.',
  },
  {
    title: 'Skapar nya matvaror',
    description: 'Om inget matchande livsmedel finns föreslås det som ny matvara.',
  },
  {
    title: 'Du bestämmer',
    description: 'Inget ändras förrän du granskar och godkänner förslagen.',
  },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Action button styles ────────────────────────────────────────────────

function actionButtonClass(variant: 'primary' | 'secondary' | 'muted', isActive: boolean): string {
  if (!isActive) return 'border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
  switch (variant) {
    case 'primary':
      return 'border-transparent bg-foreground text-background'
    case 'secondary':
      return 'border-transparent bg-foreground/80 text-background'
    case 'muted':
      return 'border-transparent bg-foreground/10 text-foreground'
  }
}

// ── Inline food search ─────────────────────────────────────────────────

interface AliasTarget {
  id: string
  name: string
}

function FoodSearch({
  onSelect,
  onClear,
  selected,
}: {
  onSelect: (food: AliasTarget) => void
  onClear: () => void
  selected: AliasTarget | null
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AliasTarget[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSearch(value: string) {
    setQuery(value)
    clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/ai-review/foods?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(data.length > 0)
        }
      } catch {
        // ignore
      }
    }, 250)
  }

  if (selected) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
        &rarr; {selected.name}
        <button
          onClick={onClear}
          className="ml-0.5 rounded px-1 text-[10px] hover:bg-muted"
        >
          &times;
        </button>
      </span>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Sök matvara..."
        className="h-6 w-36 rounded border border-border/60 bg-background px-2 text-[11px] placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute top-7 left-0 z-50 max-h-40 w-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {results.map(food => (
            <button
              key={food.id}
              onClick={() => {
                onSelect(food)
                setQuery('')
                setResults([])
                setOpen(false)
              }}
              className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted"
            >
              {food.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────

interface AdminAIReviewClientProps {
  pendingCount: number
}

export function AdminAIReviewClient({ pendingCount }: AdminAIReviewClientProps) {
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<AiReviewRun | null>(null)
  const [suggestions, setSuggestions] = useState<AiReviewSuggestion[]>([])
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [loaded, setLoaded] = useState(false)
  const [streaming, setStreaming] = useState<StreamProgress | null>(null)
  const [livePendingCount, setLivePendingCount] = useState(pendingCount)
  const [aliasTargets, setAliasTargets] = useState<Record<string, AliasTarget>>({})

  // Load latest run + pending count from DB
  const loadLatestRun = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ai-review/runs')
      if (!res.ok) return
      const data = await res.json()
      setRun(data.run)
      setSuggestions(data.suggestions ?? [])
      if (typeof data.pendingCount === 'number') setLivePendingCount(data.pendingCount)
    } catch {
      // ignore
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadLatestRun()
  }, [loadLatestRun])

  // Poll while run is 'running' but no active SSE (page reload case)
  useEffect(() => {
    if (!run || run.status !== 'running' || streaming) return
    const interval = setInterval(loadLatestRun, 3000)
    return () => clearInterval(interval)
  }, [run?.status, run?.id, streaming, loadLatestRun])

  // Start review via SSE
  async function handleStartReview() {
    setError(null)
    setDecisions({})
    setAliasTargets({})
    setStreaming({ processed: 0, suggestions: 0, total: 0 })

    try {
      await consumeSSE('/api/admin/ai-review/stream', {}, {
        onStarted({ runId, total }) {
          setStreaming({ processed: 0, suggestions: 0, total })
          setRun({
            id: runId,
            started_at: new Date().toISOString(),
            completed_at: null,
            run_by: null,
            status: 'running',
            total_processed: 0,
            summary: {},
          })
        },
        onBatch({ processed, suggestions }) {
          setStreaming(prev => prev ? { ...prev, processed, suggestions } : null)
        },
        async onDone() {
          setStreaming(null)
          await loadLatestRun()
        },
        async onError(message) {
          setStreaming(null)
          setError(message)
          await loadLatestRun()
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      await loadLatestRun()
    } finally {
      setStreaming(null)
    }
  }

  function setDecision(id: string, decision: Decision) {
    setDecisions(prev => ({ ...prev, [id]: decision }))
  }

  function clearDecision(id: string) {
    setDecisions(prev => {
      const { [id]: _removed, ...rest } = prev
      void _removed
      return rest
    })
    setAliasTargets(prev => {
      if (!prev[id]) return prev
      const { [id]: _removed, ...rest } = prev
      void _removed
      return rest
    })
  }

  // Bulk: set the AI-recommended action for all pending in a group
  function bulkAcceptGroup(action: string) {
    const pending = suggestions.filter(
      s => s.status === 'pending' && s.suggested_action === action
    )
    const decision = defaultDecision(action)
    setDecisions(prev => {
      const next = { ...prev }
      for (const s of pending) next[s.id] = decision
      return next
    })
  }

  function acceptAll() {
    const pending = suggestions.filter(s => s.status === 'pending')
    setDecisions(prev => {
      const next = { ...prev }
      for (const s of pending) next[s.id] = defaultDecision(s.suggested_action)
      return next
    })
  }

  async function handleApply() {
    if (!run) return

    // Check for alias decisions missing a target
    const missingTarget = Object.entries(decisions).some(([id, action]) => {
      if (action !== 'approve_alias') return false
      const suggestion = suggestions.find(s => s.id === id)
      return !suggestion?.target_food_id && !aliasTargets[id]
    })
    if (missingTarget) {
      setError('Välj en matvara att länka till för alla alias-beslut.')
      return
    }

    const decisionList = Object.entries(decisions).map(([id, action]) => {
      const entry: { id: string; action: string; targetFoodId?: string; targetFoodName?: string } = { id, action }
      if (action === 'approve_alias' && aliasTargets[id]) {
        entry.targetFoodId = aliasTargets[id].id
        entry.targetFoodName = aliasTargets[id].name
      }
      return entry
    })
    if (decisionList.length === 0) return

    try {
      setIsApplying(true)
      setError(null)

      const res = await fetch(`/api/admin/ai-review/runs/${run.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: decisionList }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kunde inte tillämpa ändringar')
      }

      setDecisions({})
      setAliasTargets({})
      await loadLatestRun()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsApplying(false)
    }
  }

  // Derived state
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending')
  const appliedSuggestions = suggestions.filter(s => s.status === 'applied' || s.status === 'rejected' || s.status === 'skipped')
  const isRunning = !!streaming || run?.status === 'running'
  const hasPendingRun = run?.status === 'pending_approval' && pendingSuggestions.length > 0
  const isCompleted = run?.status === 'applied' || run?.status === 'partially_applied'
  const isFailed = run?.status === 'failed'
  const decisionCount = Object.keys(decisions).length

  // Count decisions by type for the summary bar
  const decisionSummary = Object.values(decisions).reduce(
    (acc, d) => {
      if (d === 'approve_alias') acc.alias++
      else if (d === 'approve_new') acc.approve++
      else if (d === 'delete_food') acc.delete++
      else if (d === 'reject_food') acc.reject++
      else if (d === 'skip') acc.skip++
      return acc
    },
    { alias: 0, approve: 0, delete: 0, reject: 0, skip: 0 }
  )

  function groupByAction(items: AiReviewSuggestion[]) {
    const groups: { action: string; items: AiReviewSuggestion[] }[] = []
    for (const action of ['alias', 'create', 'reject', 'delete'] as const) {
      const matched = items.filter(s => s.suggested_action === action)
      if (matched.length > 0) groups.push({ action, items: matched })
    }
    return groups
  }

  if (!loaded) return null

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          AI-granskning
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Städar upp matvarudatabasen automatiskt.
        </p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Explanation */}
      <div className="rounded-2xl bg-card p-6 shadow-(--shadow-card)">
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground/60" />
          <h2 className="text-sm font-semibold">Hur fungerar det?</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPLANATION_STEPS.map((step, i) => (
            <div key={i} className="rounded-xl bg-muted/30 p-3">
              <p className="text-[13px] font-medium text-foreground">{step.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground/80">
          Ingen recepttext ändras. Granskningen rör bara den interna matvarudatabasen.
        </p>
      </div>

      {/* Last completed run info */}
      {run && isCompleted && (
        <div className="rounded-xl bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground/60" />
            <span className="font-medium">Senaste granskning:</span>
            <span className="text-muted-foreground">
              {run.completed_at ? formatDate(run.completed_at) : formatDate(run.started_at)}
            </span>
          </div>
          {run.summary && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(run.summary).map(
                ([key, count]) =>
                  count > 0 && (
                    <span
                      key={key}
                      className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {GROUP_LABELS[key] ?? key}: {String(count)}
                    </span>
                  )
              )}
            </div>
          )}
        </div>
      )}

      {/* Running state */}
      {isRunning && (
        <div className="rounded-2xl bg-card p-8 shadow-(--shadow-card)">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-2xl bg-muted p-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/60" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Granskning pågår...</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                AI analyserar matvaror i bakgrunden. Du kan ladda om sidan utan att förlora framsteg.
              </p>
              {streaming && streaming.total > 0 && (
                <div className="mt-3">
                  <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/20 transition-all duration-500"
                      style={{ width: `${Math.round((streaming.processed / streaming.total) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {streaming.processed} / {streaming.total} analyserade
                    {streaming.suggestions > 0 && <> &middot; {streaming.suggestions} förslag</>}
                  </p>
                </div>
              )}
              {!streaming && run && run.total_processed > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {run.total_processed} analyserade
                  {suggestions.length > 0 && <> &middot; {suggestions.length} förslag hittills</>}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start new run */}
      {!hasPendingRun && !isRunning && (
        <div className="rounded-2xl bg-card p-8 shadow-(--shadow-card)">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-2xl bg-muted p-4">
              <Sparkles className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Starta granskning</h2>
              {isFailed && (
                <p className="mx-auto mt-1 max-w-md text-sm text-red-600 dark:text-red-400">
                  Senaste granskningen misslyckades. Du kan starta en ny.
                </p>
              )}
              {livePendingCount > 0 ? (
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{livePendingCount} matvaror</span>{' '}
                  väntar på granskning. AI analyserar och ger dig förslag att godkänna.
                </p>
              ) : (
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Alla matvaror är redan granskade.
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={handleStartReview}
              disabled={livePendingCount === 0}
              className="mt-2"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Starta granskning
            </Button>
          </div>
        </div>
      )}

      {/* Review suggestions */}
      {hasPendingRun && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="rounded-2xl bg-card p-6 shadow-(--shadow-card)">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Granska förslag</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  AI har analyserat {run.total_processed} matvaror och genererat{' '}
                  {pendingSuggestions.length} förslag. Välj åtgärd per rad — AI:s rekommendation visas
                  först.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={acceptAll}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Acceptera alla
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['alias', 'create', 'reject', 'delete'] as const).map(action => {
                const count = pendingSuggestions.filter(s => s.suggested_action === action).length
                if (count === 0) return null
                return (
                  <button
                    key={action}
                    onClick={() => bulkAcceptGroup(action)}
                    className="rounded-xl bg-muted/30 p-3 text-center transition-colors hover:bg-muted/50"
                  >
                    <div className="text-2xl font-bold text-foreground">{count}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {GROUP_LABELS[action]}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grouped suggestions */}
          {groupByAction(pendingSuggestions).map(({ action, items }) => (
            <div key={action} className="rounded-2xl bg-card shadow-(--shadow-card)">
              <div className="border-b border-border/40 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    {GROUP_LABELS[action]} ({items.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => bulkAcceptGroup(action)}
                  >
                    Acceptera alla
                  </Button>
                </div>
                {GROUP_DESCRIPTIONS[action] && (
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    {GROUP_DESCRIPTIONS[action]}
                  </p>
                )}
              </div>
              <div className="max-h-[28rem] divide-y divide-border/40 overflow-y-auto">
                {items.map(s => {
                  const currentDecision = decisions[s.id]
                  const options = ACTIONS_BY_TYPE[s.suggested_action] ?? []
                  const needsAliasTarget =
                    currentDecision === 'approve_alias' && !s.target_food_id
                  const aliasTarget = aliasTargets[s.id] ?? null

                  return (
                    <div key={s.id} className="px-6 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5 text-sm">
                            <span className="font-medium">{s.food_name}</span>
                            {s.target_food_name && !needsAliasTarget && (
                              <span className="text-muted-foreground">
                                &rarr; {s.target_food_name}
                              </span>
                            )}
                            {needsAliasTarget && (
                              <FoodSearch
                                selected={aliasTarget}
                                onSelect={food =>
                                  setAliasTargets(prev => ({ ...prev, [s.id]: food }))
                                }
                                onClear={() =>
                                  setAliasTargets(prev => {
                                    const { [s.id]: _removed, ...rest } = prev
                                    void _removed
                                    return rest
                                  })
                                }
                              />
                            )}
                          </div>
                          <p className="mt-0.5 text-[12px] text-muted-foreground/70">
                            {s.ai_reasoning}
                            {s.ingredient_count > 0 && (
                              <> &middot; {s.ingredient_count} ingrediens{s.ingredient_count !== 1 ? 'er' : ''}</>
                            )}
                            {s.extracted_unit && <> &middot; enhet: {s.extracted_unit}</>}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {options.map(opt => (
                            <button
                              key={opt.decision}
                              onClick={() =>
                                currentDecision === opt.decision
                                  ? clearDecision(s.id)
                                  : setDecision(s.id, opt.decision)
                              }
                              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${actionButtonClass(opt.variant, currentDecision === opt.decision)}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Apply button bar */}
          {decisionCount > 0 && (
            <div className="sticky bottom-4 rounded-2xl border border-border/60 bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {decisionSummary.alias > 0 && (
                    <span><span className="font-medium text-emerald-700 dark:text-emerald-400">{decisionSummary.alias}</span> alias</span>
                  )}
                  {decisionSummary.approve > 0 && (
                    <span><span className="font-medium text-emerald-700 dark:text-emerald-400">{decisionSummary.approve}</span> godkänn</span>
                  )}
                  {decisionSummary.delete > 0 && (
                    <span><span className="font-medium text-red-700 dark:text-red-400">{decisionSummary.delete}</span> ta bort</span>
                  )}
                  {decisionSummary.reject > 0 && (
                    <span><span className="font-medium text-red-700 dark:text-red-400">{decisionSummary.reject}</span> avvisa</span>
                  )}
                  {decisionSummary.skip > 0 && (
                    <span><span className="font-medium">{decisionSummary.skip}</span> hoppa över</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDecisions({})}
                    disabled={isApplying}
                  >
                    Rensa
                  </Button>
                  <Button size="sm" onClick={handleApply} disabled={isApplying}>
                    {isApplying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Tillämpar...
                      </>
                    ) : (
                      `Tillämpa (${decisionCount})`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Applied results */}
      {appliedSuggestions.length > 0 && !hasPendingRun && run && (
        <div className="rounded-2xl bg-card p-6 shadow-(--shadow-card)">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Senaste resultat</h2>
          </div>
          <div className="max-h-96 divide-y divide-border/40 overflow-y-auto rounded-xl border border-border/40">
            {appliedSuggestions.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span>
                  {s.food_name}
                  {s.target_food_name && (
                    <span className="text-muted-foreground"> &rarr; {s.target_food_name}</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === 'applied' ? 'secondary' : s.status === 'skipped' ? 'outline' : 'destructive'}>
                    {s.status === 'skipped' ? 'Hoppades över' : s.status === 'rejected' ? 'Avvisad' : GROUP_LABELS[s.suggested_action] ?? s.suggested_action}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
