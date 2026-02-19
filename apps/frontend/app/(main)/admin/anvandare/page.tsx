import type { Metadata } from 'next'
import { getAdminUsers, type UserRole, type UserSortField, type SortDir } from '@/lib/admin-api'
import { AnvandareClient } from './anvandare-client'

export const metadata: Metadata = {
  title: 'Användare | Admin',
}

const VALID_SORT_FIELDS: UserSortField[] = ['name', 'email', 'role', 'provider', 'recipe_count', 'credit_balance']
const VALID_SORT_DIRS: SortDir[] = ['asc', 'desc']

interface PageProps {
  searchParams: Promise<{
    page?: string
    search?: string
    role?: string
    sort?: string
    dir?: string
  }>
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search || ''
  const roleFilter = (params.role || 'all') as UserRole | 'all'
  const sortBy = VALID_SORT_FIELDS.includes(params.sort as UserSortField)
    ? (params.sort as UserSortField)
    : 'name'
  const sortDir = VALID_SORT_DIRS.includes(params.dir as SortDir)
    ? (params.dir as SortDir)
    : 'asc'

  const data = await getAdminUsers({ page, search, role: roleFilter, sortBy, sortDir })

  return (
    <AnvandareClient
      initialData={data}
      page={page}
      search={search}
      roleFilter={roleFilter}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  )
}
