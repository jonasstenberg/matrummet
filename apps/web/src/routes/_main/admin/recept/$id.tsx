import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getAdminRecipe } from '@/lib/admin-api'
import { RecipeDetail } from '@/components/recipe-detail'

const fetchAdminRecipe = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const recipe = await getAdminRecipe(id)
    if (!recipe) throw notFound()
    return recipe
  })

export const Route = createFileRoute('/_main/admin/recept/$id')({
  loader: ({ params }) => fetchAdminRecipe({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} | Admin` : 'Recept | Admin' }],
  }),
  component: AdminRecipePage,
})

function AdminRecipePage() {
  const recipe = Route.useLoaderData()

  return <RecipeDetail recipe={recipe} />
}
