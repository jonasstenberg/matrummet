import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getRecipe } from '@/lib/api'
import { signPostgrestToken } from '@/lib/auth'
import { EditRecipePage } from '@/components/edit-recipe-page'

const fetchEditRecipe = createServerFn({ method: 'GET' })
  .inputValidator(z.object({
    id: z.string(),
    email: z.string(),
    role: z.enum(['user', 'admin']).optional(),
  }))
  .handler(async ({ data: { id, email, role } }) => {
    const token = await signPostgrestToken(email)
    const recipe = await getRecipe(id, token)

    if (!recipe) {
      throw redirect({ to: '/' })
    }

    if (!recipe.is_owner) {
      throw redirect({ to: '/recept/$id', params: { id } })
    }

    const isAdmin = role === 'admin'

    return { recipe, isAdmin }
  })

export const Route = createFileRoute('/_main/recept/$id/redigera')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  loader: ({ params, context }) =>
    fetchEditRecipe({
      data: { id: params.id, email: context.session.email, role: context.session.role },
    }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.recipe
          ? `Redigera ${loaderData.recipe.name}`
          : 'Redigera recept',
      },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: EditRecipeRoute,
})

function EditRecipeRoute() {
  const { recipe, isAdmin } = Route.useLoaderData()

  return <EditRecipePage recipe={recipe} isAdmin={isAdmin} />
}
