'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { CreateRecipeInput, UpdateRecipeInput } from '@/lib/types'
import { verifyToken, signPostgrestToken } from '@/lib/auth'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

async function getPostgrestToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('auth-token')?.value

  if (!authToken) {
    return null
  }

  // Verify the frontend token and extract the email
  const payload = await verifyToken(authToken)
  if (!payload?.email) {
    return null
  }

  // Create a PostgREST-specific token with role: 'anon'
  return signPostgrestToken(payload.email)
}

export async function createRecipe(
  data: CreateRecipeInput
): Promise<{ id: string } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att skapa recept' }
    }

    // Map the input to match PostgREST function parameters
    const payload = {
      p_name: data.recipe_name,
      p_author: data.author || null,
      p_description: data.description,
      p_url: data.url || null,
      p_recipe_yield: data.recipe_yield || null,
      p_recipe_yield_name: data.recipe_yield_name || null,
      p_prep_time: data.prep_time || null,
      p_cook_time: data.cook_time || null,
      p_cuisine: data.cuisine || null,
      p_image: data.image || null,
      p_thumbnail: data.thumbnail || null,
      p_date_published: data.date_published || null,
      p_categories: data.categories || [],
      p_ingredients: data.ingredients || [],
      p_instructions: data.instructions || [],
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/insert_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create recipe:', errorText)
      return { error: 'Kunde inte skapa receptet. Försök igen.' }
    }

    const result = await response.json()

    // Revalidate relevant paths
    revalidatePath('/recept')
    revalidatePath('/')

    return { id: result }
  } catch (error) {
    console.error('Error creating recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function updateRecipe(
  id: string,
  data: UpdateRecipeInput
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att uppdatera recept' }
    }

    // Map the input to match PostgREST function parameters
    const payload = {
      p_recipe_id: id,
      p_name: data.recipe_name,
      p_author: data.author,
      p_description: data.description,
      p_url: data.url,
      p_recipe_yield: data.recipe_yield,
      p_recipe_yield_name: data.recipe_yield_name,
      p_prep_time: data.prep_time,
      p_cook_time: data.cook_time,
      p_cuisine: data.cuisine,
      p_image: data.image,
      p_thumbnail: data.thumbnail,
      p_date_published: data.date_published,
      p_categories: data.categories,
      p_ingredients: data.ingredients,
      p_instructions: data.instructions,
    }

    const response = await fetch(`${POSTGREST_URL}/rpc/update_recipe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to update recipe:', errorText)
      return { error: 'Kunde inte uppdatera receptet. Försök igen.' }
    }

    // Revalidate relevant paths
    revalidatePath(`/recept/${id}`)
    revalidatePath('/recept')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Error updating recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}

export async function deleteRecipe(
  id: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    const token = await getPostgrestToken()

    if (!token) {
      return { error: 'Du måste vara inloggad för att ta bort recept' }
    }

    const response = await fetch(`${POSTGREST_URL}/recipes?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to delete recipe:', errorText)
      return { error: 'Kunde inte ta bort receptet. Försök igen.' }
    }

    // Revalidate relevant paths
    revalidatePath('/recept')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Error deleting recipe:', error)
    return { error: 'Ett oväntat fel uppstod. Försök igen.' }
  }
}
