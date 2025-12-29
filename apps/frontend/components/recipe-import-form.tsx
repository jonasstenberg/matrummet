'use client'

import { useState } from 'react'
import { importRecipeFromUrl, ImportRecipeResult } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CreateRecipeInput } from '@/lib/types'
import { ChevronDown, ChevronRight, Link, Loader2 } from 'lucide-react'

interface RecipeImportFormProps {
  onImport: (data: Partial<CreateRecipeInput>, lowConfidenceIndices?: number[]) => void
}

export function RecipeImportForm({ onImport }: RecipeImportFormProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(true)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()

    if (!url.trim()) return

    setIsLoading(true)
    setError(null)
    setWarnings([])

    const result: ImportRecipeResult = await importRecipeFromUrl(url.trim())

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Import misslyckades')
      return
    }

    if (result.warnings?.length) {
      setWarnings(result.warnings)
    }

    if (result.data) {
      onImport(result.data, result.lowConfidenceIngredients)
      setIsExpanded(false)
      setUrl('')
    }
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4" />
          <span className="font-medium">Importera recept från URL</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t px-4 pb-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Klistra in en URL till ett recept så försöker vi hämta receptdata
            automatiskt.
          </p>

          <form onSubmit={handleImport} className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/recept/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={!url.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importerar...
                </>
              ) : (
                'Importera'
              )}
            </Button>
          </form>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {warnings.length > 0 && (
            <Alert>
              <AlertDescription>
                <p className="font-medium">Importerad med varningar:</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {warnings.map((warning, i) => (
                    <li key={i} className="text-sm">
                      {warning}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Card>
  )
}
