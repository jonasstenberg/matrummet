'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeForm } from '@/components/recipe-form'
import { updateRecipe } from '@/lib/actions'
import { Recipe, CreateRecipeInput, UpdateRecipeInput } from '@/lib/types'

interface EditRecipePageProps {
  recipe: Recipe
}

export function EditRecipePage({ recipe }: EditRecipePageProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(data: CreateRecipeInput) {
    setIsSubmitting(true)

    try {
      // Convert CreateRecipeInput to UpdateRecipeInput format
      const updateData: UpdateRecipeInput = {
        recipe_id: recipe.id,
        ...data,
      }

      const result = await updateRecipe(recipe.id, updateData)

      if ('error' in result) {
        throw new Error(result.error)
      }

      // Redirect back to the recipe page
      router.push(`/recept/${recipe.id}`)
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Redigera recept
        </h1>
      </header>
      <RecipeForm
        initialData={recipe}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
