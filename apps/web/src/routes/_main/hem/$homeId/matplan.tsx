import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getUserHomes } from '@/lib/home-api'
import { getMealPlan, listMealPlans } from '@/lib/meal-plan-actions'
import { MealPlanClient } from '@/components/meal-plan/meal-plan-client'

const fetchHomeMealPlan = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ homeId: z.string() }))
  .handler(async ({ data: { homeId } }) => {
    const homes = await getUserHomes()
    const homeName = homes.find((h) => h.home_id === homeId)?.home_name

    const [plan, planList] = await Promise.all([
      getMealPlan(undefined, homeId),
      listMealPlans(homeId),
    ])

    return { plan, planList, homeId, homeName }
  })

export const Route = createFileRoute('/_main/hem/$homeId/matplan')({
  validateSearch: (search) =>
    z.object({ view: z.string().optional().catch(undefined) }).parse(search),
  loader: ({ params }) =>
    fetchHomeMealPlan({ data: { homeId: params.homeId } }),
  head: () => ({
    meta: [
      { title: 'Veckoplanerare' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: HomeMealPlanPage,
})

function HomeMealPlanPage() {
  const { plan, planList, homeId, homeName } = Route.useLoaderData()

  return (
    <MealPlanClient
      initialPlan={plan}
      planList={planList}
      homeId={homeId}
      homeName={homeName}
    />
  )
}
