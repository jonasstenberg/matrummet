import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
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

export const Route = createFileRoute('/api/admin/dashboard')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      GET: async ({ context }) => {
        try {
          const { postgrestToken } = context
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
            getCount(`${base}/foods?status=eq.pending`, postgrestToken),
            getCount(`${base}/foods?status=eq.approved`, postgrestToken),
            getCount(`${base}/categories`, postgrestToken),
            getCount(`${base}/units`, postgrestToken),
            getCount(`${base}/recipes`, postgrestToken),
            getCount(`${base}/users`, postgrestToken),
            // Unused units: fetch all units with ingredient_count via RPC, then filter
            fetch(`${base}/rpc/admin_list_units`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({ p_search: null, p_limit: 1000, p_offset: 0 }),
              cache: 'no-store',
            }),
            // Last AI review log
            fetch(`${base}/food_review_logs?order=created_at.desc&limit=1&select=created_at,decision`, {
              headers: {
                Authorization: `Bearer ${postgrestToken}`,
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

          return Response.json(stats)
        } catch (error) {
          console.error('Dashboard stats error:', error)
          return Response.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
          )
        }
      },
    },
  },
})
