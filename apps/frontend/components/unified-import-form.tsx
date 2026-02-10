"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImportData, importDataToFormData, RecipeFormData } from "@/lib/recipe-form-utils"
import { importRecipeFromUrl, fetchUrlPageText, ImportRecipeResult } from "@/lib/actions"
import { useImageUpload } from "@/lib/hooks/use-image-upload"
import { Sparkles, Loader2, ImageIcon, X, AlertTriangle, Link, Languages } from "@/lib/icons"
import { cn } from "@/lib/utils"

// Simple URL detection regex
const URL_REGEX = /^https?:\/\/[^\s]+$/i

interface UnifiedImportFormProps {
  onImport: (data: RecipeFormData, lowConfidenceIndices: number[]) => void
}

type ImportState = "idle" | "loading" | "partial-result"

interface PartialResult {
  formData: RecipeFormData | null
  lowConfidenceIndices: number[]
  missingFields: string[]
  sourceUrl: string
  pageText?: string
}

const LOADING_MESSAGES = [
  "Hämtar recept...",
  "Laddar sidan...",
  "Analyserar innehåll...",
  "Nästan klart...",
]

export function UnifiedImportForm({ onImport }: UnifiedImportFormProps) {
  const { credits, setCredits } = useAuth()
  const imageUpload = useImageUpload({ maxSize: 10 * 1024 * 1024 })
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [importState, setImportState] = useState<ImportState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [partialResult, setPartialResult] = useState<PartialResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [useAi, setUseAi] = useState(false)

  // Progressive loading messages
  useEffect(() => {
    if (!isLoading) {
      setLoadingMessageIndex(0)
      return
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1))
    }, 4000)

    return () => clearInterval(interval)
  }, [isLoading])

  const isUrl = URL_REGEX.test(input.trim())
  const hasInput = input.trim().length > 0 || imageUpload.pendingFile !== null
  const hasImage = imageUpload.pendingFile !== null
  const hasText = input.trim().length > 0 && !isUrl

  // Reset AI toggle when input is no longer a URL
  useEffect(() => {
    if (!isUrl) setUseAi(false)
  }, [isUrl])

  function completeImport(formData: RecipeFormData, lowConfidenceIndices: number[]) {
    onImport(formData, lowConfidenceIndices)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasInput) return

    setIsLoading(true)
    setError(null)
    setPartialResult(null)
    setImportState("loading")

    try {
      if (isUrl && !imageUpload.pendingFile) {
        if (useAi) {
          // URL + AI mode: fetch page text then send to AI
          await handleUrlWithAi(input.trim())
        } else {
          // URL mode: try JSON-LD extraction first
          await handleUrlImport(input.trim())
        }
      } else {
        // Text/image mode: go directly to AI
        await handleAiImport()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import misslyckades")
      setImportState("idle")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUrlWithAi(url: string) {
    // Fetch page text via Playwright, then send directly to AI (skip JSON-LD)
    const { pageText, error: fetchError } = await fetchUrlPageText(url)

    if (!pageText) {
      setError(fetchError || "Kunde inte hämta sidans innehåll. Försök klistra in recepttexten manuellt.")
      setImportState("idle")
      return
    }

    await handleAiImport(pageText)
  }

  async function handleUrlImport(url: string) {
    const result: ImportRecipeResult = await importRecipeFromUrl(url)

    if (!result.success) {
      setPartialResult({
        formData: null,
        lowConfidenceIndices: [],
        missingFields: ["receptdata"],
        sourceUrl: url,
        pageText: result.pageText,
      })
      setImportState("partial-result")
      return
    }

    const hasIngredients = result.data?.ingredients && result.data.ingredients.length > 0
    const hasInstructions = result.data?.instructions && result.data.instructions.length > 0

    if (hasIngredients && hasInstructions) {
      const { formData, lowConfidenceIngredients } = importDataToFormData(
        result.data as ImportData,
        result.lowConfidenceIngredients,
        undefined
      )
      completeImport(formData, lowConfidenceIngredients)
      setImportState("idle")
    } else {
      const missingFields: string[] = []
      if (!hasIngredients) missingFields.push("ingredienser")
      if (!hasInstructions) missingFields.push("instruktioner")

      const { formData, lowConfidenceIngredients } = importDataToFormData(
        result.data as ImportData,
        result.lowConfidenceIngredients,
        undefined
      )

      setPartialResult({
        formData,
        lowConfidenceIndices: lowConfidenceIngredients,
        missingFields,
        sourceUrl: url,
        pageText: result.pageText,
      })
      setImportState("partial-result")
    }
  }

  async function handleAiImport(pageTextFallback?: string) {
    const formData = new FormData()
    if (imageUpload.pendingFile) {
      formData.append("image", imageUpload.pendingFile)
    }

    const textContent = pageTextFallback || input.trim()
    if (textContent) {
      formData.append("text", textContent)
    }

    if (!imageUpload.pendingFile && !textContent) {
      throw new Error("Ingen text eller bild att importera")
    }

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      if (response.status === 402 || errorData.code === "INSUFFICIENT_CREDITS") {
        throw new Error("Du har inga smarta importer kvar. Köp fler i menyn.")
      }
      throw new Error(errorData.error || "Tolkning misslyckades")
    }

    const data = await response.json()

    if (typeof data.remainingCredits === "number") {
      setCredits(data.remainingCredits)
    }

    const promptParts: string[] = []
    if (imageUpload.pendingFile) promptParts.push(`[Bild: ${imageUpload.pendingFile.name}]`)
    if (pageTextFallback) promptParts.push("[Importerat från URL]")
    else if (input.trim()) promptParts.push(input.trim())
    const originalPrompt = promptParts.join("\n")

    const { formData: recipeFormData, lowConfidenceIngredients } = importDataToFormData(
      data.recipe as ImportData,
      undefined,
      originalPrompt
    )
    completeImport(recipeFormData, lowConfidenceIngredients)
    setImportState("idle")
  }

  function handleProceedWithPartial() {
    if (partialResult?.formData) {
      completeImport(partialResult.formData, partialResult.lowConfidenceIndices)
      setPartialResult(null)
      setImportState("idle")
    }
  }

  async function handleTryWithAi() {
    if (!partialResult?.pageText) {
      setError("Kunde inte hämta sidans innehåll. Försök klistra in recepttexten manuellt.")
      return
    }

    setIsLoading(true)
    setError(null)
    setImportState("loading")

    try {
      await handleAiImport(partialResult.pageText)
      setPartialResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI-import misslyckades")
      setImportState("partial-result")
    } finally {
      setIsLoading(false)
    }
  }

  function handleImageSelect(file: File) {
    setError(null)
    imageUpload.selectFile(file)
  }

  useEffect(() => {
    if (imageUpload.error) {
      setError(imageUpload.error)
    }
  }, [imageUpload.error])

  function clearImage() {
    imageUpload.clear()
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // Determine what the contextual hint should say
  function getContextHint(): { icon: React.ReactNode; text: string; secondary?: string } | null {
    if (!hasInput) return null

    if (isUrl && !hasImage) {
      if (useAi) {
        return {
          icon: <Sparkles className="h-3.5 w-3.5" />,
          text: "AI tolkar receptet från länken",
          secondary: `Kostar 1 smart import (${credits ?? "?"} kvar)`,
        }
      }
      return {
        icon: <Link className="h-3.5 w-3.5" />,
        text: "Hämtar receptdata direkt från länken — gratis",
        secondary: "Om sidan saknar maskinläsbar data får du välja att använda AI",
      }
    }

    if (hasImage && hasText) {
      return {
        icon: <Sparkles className="h-3.5 w-3.5" />,
        text: "Bild och text tolkas med AI",
        secondary: `Kostar 1 smart import (${credits ?? "?"} kvar)`,
      }
    }

    if (hasImage) {
      return {
        icon: <Sparkles className="h-3.5 w-3.5" />,
        text: "Bilden tolkas med AI",
        secondary: `Kostar 1 smart import (${credits ?? "?"} kvar)`,
      }
    }

    if (hasText) {
      return {
        icon: <Sparkles className="h-3.5 w-3.5" />,
        text: "Texten tolkas med AI",
        secondary: `Kostar 1 smart import (${credits ?? "?"} kvar)`,
      }
    }

    return null
  }

  const contextHint = getContextHint()
  const hasPartialData = partialResult?.formData !== null
  const hasPageText = !!partialResult?.pageText

  return (
    <div className="rounded-2xl bg-card shadow-(--shadow-card)">
      <div className="px-5 py-5 space-y-4">
        {importState === "partial-result" && partialResult ? (
          // Partial result UI
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold">
                  {hasPartialData ? "Bara delar av receptet hittades" : "Kunde inte hämta receptet"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hasPartialData
                    ? `Saknas: ${partialResult.missingFields.join(", ")}`
                    : hasPageText
                      ? "Sidan saknar maskinläsbar receptdata. Prova med AI istället."
                      : "Kunde inte läsa sidans innehåll. Klistra in receptet manuellt."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {hasPartialData && (
                <Button
                  variant="outline"
                  onClick={handleProceedWithPartial}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Fortsätt ändå
                </Button>
              )}
              {hasPageText && (
                <Button
                  onClick={handleTryWithAi}
                  disabled={isLoading || credits === 0}
                  className={cn(
                    "bg-warm text-warm-foreground hover:bg-warm/90",
                    hasPartialData ? "flex-1" : "w-full"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {LOADING_MESSAGES[loadingMessageIndex]}
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {hasPartialData
                        ? `Prova med AI (${credits !== null ? `${credits} kvar` : ""})`
                        : `Importera med AI (${credits !== null ? `${credits} kvar` : ""})`}
                    </>
                  )}
                </Button>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          // Normal import form
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Image upload area */}
            {!imageUpload.filePreview ? (
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
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl p-5 transition-all",
                  isDragging
                    ? "bg-primary/10 ring-2 ring-primary/30"
                    : "bg-muted/40 hover:bg-muted/60"
                )}
              >
                <ImageIcon className="mb-1.5 h-6 w-6 text-muted-foreground/60" />
                <p className="text-sm font-medium text-muted-foreground">
                  Släpp bild här eller klicka
                </p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  valfritt
                </p>
              </div>
            ) : (
              <div className="relative flex justify-center rounded-xl bg-muted/40 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUpload.filePreview || undefined}
                  alt="Förhandsvisning"
                  className="max-h-40 rounded-lg object-contain"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute right-2 top-2 rounded-full bg-foreground/80 p-1.5 text-background shadow-sm transition-colors hover:bg-foreground"
                >
                  <X className="h-3.5 w-3.5" />
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
              disabled={isLoading}
            />

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs text-muted-foreground/70">
                {imageUpload.pendingFile ? "och/eller" : "eller"}
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>

            <Textarea
              placeholder="Klistra in länk eller recepttext..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setError(null)
              }}
              className="min-h-[100px] bg-background text-[15px]"
              disabled={isLoading}
            />

            {/* AI toggle — only when URL is detected */}
            {isUrl && !hasImage && (
              <label className="flex items-center justify-between gap-4 rounded-xl bg-muted/40 px-4 py-3 cursor-pointer select-none">
                <div className="flex items-center gap-3 min-w-0">
                  <Languages className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">Använd AI</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                      Översätter och tolkar recept från andra språk
                    </p>
                  </div>
                </div>
                <Switch
                  checked={useAi}
                  onCheckedChange={setUseAi}
                  disabled={isLoading}
                />
              </label>
            )}

            {/* Contextual hint */}
            {contextHint && (
              <p className="text-center text-xs text-muted-foreground">
                {contextHint.text}
                {contextHint.secondary && (
                  <span className="block text-muted-foreground/70 mt-0.5">
                    {contextHint.secondary}
                  </span>
                )}
              </p>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="mx-auto flex"
              disabled={!hasInput || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {LOADING_MESSAGES[loadingMessageIndex]}
                </>
              ) : (
                "Importera recept"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
