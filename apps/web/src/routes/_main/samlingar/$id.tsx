import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCollectionRecipes, listCollections } from '@/lib/collections-api'
import { CollectionDetail } from '@/components/collection-detail'

const fetchCollection = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const [collections, recipeResult] = await Promise.all([
      listCollections(),
      getCollectionRecipes(id, { limit: 24 }),
    ])

    const collection = collections.find((c) => c.id === id) ?? null

    return {
      collection,
      recipes: recipeResult.recipes,
      totalCount: recipeResult.totalCount,
    }
  })

export const Route = createFileRoute('/_main/samlingar/$id')({
  loader: async ({ params }) => {
    const data = await fetchCollection({ data: { id: params.id } })
    if (!data.collection) {
      throw redirect({ to: '/samlingar' })
    }
    return data
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.collection?.name ?? 'Samling' },
      {
        name: 'description',
        content: loaderData?.collection?.description ?? 'En receptsamling',
      },
    ],
  }),
  component: CollectionPage,
})

function CollectionPage() {
  const { collection, recipes, totalCount } = Route.useLoaderData()

  // collection is guaranteed non-null: the loader redirects otherwise.
  if (!collection) return null

  return (
    <CollectionDetail
      collection={collection}
      recipes={recipes}
      totalCount={totalCount}
    />
  )
}
