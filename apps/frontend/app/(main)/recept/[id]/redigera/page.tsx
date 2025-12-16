import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Recipe } from '@/lib/types'
import { EditRecipePage } from './edit-recipe-page'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

async function getRecipe(id: string): Promise<Recipe | null> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/recipes_and_categories?id=eq.${id}`,
      {
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return null
    }

    const recipes = await response.json()
    return recipes[0] || null
  } catch (error) {
    console.error('Failed to fetch recipe:', error)
    return null
  }
}

interface EditRecipePageProps {
  params: Promise<{ id: string }>
}

export default async function EditRecipe({ params }: EditRecipePageProps) {
  const { id } = await params
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const recipe = await getRecipe(id)

  if (!recipe) {
    redirect('/recept')
  }

  // Check ownership
  if (recipe.owner !== session.email) {
    redirect(`/recept/${id}`)
  }

  return <EditRecipePage recipe={recipe} />
}
