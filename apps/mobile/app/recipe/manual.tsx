import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { api } from '@/lib/api'
import { RecipeForm } from '@/components/recipe-form'
import type { RecipeFormData } from '@/components/recipe-form'

export default function NewRecipeScreen() {
  const router = useRouter()

  const handleSave = useCallback(async (data: RecipeFormData) => {
    const id = await api.createRecipe({
      recipe_name: data.name,
      description: data.description,
      recipe_yield: data.servings || null,
      prep_time: data.prepTime ? parseInt(data.prepTime, 10) : null,
      cook_time: data.cookTime ? parseInt(data.cookTime, 10) : null,
      categories: data.categories.length > 0 ? data.categories : undefined,
      ingredients: data.ingredients.map(i => ({
        name: i.name,
        quantity: i.quantity,
        measurement: i.measurement,
      })),
      instructions: data.instructions.map(i => ({ step: i.step })),
    })

    router.replace(`/recipe/${id}`)
  }, [router])

  return <RecipeForm title="Nytt recept" onSave={handleSave} />
}
