import { createFileRoute, redirect } from '@tanstack/react-router'
import { ManualRecipePage } from '@/components/manual-recipe-page'

export const Route = createFileRoute('/_main/recept/nytt/manuellt')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  head: () => ({
    meta: [
      { title: 'Nytt recept' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ManualRecipeRoute,
})

function ManualRecipeRoute() {
  return <ManualRecipePage />
}
