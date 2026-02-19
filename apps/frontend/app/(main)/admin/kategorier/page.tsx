import type { Metadata } from 'next'
import { AdminCategoriesClient } from './admin-categories-client'
import { getAdminCategories, getAdminCategoryGroups } from '@/lib/admin-api'

export const metadata: Metadata = {
  title: 'Kategorier | Admin',
}

export default async function AdminCategoriesPage() {
  const [categories, groups] = await Promise.all([
    getAdminCategories(),
    getAdminCategoryGroups(),
  ])

  return <AdminCategoriesClient initialCategories={categories} groups={groups} />
}
