import type { Metadata } from 'next'
import { getAdminFoods, type FoodStatus } from '@/lib/admin-api'
import { MatvarorClient } from './matvaror-client'

export const metadata: Metadata = {
  title: 'Matvaror | Admin',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    status?: string
  }>
}

export default async function AdminFoodsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search || ''
  const statusFilter = (params.status || 'pending') as FoodStatus | 'all'

  const data = await getAdminFoods({ page, search, status: statusFilter })

  return (
    <MatvarorClient
      initialData={data}
      page={page}
      search={search}
      statusFilter={statusFilter}
    />
  )
}
