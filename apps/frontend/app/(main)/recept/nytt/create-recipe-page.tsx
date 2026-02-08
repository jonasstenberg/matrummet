'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeForm } from '@/components/recipe-form'
import { UnifiedImportForm } from '@/components/unified-import-form'
import { RecipeFormData } from '@/lib/recipe-form-utils'
import { CreateRecipeInput } from '@/lib/types'
import { createRecipe } from '@/lib/actions'
import { ArrowLeft, ChefHat } from '@/lib/icons'

export function CreateRecipePage() {
  const router = useRouter()
  const [importedData, setImportedData] = useState<RecipeFormData | null>(null)
  const [lowConfidenceIngredients, setLowConfidenceIngredients] = useState<number[]>([])
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleImport = useCallback((data: RecipeFormData, lowConfidenceIndices: number[]) => {
    setImportedData(data)
    setLowConfidenceIngredients(lowConfidenceIndices)
    setFormKey(k => k + 1)
  }, [])

  const handleSubmit = useCallback(async (data: CreateRecipeInput) => {
    setIsSubmitting(true)

    try {
      const result = await createRecipe(data)

      if ("error" in result) {
        throw new Error(result.error)
      }

      router.push(`/recept/${result.id}`)
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }, [router])

  const handleBack = useCallback(() => {
    const referrer = document.referrer
    if (referrer && new URL(referrer).origin === window.location.origin) {
      router.back()
    } else {
      router.push('/')
    }
  }, [router])

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tillbaka
        </button>
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <ChefHat className="h-5.5 w-5.5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Nytt recept
            </h1>
            <p className="text-sm text-muted-foreground">
              Importera eller fyll i formuläret manuellt
            </p>
          </div>
        </div>
      </header>

      <UnifiedImportForm onImport={handleImport} />

      <RecipeForm
        key={formKey}
        initialData={importedData ?? undefined}
        lowConfidenceIngredients={lowConfidenceIngredients}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
