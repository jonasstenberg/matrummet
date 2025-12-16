'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeForm } from '@/components/recipe-form'
import { createRecipe } from '@/lib/actions'
import { CreateRecipeInput } from '@/lib/types'

export function CreateRecipePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(data: CreateRecipeInput) {
    setIsSubmitting(true)

    try {
      const result = await createRecipe(data)

      if ('error' in result) {
        throw new Error(result.error)
      }

      // Redirect to the new recipe page
      router.push(`/recept/${result.id}`)
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Skapa nytt recept</h1>
      <RecipeForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
