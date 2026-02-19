import type { Metadata } from 'next'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { AdminDashboardClient, type DashboardStats } from './admin-dashboard-client'

export const metadata: Metadata = {
  title: 'Översikt | Admin',
}

async function getCount(url: string, token: string): Promise<number> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
    cache: 'no-store',
  })
  return parseInt(res.headers.get('content-range')?.split('/')[1] || '0')
}

async function getDashboardStats(): Promise<DashboardStats> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const token = await signPostgrestToken(session.email, session.role)
  const base = env.POSTGREST_URL

  const [
    pendingFoods,
    approvedFoods,
    totalCategories,
    totalUnits,
    totalRecipes,
    totalUsers,
    unusedUnitsRes,
    lastReviewRes,
  ] = await Promise.all([
    getCount(`${base}/foods?status=eq.pending`, token),
    getCount(`${base}/foods?status=eq.approved`, token),
    getCount(`${base}/categories`, token),
    getCount(`${base}/units`, token),
    getCount(`${base}/recipes`, token),
    getCount(`${base}/users`, token),
    fetch(`${base}/rpc/admin_list_units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ p_search: null, p_limit: 1000, p_offset: 0 }),
      cache: 'no-store',
    }),
    fetch(`${base}/food_review_logs?order=created_at.desc&limit=1&select=created_at,decision`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    }),
  ])

  let unusedUnits = 0
  if (unusedUnitsRes.ok) {
    const units: Array<{ ingredient_count: number }> = await unusedUnitsRes.json()
    unusedUnits = units.filter((u) => u.ingredient_count === 0).length
  }

  let lastAiReview: DashboardStats['lastAiReview'] = null
  if (lastReviewRes.ok) {
    const reviews = await lastReviewRes.json()
    if (Array.isArray(reviews) && reviews.length > 0) {
      lastAiReview = reviews[0]
    }
  }

  return {
    pendingFoods,
    approvedFoods,
    totalCategories,
    totalUnits,
    unusedUnits,
    totalRecipes,
    totalUsers,
    lastAiReview,
  }
}

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats()

  return <AdminDashboardClient stats={stats} />
}
