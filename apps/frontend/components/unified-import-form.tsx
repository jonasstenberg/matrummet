"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImportData, importDataToFormData, RecipeFormData } from "@/lib/recipe-form-utils"
import { importRecipeFromUrl, fetchUrlPageText, deductAiCredit } from "@/lib/actions"
import { useImageUpload } from "@/lib/hooks/use-image-upload"
import { Sparkles, Loader2, ImageIcon, X } from "@/lib/icons"
import { cn } from "@/lib/utils"

// Simple URL detection regex
const URL_REGEX = /^https?:\/\/[^\s]+$/i

interface UnifiedImportFormProps {
  onImport: (data: RecipeFormData) => void | Promise<void>
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
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  function completeImport(formData: RecipeFormData) {
    onImport(formData)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasInput) return

    if (credits !== null && credits < 1) {
      setError("Du har inga AI-poäng kvar. Köp fler i menyn.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (isUrl && !imageUpload.pendingFile) {
        await handleUrlImport(input.trim())
      } else {
        await handleAiImport()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import misslyckades")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUrlImport(url: string) {
    // Try AI first — fetch page text and send to AI
    const { pageText } = await fetchUrlPageText(url)

    if (pageText) {
      try {
        await handleAiImport(pageText)
        return
      } catch {
        // AI failed — fall through to JSON-LD
      }
    }

    // Fallback: try JSON-LD extraction
    const result = await importRecipeFromUrl(url)

    if (result.success) {
      const hasIngredients = result.data?.ingredients && result.data.ingredients.length > 0
      const hasInstructions = result.data?.instructions && result.data.instructions.length > 0

      if (hasIngredients && hasInstructions) {
        const deductResult = await deductAiCredit(`Import: ${url.substring(0, 60)}`)
        if ("remainingCredits" in deductResult) {
          setCredits(deductResult.remainingCredits)
        }

        const { formData } = importDataToFormData(
          result.data as ImportData,
          result.lowConfidenceIngredients,
          undefined
        )
        completeImport(formData)
        return
      }
    }

    throw new Error("Kunde inte importera receptet. Försök klistra in recepttexten manuellt.")
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
        throw new Error("Du har inga AI-poäng kvar. Köp fler i menyn.")
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

    const { formData: recipeFormData } = importDataToFormData(
      data.recipe as ImportData,
      undefined,
      originalPrompt
    )
    completeImport(recipeFormData)
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

  return (
    <div className="rounded-2xl bg-card shadow-(--shadow-card)">
      <div className="px-5 py-5 space-y-4">
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
                AI läser av texten i bilden
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

          {/* Text/URL input */}
          <div>
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
          </div>

          {/* Credit cost hint */}
          {hasInput && (
            <p className="text-center text-xs text-muted-foreground">
              <Sparkles className="inline h-3 w-3 mr-1 align-[-2px]" />
              Kostar 1 AI-poäng ({credits ?? "?"} kvar)
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
      </div>
    </div>
  )
}
