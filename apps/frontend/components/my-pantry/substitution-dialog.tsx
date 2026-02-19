'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from '@/lib/icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { IngredientSubstitution } from '@/lib/ingredient-search-types'
import { getSubstitutionSuggestions } from '@/lib/ingredient-search-actions'

interface SubstitutionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipeId: string
  recipeName: string
  missingFoodIds: string[]
  missingFoodNames: string[]
  availableFoodIds: string[]
}

export function SubstitutionDialog({
  open,
  onOpenChange,
  recipeId,
  recipeName,
  missingFoodIds,
  missingFoodNames,
  availableFoodIds,
}: SubstitutionDialogProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [substitutions, setSubstitutions] = useState<IngredientSubstitution[]>([])

  useEffect(() => {
    if (!open) return

    async function fetchSubstitutions() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getSubstitutionSuggestions(
          recipeId,
          missingFoodIds,
          availableFoodIds
        )

        if ('error' in result) {
          setError(result.error)
        } else {
          setSubstitutions(result.substitutions)
        }
      } catch (err) {
        console.error('Error fetching substitutions:', err)
        setError('Kunde inte hämta ersättningsförslag')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubstitutions()
  }, [open, recipeId, missingFoodIds, availableFoodIds])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ersättningsförslag</DialogTitle>
          <DialogDescription>
            Förslag på ersättningar för ingredienser som saknas i {recipeName}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Hämtar förslag...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && substitutions.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <p>Inga ersättningsförslag tillgängliga</p>
            </div>
          )}

          {!isLoading && !error && substitutions.length > 0 && (
            <div className="space-y-6">
              {substitutions.map((item, index) => (
                <div key={item.original_food_id} className="space-y-3">
                  <h3 className="font-medium text-foreground">
                    {missingFoodNames[index] || item.original_name}
                  </h3>

                  {item.suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Inga ersättningar hittades
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {item.suggestions.map((suggestion, suggIndex) => (
                        <li
                          key={suggIndex}
                          className={cn(
                            'rounded-lg border p-3',
                            suggestion.available
                              ? 'border-green-200 bg-green-50'
                              : 'border-border bg-card'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{suggestion.substitute_name}</span>
                                {suggestion.available && (
                                  <span className="flex items-center gap-1 text-xs text-green-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Har
                                  </span>
                                )}
                              </div>
                              {suggestion.notes && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {suggestion.notes}
                                </p>
                              )}
                            </div>
                            <ConfidenceBadge confidence={suggestion.confidence} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const variants: Record<typeof confidence, { label: string; className: string }> = {
    high: {
      label: 'Hög',
      className: 'bg-green-100 text-green-700 border-green-200',
    },
    medium: {
      label: 'Medel',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
    low: {
      label: 'Låg',
      className: 'bg-orange-100 text-orange-700 border-orange-200',
    },
  }

  const variant = variants[confidence]

  return (
    <Badge variant="outline" className={cn('text-xs', variant.className)}>
      {variant.label}
    </Badge>
  )
}
