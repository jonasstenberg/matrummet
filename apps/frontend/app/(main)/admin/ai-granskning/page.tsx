'use client'

import { useState, useRef, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ReviewDetail {
  foodName: string
  normalizedTo: string | null
  action: 'linked' | 'created' | 'rejected' | 'deleted'
  linkedToFoodId?: string
}

interface BatchResult {
  totalProcessed: number
  normalized: number
  created: number
  rejected: number
  deleted: number
  ingredientsUpdated: number
  recipesAffected: number
  details: ReviewDetail[]
  hasMore: boolean
  phase: 'foods' | 'orphans'
}

interface AccumulatedResults {
  totalProcessed: number
  normalized: number
  created: number
  rejected: number
  deleted: number
  ingredientsUpdated: number
  recipesAffected: number
  details: ReviewDetail[]
  batchesCompleted: number
}

export default function AIReviewPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<AccumulatedResults | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [phase, setPhase] = useState<'foods' | 'orphans' | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isAbortedRef = useRef(false)

  const processBatch = useCallback(
    async (accumulated: AccumulatedResults): Promise<AccumulatedResults | null> => {
      if (isAbortedRef.current) return null

      const response = await fetch('/api/admin/foods/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 50 }),
        signal: abortControllerRef.current?.signal,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte köra AI-granskning')
      }

      const batch: BatchResult = await response.json()

      // Accumulate results
      const newAccumulated: AccumulatedResults = {
        totalProcessed: accumulated.totalProcessed + batch.totalProcessed,
        normalized: accumulated.normalized + batch.normalized,
        created: accumulated.created + batch.created,
        rejected: accumulated.rejected + batch.rejected,
        deleted: accumulated.deleted + batch.deleted,
        ingredientsUpdated: accumulated.ingredientsUpdated + batch.ingredientsUpdated,
        recipesAffected: accumulated.recipesAffected + batch.recipesAffected,
        details: [...accumulated.details, ...batch.details],
        batchesCompleted: accumulated.batchesCompleted + 1,
      }

      setResults(newAccumulated)
      setCurrentBatch(newAccumulated.batchesCompleted)
      setPhase(batch.phase)

      // If more items exist, continue processing
      if (batch.hasMore && !isAbortedRef.current) {
        // Small delay between batches to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 500))
        return processBatch(newAccumulated)
      }

      return newAccumulated
    },
    []
  )

  async function handleStartReview() {
    try {
      setIsRunning(true)
      setError(null)
      setResults(null)
      setCurrentBatch(0)
      setPhase(null)
      isAbortedRef.current = false

      abortControllerRef.current = new AbortController()

      const initialAccumulated: AccumulatedResults = {
        totalProcessed: 0,
        normalized: 0,
        created: 0,
        rejected: 0,
        deleted: 0,
        ingredientsUpdated: 0,
        recipesAffected: 0,
        details: [],
        batchesCompleted: 0,
      }

      await processBatch(initialAccumulated)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled
        return
      }
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setIsRunning(false)
      setPhase(null)
      abortControllerRef.current = null
    }
  }

  function handleStopReview() {
    isAbortedRef.current = true
    abortControllerRef.current?.abort()
    setIsRunning(false)
  }

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">AI-granskning</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Låt AI granska väntande matvaror och länka ingredienser automatiskt.
        </p>
      </header>

      {/* Error message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Trigger section */}
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Starta AI-granskning</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AI:n normaliserar väntande matvaror, skapar nya vid behov, och uppdaterar
              ingredienser. Bearbetningen sker i omgångar om 50 st.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="lg" onClick={handleStartReview} disabled={isRunning} className="mt-2">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Granskar...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Starta AI-granskning
                </>
              )}
            </Button>
            {isRunning && (
              <Button size="lg" variant="outline" onClick={handleStopReview} className="mt-2">
                Avbryt
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Progress section */}
      {isRunning && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">
                  Bearbetar omgång {currentBatch + 1}...
                </p>
                <p className="text-sm text-muted-foreground">
                  {phase === 'foods' ? 'Granskar väntande matvaror' : 'Länkar föräldralösa ingredienser'}
                </p>
              </div>
            </div>

            {results && results.totalProcessed > 0 && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium">Hittills bearbetat:</p>
                <p className="text-2xl font-bold text-primary">{results.totalProcessed}</p>
                <p className="text-xs text-muted-foreground">
                  {results.batchesCompleted} omgång{results.batchesCompleted !== 1 ? 'ar' : ''} klara
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Results section */}
      {results && !isRunning && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">Resultat</h2>
          </div>

          {results.totalProcessed === 0 ? (
            <p className="text-muted-foreground">
              Inga väntande matvaror att bearbeta. Alla matvaror är redan granskade.
            </p>
          ) : (
            <>
              {/* Summary stats */}
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{results.normalized}</div>
                  <div className="text-sm text-muted-foreground">Normaliserade</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{results.created}</div>
                  <div className="text-sm text-muted-foreground">Nya matvaror</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">{results.rejected}</div>
                  <div className="text-sm text-muted-foreground">Avvisade</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600">{results.deleted}</div>
                  <div className="text-sm text-muted-foreground">Borttagna</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{results.ingredientsUpdated}</div>
                  <div className="text-sm text-muted-foreground">Ingredienser</div>
                </div>
              </div>

              <p className="mb-4 text-muted-foreground">
                Bearbetade {results.totalProcessed} objekt i {results.batchesCompleted} omgång
                {results.batchesCompleted !== 1 ? 'ar' : ''}.
                {results.ingredientsUpdated > 0 &&
                  ` Uppdaterade ${results.ingredientsUpdated} ingredienser.`}
              </p>

              {/* Collapsible details */}
              {results.details.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="details">
                    <AccordionTrigger>Visa detaljer ({results.details.length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="max-h-96 space-y-2 overflow-y-auto">
                        {results.details.map((d, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span>
                              &quot;{d.foodName}&quot;
                              {d.normalizedTo && (
                                <>
                                  {' '}
                                  &rarr; &quot;{d.normalizedTo}&quot;
                                </>
                              )}
                            </span>
                            <Badge
                              variant={
                                d.action === 'created'
                                  ? 'default'
                                  : d.action === 'linked'
                                    ? 'secondary'
                                    : d.action === 'deleted'
                                      ? 'outline'
                                      : 'destructive'
                              }
                            >
                              {d.action === 'created'
                                ? 'Skapad'
                                : d.action === 'linked'
                                  ? 'Länkad'
                                  : d.action === 'deleted'
                                    ? 'Borttagen'
                                    : 'Avvisad'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </>
          )}
        </Card>
      )}
    </>
  )
}
