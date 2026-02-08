import type { Metadata } from 'next'
import { SharedRecipeView } from '@/components/shared-recipe-view'
import { getSharedRecipe } from '@/lib/api'
import { generateRecipeJsonLd } from '@/lib/recipe-json-ld'

// Force dynamic rendering - token validation requires fresh data
export const dynamic = 'force-dynamic'

interface SharedRecipePageProps {
  params: Promise<{
    token: string
  }>
}

export async function generateMetadata({ params }: SharedRecipePageProps): Promise<Metadata> {
  const { token } = await params
  const recipe = await getSharedRecipe(token)

  if (!recipe) {
    return {
      title: 'Delat recept',
      description: 'Länken är ogiltig eller har gått ut',
    }
  }

  const imageUrl = recipe.image
    ? `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/images/${recipe.image.replace(/\.webp$/, '')}/full`
    : undefined

  return {
    title: `${recipe.name} - Delat recept`,
    description: recipe.description || `Ett delat recept från ${recipe.shared_by_name}`,
    openGraph: {
      title: recipe.name,
      description: recipe.description || `Ett delat recept från ${recipe.shared_by_name}`,
      images: imageUrl ? [imageUrl] : undefined,
      type: 'article',
    },
  }
}

export default async function SharedRecipePage({ params }: SharedRecipePageProps) {
  const { token } = await params
  const recipe = await getSharedRecipe(token)

  if (!recipe) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold">Länken är ogiltig</h1>
        <p className="text-muted-foreground">
          Delningslänken finns inte, har gått ut, eller har återkallats.
        </p>
      </div>
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'

  // Generate JSON-LD for SEO by adapting SharedRecipe to Recipe format
  const recipeForJsonLd = {
    ...recipe,
    is_liked: false,
    is_owner: false,
  }
  const jsonLd = generateRecipeJsonLd(recipeForJsonLd, baseUrl)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SharedRecipeView recipe={recipe} token={token} />
    </>
  )
}
