import { NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

interface DashboardStats {
  pendingFoods: number
  approvedFoods: number
  totalCategories: number
  totalUnits: number
  unusedUnits: number
  totalRecipes: number
  totalUsers: number
  lastAiReview: { created_at: string; decision: string } | null
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

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      // Unused units: fetch all units with ingredient_count via RPC, then filter
      fetch(`${base}/rpc/admin_list_units`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ p_search: null, p_limit: 1000, p_offset: 0 }),
        cache: 'no-store',
      }),
      // Last AI review log
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

    const stats: DashboardStats = {
      pendingFoods,
      approvedFoods,
      totalCategories,
      totalUnits,
      unusedUnits,
      totalRecipes,
      totalUsers,
      lastAiReview,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
