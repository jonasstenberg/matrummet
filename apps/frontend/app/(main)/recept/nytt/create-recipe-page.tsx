'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RecipeForm } from '@/components/recipe-form'
import { RecipeImportForm } from '@/components/recipe-import-form'
import { RecipeParser } from '@/components/recipe-parser'
import { useAuth } from '@/components/auth-provider'
import { isAdmin } from '@/lib/is-admin'
import { createRecipe } from '@/lib/actions'
import { CreateRecipeInput, Recipe } from '@/lib/types'

export function CreateRecipePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [importedData, setImportedData] = useState<Partial<Recipe> | null>(null)
  const [lowConfidenceIngredients, setLowConfidenceIngredients] = useState<number[]>([])
  const [importKey, setImportKey] = useState(0)

  function handleImport(data: Partial<CreateRecipeInput>, lowConfidenceIndices?: number[]) {
    // Transform CreateRecipeInput to Recipe format for the form
    const recipeData: Partial<Recipe> = {
      name: data.recipe_name || '',
      description: data.description || '',
      author: data.author || null,
      url: data.url || null,
      recipe_yield: data.recipe_yield ? parseInt(data.recipe_yield, 10) : null,
      recipe_yield_name: data.recipe_yield_name || null,
      prep_time: data.prep_time || null,
      cook_time: data.cook_time || null,
      cuisine: data.cuisine || null,
      image: data.image || null,
      thumbnail: data.thumbnail || null,
      date_published: data.date_published || null,
      categories: data.categories || [],
      ingredient_groups: [],
      ingredients:
        data.ingredients
          ?.filter((i): i is { name: string; measurement: string; quantity: string } => 'name' in i)
          .map((i) => ({
            name: i.name,
            measurement: i.measurement,
            quantity: i.quantity,
          })) || [],
      instruction_groups: [],
      instructions:
        data.instructions
          ?.filter((i): i is { step: string } => 'step' in i)
          .map((i) => ({
            step: i.step,
          })) || [],
    }

    setImportedData(recipeData)
    setLowConfidenceIngredients(lowConfidenceIndices || [])
    setImportKey((prev) => prev + 1)
  }

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
      {isAdmin(user) && <RecipeParser onParse={handleImport} />}
      <RecipeImportForm onImport={handleImport} />
      <RecipeForm
        key={importKey}
        initialData={importedData as Recipe | undefined}
        lowConfidenceIngredients={lowConfidenceIngredients}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
