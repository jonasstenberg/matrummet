import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RecipeDetailWithActions } from '@/components/recipe-detail-with-actions'
import { getRecipe } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { generateRecipeJsonLd } from '@/lib/recipe-json-ld'

// Force dynamic rendering since we need session/cookies
// ISR/static generation conflicts with getSession() in Next.js 15
export const dynamic = 'force-dynamic'

interface RecipePageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { id } = await params
  const session = await getSession()
  const token = session ? await signPostgrestToken(session.email) : undefined
  const recipe = await getRecipe(id, token)

  if (!recipe) {
    return {
      title: 'Recept hittades inte',
    }
  }

  const imageUrl = recipe.image
    ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/images/${recipe.image.replace(/\.webp$/, '')}/full`
    : undefined

  return {
    title: recipe.name,
    description: recipe.description || undefined,
    alternates: {
      canonical: `/recept/${id}`,
    },
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
  const session = await getSession()
  const token = session ? await signPostgrestToken(session.email) : undefined
  const recipe = await getRecipe(id, token)

  if (!recipe) {
    notFound()
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
  const jsonLd = generateRecipeJsonLd(recipe, baseUrl)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <RecipeDetailWithActions recipe={recipe} />
    </>
  )
}
