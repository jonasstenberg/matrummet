'use client'

import { useState, useEffect, useRef } from 'react'
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

interface Model {
  name: string
  size: number
  modified_at: string
}

interface StreamProgress {
  type: 'progress'
  text: string
  fullText: string
}

interface StreamComplete {
  type: 'complete'
  recipe: Partial<CreateRecipeInput>
}

interface StreamError {
  type: 'error'
  error: string
}

type StreamChunk = StreamProgress | StreamComplete | StreamError

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
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const streamingRef = useRef<HTMLDivElement>(null)

  // JSON paste state
  const [jsonText, setJsonText] = useState('')

  // Shared state
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/admin/ollama/models')
        if (!response.ok) {
          throw new Error('Kunde inte hämta modeller')
        }
        const data = await response.json()
        setModels(data.models || [])
        if (data.models?.length > 0) {
          setSelectedModel(data.models[0].name)
        }
      } catch (err) {
        // Don't set error here - just log it, AI tab might not be usable
        console.error('Failed to fetch models:', err)
      } finally {
        setIsLoadingModels(false)
      }
    }

    fetchModels()
  }, [])

  // Auto-scroll the streaming output
  useEffect(() => {
    if (streamingRef.current) {
      streamingRef.current.scrollTop = streamingRef.current.scrollHeight
    }
  }, [streamingText])

  async function handleAiParse(e: React.FormEvent) {
    e.preventDefault()

    if (!aiText.trim() || !selectedModel) return

    setIsLoading(true)
    setError(null)
    setStreamingText('')

    try {
      const response = await fetch('/api/admin/ollama/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: aiText.trim(),
          model: selectedModel,
          stream: true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Tolkning misslyckades')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())

        for (const line of lines) {
          try {
            const data: StreamChunk = JSON.parse(line)

            if (data.type === 'progress') {
              setStreamingText(data.fullText)
            } else if (data.type === 'complete') {
              onParse(data.recipe)
              setIsExpanded(false)
              setAiText('')
              setStreamingText('')
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          } catch (parseError) {
            // If it's a JSON parse error, ignore (incomplete chunk)
            // If it's our thrown error, rethrow
            if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
              throw parseError
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tolkning misslyckades')
      setStreamingText('')
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

              {isLoadingModels ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Laddar modeller...
                </div>
              ) : models.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Kunde inte ansluta till AI-tjänsten. Prova att klistra in JSON istället.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleAiParse} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="model" className="text-sm font-medium">
                      Modell
                    </label>
                    <select
                      id="model"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isLoading}
                    >
                      {models.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>

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
                    disabled={!aiText.trim() || !selectedModel || isLoading}
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
              )}

              {/* Streaming output display */}
              {streamingText && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI genererar...
                  </div>
                  <div
                    ref={streamingRef}
                    className="max-h-[300px] overflow-y-auto rounded-md border bg-background p-3 font-mono text-xs"
                  >
                    <pre className="whitespace-pre-wrap break-words">{streamingText}</pre>
                  </div>
                </div>
              )}
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
