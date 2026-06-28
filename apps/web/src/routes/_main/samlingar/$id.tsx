import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCollectionRecipes, listCollections } from '@/lib/collections-api'
import { getCategories } from '@/lib/api'
import { getUserPantry } from '@/lib/ingredient-search-actions'
import { getSession } from '@/lib/auth'
import { CollectionDetail } from '@/components/collection-detail'

const PAGE_SIZE = 24

const fetchCollection = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const session = await getSession()
    const [collections, recipeResult, groupedCategories, pantryResult] =
      await Promise.all([
        listCollections(),
        getCollectionRecipes(id, { limit: PAGE_SIZE }),
        getCategories(),
        session ? getUserPantry() : Promise.resolve([]),
      ])

    const collection = collections.find((c) => c.id === id) ?? null

    return {
      collection,
      recipes: recipeResult.recipes,
      totalCount: recipeResult.totalCount,
      groupedCategories,
      pantryItems: Array.isArray(pantryResult) ? pantryResult : [],
      isAuthenticated: !!session,
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
  const {
    collection,
    recipes,
    totalCount,
    groupedCategories,
    pantryItems,
    isAuthenticated,
  } = Route.useLoaderData()

  // collection is guaranteed non-null: the loader redirects otherwise.
  if (!collection) return null

  return (
    <CollectionDetail
      collection={collection}
      recipes={recipes}
      totalCount={totalCount}
      groupedCategories={groupedCategories}
      pantryItems={pantryItems}
      isAuthenticated={isAuthenticated}
    />
  )
}
