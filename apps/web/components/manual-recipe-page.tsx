import { useState, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { RecipeForm } from '@/components/recipe-form'
import { CreateRecipeInput } from '@/lib/types'
import { createRecipe } from '@/lib/actions'
import { ArrowLeft, ChefHat } from '@/lib/icons'

export function ManualRecipePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async (data: CreateRecipeInput) => {
    setIsSubmitting(true)

    try {
      const result = await createRecipe(data)

      if ("error" in result) {
        throw new Error(result.error)
      }

      await router.invalidate()
      router.navigate({ to: '/recept/$id', params: { id: result.id } })
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }, [router])

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <button
          type="button"
          onClick={() => router.navigate({ to: '/recept/nytt' })}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Byt metod
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
              Fyll i receptet manuellt
            </p>
          </div>
        </div>
      </header>

      <RecipeForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
