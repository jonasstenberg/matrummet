import type { Metadata } from 'next'
import { getAdminUsers, type UserRole } from '@/lib/admin-api'
import { AnvandareClient } from './anvandare-client'

export const metadata: Metadata = {
  title: 'Användare | Admin',
}

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    role?: string
  }>
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search || ''
  const roleFilter = (params.role || 'all') as UserRole | 'all'

  const data = await getAdminUsers({ page, search, role: roleFilter })

  return (
    <AnvandareClient
      initialData={data}
      page={page}
      search={search}
      roleFilter={roleFilter}
    />
  )
}
