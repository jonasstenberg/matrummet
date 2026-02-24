import { useState, useEffect, useCallback } from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import type { Recipe } from '@matrummet/types/types'
import { api } from '@/lib/api'
import { RecipeForm } from '@/components/recipe-form'
import type { RecipeFormData } from '@/components/recipe-form'

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.getRecipe(id)
      .then(setRecipe)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = useCallback(async (data: RecipeFormData) => {
    if (!id) return

    await api.updateRecipe({
      recipe_id: id,
      recipe_name: data.name,
      description: data.description,
      recipe_yield: data.servings || null,
      prep_time: data.prepTime ? parseInt(data.prepTime, 10) : null,
      cook_time: data.cookTime ? parseInt(data.cookTime, 10) : null,
      categories: data.categories.length > 0 ? data.categories : [],
      ingredients: data.ingredients.map(i => ({
        name: i.name,
        quantity: i.quantity,
        measurement: i.measurement,
      })),
      instructions: data.instructions.map(i => ({ step: i.step })),
    })

    router.back()
  }, [id, router])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundText}>Receptet hittades inte</Text>
      </View>
    )
  }

  return <RecipeForm title="Redigera recept" recipe={recipe} onSave={handleSave} />
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  notFoundText: {
    color: '#6b7280',
    fontSize: 16,
  },
})
