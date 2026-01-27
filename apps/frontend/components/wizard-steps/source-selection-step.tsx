"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CreateRecipeInput } from "@/lib/types"
import { importRecipeFromUrl, ImportRecipeResult } from "@/lib/actions"
import {
  Link,
  Sparkles,
  PenLine,
  Loader2,
  ImageIcon,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRef } from "react"

type ImportData = Partial<CreateRecipeInput> | {
  recipe_name?: string
  description?: string
  author?: string | null
  recipe_yield?: string | number | null
  recipe_yield_name?: string | null
  prep_time?: number | null
  cook_time?: number | null
  cuisine?: string | null
  categories?: string[]
  ingredient_groups?: Array<{
    group_name?: string
    ingredients: Array<{
      name: string
      measurement: string
      quantity: string
    }>
  }>
  instruction_groups?: Array<{
    group_name?: string
    instructions: Array<{ step: string }>
  }>
}

type SelectedOption = null | "url" | "ai"

interface SourceSelectionStepProps {
  onImport: (data: ImportData, lowConfidenceIndices?: number[], originalPrompt?: string) => void
  onStartBlank: () => void
  credits: number | null
  selectedOption: SelectedOption
  onOptionChange: (option: SelectedOption) => void
  onCreditsUpdate?: (credits: number) => void
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export function SourceSelectionStep({
  onImport,
  onStartBlank,
  credits,
  selectedOption,
  onOptionChange,
  onCreditsUpdate,
}: SourceSelectionStepProps) {

  // URL import state
  const [url, setUrl] = useState("")
  const [isUrlLoading, setIsUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  // AI state
  const [aiText, setAiText] = useState("")
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // URL Import
  async function handleUrlImport(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return

    setIsUrlLoading(true)
    setUrlError(null)

    const result: ImportRecipeResult = await importRecipeFromUrl(url.trim())

    setIsUrlLoading(false)

    if (!result.success) {
      setUrlError(result.error || "Import misslyckades")
      return
    }

    if (result.data) {
      onImport(result.data, result.lowConfidenceIngredients)
    }
  }

  // AI Parse (text or image)
  async function handleAiParse(e: React.FormEvent) {
    e.preventDefault()
    if (!aiText.trim() && !imageFile) return

    setIsAiLoading(true)
    setAiError(null)

    try {
      let response: Response

      if (imageFile) {
        const formData = new FormData()
        formData.append("image", imageFile)
        if (aiText.trim()) formData.append("text", aiText.trim())
        response = await fetch("/api/ai/generate", {
          method: "POST",
          body: formData,
        })
      } else {
        response = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: aiText.trim() }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 402 || errorData.code === "INSUFFICIENT_CREDITS") {
          setAiError("Du har inga AI-genereringar kvar. Köp fler under AI-krediter i menyn.")
          return
        }
        throw new Error(errorData.error || "Tolkning misslyckades")
      }

      const data = await response.json()
      // Update remaining credits
      if (data.remainingCredits !== undefined && onCreditsUpdate) {
        onCreditsUpdate(data.remainingCredits)
      }
      // Build original prompt description for display
      const promptParts: string[] = []
      if (imageFile) promptParts.push(`[Bild: ${imageFile.name}]`)
      if (aiText.trim()) promptParts.push(aiText.trim())
      const originalPrompt = promptParts.join("\n")
      onImport(data.recipe, undefined, originalPrompt)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Tolkning misslyckades")
    } finally {
      setIsAiLoading(false)
    }
  }

