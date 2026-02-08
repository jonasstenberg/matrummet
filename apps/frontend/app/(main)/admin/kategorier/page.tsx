import type { Metadata } from 'next'
import { AdminCategoriesClient } from './admin-categories-client'
import { getAdminCategories } from '@/lib/admin-api'

export const metadata: Metadata = {
  title: 'Kategorier | Admin',
}

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories()

  return <AdminCategoriesClient initialCategories={categories} />
}
