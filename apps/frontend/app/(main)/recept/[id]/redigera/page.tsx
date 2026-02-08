import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { getRecipe } from '@/lib/api'
import { EditRecipePage } from './edit-recipe-page'

interface EditRecipePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: EditRecipePageProps): Promise<Metadata> {
  const { id } = await params
  const recipe = await getRecipe(id)

  return {
    title: recipe ? `Redigera ${recipe.name}` : 'Redigera recept',
  }
}

export default async function EditRecipe({ params }: EditRecipePageProps) {
  const { id } = await params
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const token = await signPostgrestToken(session.email)
  const recipe = await getRecipe(id, token)

  if (!recipe) {
    redirect('/recept')
  }

  // Check ownership
  if (!recipe.is_owner) {
    redirect(`/recept/${id}`)
  }

  const isAdmin = session.role === 'admin'

  return <EditRecipePage recipe={recipe} isAdmin={isAdmin} />
}