  function handleImageSelect(file: File) {
    setAiError(null)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAiError("Ogiltig bildtyp. Tillåtna format: JPEG, PNG, WebP, GIF")
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setAiError("Bilden får vara max 10 MB")
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Option selection view
  if (selectedOption === null) {
    return (
      <div className="space-y-8 py-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Hur vill du börja?</h2>
          <p className="mt-2 text-muted-foreground">
            Välj ett alternativ nedan
          </p>
        </div>

        <div className="grid gap-4 max-w-lg mx-auto">
          {/* AI Generation Option — Primary */}
          <button
            type="button"
            onClick={() => onOptionChange("ai")}
            className={cn(
              "flex items-center gap-4 rounded-xl border-2 border-warm/50 bg-warm/5 p-5 text-left transition-all",
              "hover:border-warm hover:bg-warm/10"
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warm/15">
              <Sparkles className="h-6 w-6 text-warm" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Skapa med AI</h3>
              <p className="text-sm text-muted-foreground">
                Klistra in text eller ladda upp en bild
              </p>
            </div>
            {credits !== null && (
              <div className="shrink-0 rounded-full bg-warm/15 px-3 py-1 text-sm font-medium text-warm">
                {credits} kvar
              </div>
            )}
          </button>

          {/* URL Import Option */}
          <button
            type="button"
            onClick={() => onOptionChange("url")}
            className={cn(
              "flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all",
              "hover:border-primary hover:bg-primary/5"
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10">
              <Link className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold">Importera från URL</h3>
              <p className="text-sm text-muted-foreground">
                Klistra in en länk till ett recept
              </p>
            </div>
          </button>

          {/* Manual Entry Option */}
          <button
            type="button"
            onClick={onStartBlank}
            className={cn(
              "flex items-center gap-4 rounded-xl border-2 p-5 text-left transition-all",
              "hover:border-primary hover:bg-primary/5"
            )}
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <PenLine className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Skriv manuellt</h3>
              <p className="text-sm text-muted-foreground">
                Skapa receptet från grunden
              </p>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // URL Import form
  if (selectedOption === "url") {
    return (
      <div className="space-y-6 py-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-secondary/10 mb-4">
              <Link className="h-7 w-7 text-secondary" />
            </div>
            <h2 className="text-xl font-semibold">Importera från URL</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Klistra in en länk till ett recept så hämtar vi det automatiskt
            </p>
          </div>

          <form onSubmit={handleUrlImport} className="space-y-4">
            <Input
              type="url"
              placeholder="https://example.com/recept/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlError(null)
              }}
              disabled={isUrlLoading}
              autoFocus
              className="text-center"
            />
            {urlError && (
              <Alert variant="destructive">
                <AlertDescription>{urlError}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={!url.trim() || isUrlLoading}
            >
              {isUrlLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importerar...
                </>
              ) : (
                "Importera recept"
              )}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // AI Import form
  if (selectedOption === "ai") {
    return (
      <div className="space-y-6 py-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-accent/20 mb-4">
              <Sparkles className="h-7 w-7 text-warm" />
            </div>
            <h2 className="text-xl font-semibold">Importera med AI</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Klistra in recepttext eller ladda upp en bild
            </p>
          </div>

          <form onSubmit={handleAiParse} className="space-y-4">
            {/* Image upload area */}
            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleImageSelect(file)
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                )}
              >
                <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Dra och släpp en bild, eller klicka för att välja
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (valfritt)
                </p>
              </div>
            ) : (
              <div className="relative flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Förhandsvisning"
                  className="max-h-40 rounded-lg object-contain"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -right-2 -top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-md"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageSelect(file)
              }}
              className="hidden"
              disabled={isAiLoading}
            />

            <div className="relative">
              <div className="absolute inset-x-0 top-0 flex justify-center -translate-y-1/2">
                <span className="bg-card px-3 text-xs text-muted-foreground">
                  {imageFile ? "och/eller" : "eller"}
                </span>
              </div>
            </div>

            <Textarea
              placeholder="Klistra in recepttext här..."
              value={aiText}
              onChange={(e) => {
                setAiText(e.target.value)
                setAiError(null)
              }}
              className="min-h-[150px]"
              disabled={isAiLoading}
            />

            {aiError && (
              <Alert variant="destructive">
                <AlertDescription>{aiError}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={(!aiText.trim() && !imageFile) || isAiLoading}
            >
              {isAiLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Tolkar med AI...
                </>
              ) : (
                "Tolka recept"
              )}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return null
}
