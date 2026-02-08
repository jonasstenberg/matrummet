import type { Metadata } from 'next'
import { getAdminUnits } from '@/lib/admin-api'
import { EnheterClient } from './enheter-client'

export const metadata: Metadata = {
  title: 'Enheter | Admin',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
  }>
}

export default async function AdminUnitsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search || ''

  const data = await getAdminUnits({ page, search })

  return (
    <EnheterClient
      initialData={data}
      page={page}
      search={search}
    />
  )
}
