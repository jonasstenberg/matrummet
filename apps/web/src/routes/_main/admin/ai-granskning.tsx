import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getPendingFoodCount } from '@/lib/admin-api'
import { AdminAIReviewClient } from '@/components/admin-ai-review-client'

const fetchPendingCount = createServerFn({ method: 'GET' }).handler(
  async () => {
    return getPendingFoodCount()
  },
)

export const Route = createFileRoute('/_main/admin/ai-granskning')({
  loader: () => fetchPendingCount(),
  head: () => ({ meta: [{ title: 'AI-granskning | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const pendingCount = Route.useLoaderData()

  return <AdminAIReviewClient pendingCount={pendingCount} />
}
