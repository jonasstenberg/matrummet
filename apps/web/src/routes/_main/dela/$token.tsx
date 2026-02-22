import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSharedRecipe } from '@/lib/api'
import { generateRecipeJsonLd } from '@/lib/recipe-json-ld'
import { SharedRecipeView } from '@/components/shared-recipe-view'

const fetchSharedRecipe = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data: { token } }) => {
    const recipe = await getSharedRecipe(token)
    const { env } = await import('@/lib/env')
    const baseUrl = env.APP_URL || 'http://localhost:3000'

    if (!recipe) {
      return { recipe: null, jsonLd: null, token, baseUrl }
    }

    const recipeForJsonLd = {
      ...recipe,
      is_liked: false,
      is_owner: false,
    }
    const jsonLd = generateRecipeJsonLd(recipeForJsonLd, baseUrl)

    return { recipe, jsonLd, token, baseUrl }
  })

export const Route = createFileRoute('/_main/dela/$token')({
  loader: ({ params }) =>
    fetchSharedRecipe({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    if (!loaderData?.recipe) {
      return {
        meta: [
          { title: 'Delat recept' },
          {
            name: 'description',
            content: 'Länken är ogiltig eller har gått ut',
          },
        ],
      }
    }

    const { recipe, baseUrl } = loaderData
    const imageUrl = recipe.image
      ? `${baseUrl}/api/images/${recipe.image.replace(/\.webp$/, '')}/full`
      : undefined
    const description =
      recipe.description ||
      `Ett delat recept från ${recipe.shared_by_name}`

    return {
      meta: [
        { title: `${recipe.name} - Delat recept` },
        { name: 'description', content: description },
        { property: 'og:title', content: recipe.name },
        { property: 'og:description', content: description },
        ...(imageUrl
          ? [
              { property: 'og:image', content: imageUrl },
              { property: 'og:image:width', content: '1200' },
              { property: 'og:image:height', content: '630' },
              { property: 'og:image:alt', content: recipe.name },
            ]
          : []),
        { property: 'og:type', content: 'article' },
        ...(recipe.date_published
          ? [
              {
                property: 'article:published_time',
                content: recipe.date_published,
              },
            ]
          : []),
        ...(recipe.date_modified
          ? [
              {
                property: 'article:modified_time',
                content: recipe.date_modified,
              },
            ]
          : []),
        ...(recipe.shared_by_name
          ? [
              {
                property: 'article:author',
                content: recipe.shared_by_name,
              },
            ]
          : []),
        { property: 'og:locale', content: 'sv_SE' },
        { property: 'og:site_name', content: 'Matrummet' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: recipe.name },
        { name: 'twitter:description', content: description },
        ...(imageUrl
          ? [{ name: 'twitter:image', content: imageUrl }]
          : []),
      ],
      links: [
        {
          rel: 'canonical',
          href: `${baseUrl}/dela/${loaderData.token}`,
        },
      ],
    }
  },
  component: SharedRecipePage,
})

function SharedRecipePage() {
  const { recipe, jsonLd, token } = Route.useLoaderData()

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
