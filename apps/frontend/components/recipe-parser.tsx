'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateRecipeInput } from '@/lib/types'
import { ChevronDown, ChevronRight, Sparkles, Loader2, FileJson } from 'lucide-react'

interface RecipeParserProps {
  onParse: (data: Partial<CreateRecipeInput>) => void
}

const JSON_EXAMPLE = `{
  "recipe_name": "Pasta Carbonara",
  "description": "Klassisk italiensk pastarätt",
  "author": null,
  "recipe_yield": "4",
  "recipe_yield_name": "portioner",
  "prep_time": 10,
  "cook_time": 20,
  "cuisine": "Italienskt",
  "categories": ["Huvudrätt", "Pasta"],
  "ingredients": [
    {"name": "spaghetti", "measurement": "g", "quantity": "400"},
    {"name": "guanciale", "measurement": "g", "quantity": "200"}
  ],
  "instructions": [
    {"step": "Koka pastan enligt förpackningen."},
    {"step": "Stek guancialen tills den är krispig."}
  ]
}`

export function RecipeParser({ onParse }: RecipeParserProps) {
  // AI parsing state
  const [aiText, setAiText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // JSON paste state
  const [jsonText, setJsonText] = useState('')

  // Shared state
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  async function handleAiParse(e: React.FormEvent) {
    e.preventDefault()

    if (!aiText.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/gemini/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: aiText.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const message = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Tolkning misslyckades'
        throw new Error(message)
      }

      const data = await response.json()
      onParse(data.recipe)
      setIsExpanded(false)
      setAiText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tolkning misslyckades')
    } finally {
      setIsLoading(false)
    }
  }

  function handleJsonParse(e: React.FormEvent) {
    e.preventDefault()

    if (!jsonText.trim()) return

    setError(null)

    try {
      const parsed = JSON.parse(jsonText.trim())

      // Basic validation
      if (!parsed.recipe_name || typeof parsed.recipe_name !== 'string') {
        throw new Error('recipe_name saknas eller är ogiltigt')
      }
      if (!parsed.description || typeof parsed.description !== 'string') {
        throw new Error('description saknas eller är ogiltigt')
      }
      if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
        throw new Error('ingredients saknas eller är tom')
      }
      if (!Array.isArray(parsed.instructions) || parsed.instructions.length === 0) {
        throw new Error('instructions saknas eller är tom')
      }

      // Validate ingredients structure
      for (const ing of parsed.ingredients) {
        if (!ing.name) {
          throw new Error('Ingrediens saknar name')
        }
        // measurement and quantity can be empty strings (e.g., "efter smak")
        if (typeof ing.measurement !== 'string' || typeof ing.quantity !== 'string') {
          throw new Error(`Ingrediens "${ing.name}" saknar measurement eller quantity`)
        }
      }

      // Validate instructions structure
      for (const inst of parsed.instructions) {
        if (!inst.step) {
          throw new Error('Instruktion saknar step')
        }
      }

      onParse(parsed)
      setIsExpanded(false)
      setJsonText('')
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Ogiltig JSON-syntax: ' + err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Ogiltigt format')
      }
    }
  }

  return (
    <Card className="bg-muted/50">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="font-medium">Importera recept</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t px-4 pb-4 pt-4">
          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                AI-tolkning
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2">
                <FileJson className="h-3 w-3" />
                Klistra in JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Klistra in recepttext i friformat och låt AI tolka och strukturera det.
              </p>

              <form onSubmit={handleAiParse} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="ai-text" className="text-sm font-medium">
                    Recepttext
                  </label>
                  <Textarea
                    id="ai-text"
                    placeholder="Klistra in recept här..."
                    value={aiText}
                    onChange={(e) => {
                      setAiText(e.target.value)
                      setError(null)
                    }}
                    className="min-h-[200px]"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!aiText.trim() || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tolkar...
                    </>
                  ) : (
                    'Tolka recept'
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="json" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Klistra in JSON som matchar receptformatet.
              </p>

              <form onSubmit={handleJsonParse} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="json-text" className="text-sm font-medium">
                    JSON
                  </label>
                  <Textarea
                    id="json-text"
                    placeholder={JSON_EXAMPLE}
                    value={jsonText}
                    onChange={(e) => {
                      setJsonText(e.target.value)
                      setError(null)
                    }}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                <Button type="submit" disabled={!jsonText.trim()}>
                  Importera
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </Card>
  )
}
