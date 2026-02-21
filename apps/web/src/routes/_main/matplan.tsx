import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getMealPlan, listMealPlans } from '@/lib/meal-plan-actions'
import { MealPlanClient } from '@/components/meal-plan/meal-plan-client'

const fetchMealPlan = createServerFn({ method: 'GET' }).handler(async () => {
  const [plan, planList] = await Promise.all([
    getMealPlan(),
    listMealPlans(),
  ])

  return { plan, planList }
})

export const Route = createFileRoute('/_main/matplan')({
  validateSearch: (search) =>
    z.object({ view: z.string().optional().catch(undefined) }).parse(search),
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  loader: () => fetchMealPlan(),
  head: () => ({
    meta: [
      { title: 'Veckoplanerare' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: PersonalMealPlanPage,
})

function PersonalMealPlanPage() {
  const { plan, planList } = Route.useLoaderData()

  return <MealPlanClient initialPlan={plan} planList={planList} />
}
