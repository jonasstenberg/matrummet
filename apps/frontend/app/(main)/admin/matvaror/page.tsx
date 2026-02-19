import type { Metadata } from 'next'
import { getAdminFoods, getPendingFoodCount, type FoodStatus, type AliasFilter } from '@/lib/admin-api'
import { MatvarorClient } from './matvaror-client'

export const metadata: Metadata = {
  title: 'Matvaror | Admin',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
    alias?: string
  }>
}

export default async function AdminFoodsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search || ''
  const statusFilter = (params.status || 'pending') as FoodStatus | 'all'
  const aliasFilter = (params.alias || 'all') as AliasFilter

  const [data, pendingCount] = await Promise.all([
    getAdminFoods({ page, search, status: statusFilter, alias: aliasFilter }),
    getPendingFoodCount(),
  ])

  return (
    <MatvarorClient
      initialData={data}
      page={page}
      search={search}
      statusFilter={statusFilter}
      aliasFilter={aliasFilter}
      pendingCount={pendingCount}
    />
  )
}
