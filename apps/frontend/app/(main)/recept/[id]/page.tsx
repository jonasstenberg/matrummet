import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RecipeDetailWithActions } from '@/components/recipe-detail-with-actions'
import { getRecipe } from '@/lib/api'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RecipePageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { id } = await params
  const recipe = await getRecipe(id)

  if (!recipe) {
    return {
      title: 'Recept hittades inte',
    }
  }

  const imageUrl = recipe.image
    ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/images/${recipe.image}`
    : undefined

  return {
    title: recipe.name,
    description: recipe.description || undefined,
    openGraph: {
      title: recipe.name,
      description: recipe.description || undefined,
      images: imageUrl ? [imageUrl] : undefined,
      type: 'article',
      publishedTime: recipe.date_published || undefined,
      modifiedTime: recipe.date_modified || undefined,
      authors: recipe.author ? [recipe.author] : undefined,
    },
  }
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params
  const recipe = await getRecipe(id)

  if (!recipe) {
    notFound()
  }

  const session = await getSession()

  return (
    <RecipeDetailWithActions
      recipe={recipe}
      userEmail={session?.email}
    />
  )
}
