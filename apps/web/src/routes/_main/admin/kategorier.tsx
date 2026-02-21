import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  getAdminCategories,
  getAdminCategoryGroups,
} from '@/lib/admin-api'
import { AdminCategoriesClient } from '@/components/admin-categories-client'

const fetchCategoriesData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [categories, groups] = await Promise.all([
      getAdminCategories(),
      getAdminCategoryGroups(),
    ])
    return { categories, groups }
  },
)

export const Route = createFileRoute('/_main/admin/kategorier')({
  loader: () => fetchCategoriesData(),
  head: () => ({ meta: [{ title: 'Kategorier | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const { categories, groups } = Route.useLoaderData()

  return <AdminCategoriesClient initialCategories={categories} groups={groups} />
}
