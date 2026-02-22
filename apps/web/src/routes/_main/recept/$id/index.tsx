import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getRecipe } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { generateRecipeJsonLd } from '@/lib/recipe-json-ld'
import { RecipeDetailWithActions } from '@/components/recipe-detail-with-actions'

const fetchRecipe = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const session = await getSession()
    const token = session ? await signPostgrestToken(session.email) : undefined
    const recipe = await getRecipe(id, token)

    if (!recipe) {
      throw notFound()
    }

    const { env } = await import('@/lib/env')
    const baseUrl = env.APP_URL || 'http://localhost:3000'
    const jsonLd = generateRecipeJsonLd(recipe, baseUrl)

    return { recipe, jsonLd, baseUrl }
  })

export const Route = createFileRoute('/_main/recept/$id/')({
  loader: ({ params }) => fetchRecipe({ data: { id: params.id } }),
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: 'Recept hittades inte' }] }
    }

    const { recipe, baseUrl } = loaderData
    const imageUrl = recipe.image
      ? `${baseUrl}/api/images/${recipe.image.replace(/\.webp$/, '')}/full`
      : undefined

    return {
      meta: [
        { title: recipe.name },
        ...(recipe.description
          ? [{ name: 'description', content: recipe.description }]
          : []),
        { property: 'og:title', content: recipe.name },
        ...(recipe.description
          ? [{ property: 'og:description', content: recipe.description }]
          : []),
        ...(imageUrl
          ? [{ property: 'og:image', content: imageUrl }]
          : []),
        { property: 'og:type', content: 'article' },
        ...(recipe.date_published
          ? [{ property: 'article:published_time', content: recipe.date_published }]
          : []),
        ...(recipe.date_modified
          ? [{ property: 'article:modified_time', content: recipe.date_modified }]
          : []),
        ...(recipe.author
          ? [{ property: 'article:author', content: recipe.author }]
          : []),
      ],
      links: [
        { rel: 'canonical', href: `${baseUrl}/recept/${recipe.id}` },
      ],
    }
  },
  component: RecipePage,
})

function RecipePage() {
  const { recipe, jsonLd } = Route.useLoaderData()

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
