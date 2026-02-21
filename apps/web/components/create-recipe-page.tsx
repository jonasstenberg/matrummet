import { useState, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { UnifiedImportForm } from '@/components/unified-import-form'
import {
  RecipeFormData,
  transformIngredientsToInlineFormat,
  transformInstructionsToInlineFormat,
} from '@/lib/recipe-form-utils'
import { CreateRecipeInput } from '@/lib/types'
import { createRecipe, downloadAndSaveImage } from '@/lib/actions'
import { ArrowLeft, ChefHat, Loader2 } from '@/lib/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function CreateRecipePage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleImport = useCallback(async (data: RecipeFormData) => {
    setIsSaving(true)
    setSaveError(null)

    try {
      // Handle image — download external URL if needed
      let image: string | null = null
      if (data.image && /^https?:\/\//.test(data.image)) {
        const result = await downloadAndSaveImage(data.image)
        if (!('error' in result)) {
          image = result.filename
        }
      } else {
        image = data.image
      }

      const ingredients = transformIngredientsToInlineFormat(
        data.ingredients.filter(i => i.name.trim()),
        data.ingredientGroups
      )

      const instructions = transformInstructionsToInlineFormat(
        data.instructions.filter(i => i.step.trim()),
        data.instructionGroups
      )

      const input: CreateRecipeInput = {
        recipe_name: data.name.trim(),
        author: data.author.trim() || null,
        description: data.description.trim(),
        url: data.url.trim() || null,
        recipe_yield: data.recipeYield || null,
        recipe_yield_name: data.recipeYieldName.trim() || null,
        prep_time: data.prepTime.trim() ? parseInt(data.prepTime.trim(), 10) : null,
        cook_time: data.cookTime.trim() ? parseInt(data.cookTime.trim(), 10) : null,
        cuisine: data.cuisine.trim() || null,
        image,
        thumbnail: image,
        categories: data.categories,
        ingredients,
        instructions,
      }

      const result = await createRecipe(input)

      if ('error' in result) {
        throw new Error(result.error)
      }

      await router.invalidate()
      router.navigate({ to: '/recept/$id', params: { id: result.id } })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Kunde inte spara receptet')
      setIsSaving(false)
    }
  }, [router])

  const handleBack = useCallback(() => {
    const referrer = document.referrer
    if (referrer && new URL(referrer).origin === window.location.origin) {
      router.history.back()
    } else {
      router.navigate({ to: '/' })
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
              Importera med bild eller länk
            </p>
          </div>
        </div>
      </header>

      {isSaving ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 shadow-(--shadow-card)">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Sparar receptet...</p>
        </div>
      ) : (
        <div className="space-y-3">
          <UnifiedImportForm onImport={handleImport} />

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => router.navigate({ to: '/recept/nytt/manuellt' })}
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Skriv in manuellt
            </button>
          </p>
        </div>
      )}
    </div>
  )
}
