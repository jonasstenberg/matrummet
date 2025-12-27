'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CreateRecipeInput } from '@/lib/types'
import { ChevronDown, ChevronRight, Sparkles, Loader2, FileJson, ImageIcon, X } from 'lucide-react'

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
    {"group": "Pasta"},
    {"name": "spaghetti", "measurement": "g", "quantity": "400"},
    {"group": "Sås"},
    {"name": "guanciale", "measurement": "g", "quantity": "200"},
    {"name": "äggula", "measurement": "st", "quantity": "4"}
  ],
  "instructions": [
    {"group": "Förberedelse"},
    {"step": "Koka pastan enligt förpackningen."},
    {"group": "Sås"},
    {"step": "Stek guancialen tills den är krispig."}
  ]
}`

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB

export function RecipeParser({ onParse }: RecipeParserProps) {
  // AI parsing state
  const [aiText, setAiText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // JSON paste state
  const [jsonText, setJsonText] = useState('')

  // Image parsing state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageText, setImageText] = useState('')
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      // Validate ingredients structure (supports both group markers and regular ingredients)
      for (const ing of parsed.ingredients) {
        if ('group' in ing) {
          // Group marker - just needs a group name
          if (typeof ing.group !== 'string') {
            throw new Error('Ingrediensgrupp saknar namn')
          }
        } else {
          if (!ing.name) {
            throw new Error('Ingrediens saknar name')
          }
          // measurement and quantity can be empty strings (e.g., "efter smak")
          if (typeof ing.measurement !== 'string' || typeof ing.quantity !== 'string') {
            throw new Error(`Ingrediens "${ing.name}" saknar measurement eller quantity`)
          }
        }
      }

      // Validate instructions structure (supports both group markers and regular instructions)
      for (const inst of parsed.instructions) {
        if ('group' in inst) {
          // Group marker - just needs a group name
          if (typeof inst.group !== 'string') {
            throw new Error('Instruktionsgrupp saknar namn')
          }
        } else if (!inst.step) {
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

  function handleImageSelect(file: File) {
    setError(null)

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Ogiltig bildtyp. Tillåtna format: JPEG, PNG, WebP, GIF')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError('Bilden får vara max 10 MB')
      return
    }

    setImageFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleImageSelect(file)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleImageSelect(file)
    }
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleImageParse(e: React.FormEvent) {
    e.preventDefault()

    if (!imageFile) return

    setIsImageLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      if (imageText.trim()) {
        formData.append('text', imageText.trim())
      }

      const response = await fetch('/api/admin/gemini/parse', {
        method: 'POST',
        body: formData,
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
      clearImage()
      setImageText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tolkning misslyckades')
    } finally {
      setIsImageLoading(false)
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
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                AI-text
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center gap-2">
                <ImageIcon className="h-3 w-3" />
                AI-bild
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2">
                <FileJson className="h-3 w-3" />
                JSON
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

            <TabsContent value="image" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ladda upp en bild av ett recept (t.ex. från en kokbok eller tidning) och låt AI tolka det.
              </p>

              <form onSubmit={handleImageParse} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Receptbild</label>

                  {!imagePreview ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                        isDragging
                          ? 'border-primary bg-primary/5'
                          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                      }`}
                    >
                      <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Dra och släpp en bild här, eller klicka för att välja
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        JPEG, PNG, WebP, GIF (max 10 MB)
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Förhandsvisning"
                        className="max-h-64 rounded-lg object-contain"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={isImageLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="image-text" className="text-sm font-medium">
                    Extra information (valfritt)
                  </label>
                  <Textarea
                    id="image-text"
                    placeholder="T.ex. antal portioner, anpassningar..."
                    value={imageText}
                    onChange={(e) => setImageText(e.target.value)}
                    className="min-h-[80px]"
                    disabled={isImageLoading}
                  />
                </div>

                <Button type="submit" disabled={!imageFile || isImageLoading}>
                  {isImageLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Tolkar bild...
                    </>
                  ) : (
                    'Tolka recept från bild'
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
