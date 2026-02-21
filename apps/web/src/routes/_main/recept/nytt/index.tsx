import { createFileRoute } from '@tanstack/react-router'
import { checkAuth } from '@/lib/middleware'
import { CreateRecipePage } from '@/components/create-recipe-page'

export const Route = createFileRoute('/_main/recept/nytt/')({
  beforeLoad: async () => {
    const session = await checkAuth()
    return { session }
  },
  head: () => ({
    meta: [
      { title: 'Nytt recept' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: NewRecipePage,
})

function NewRecipePage() {
  return <CreateRecipePage />
}
