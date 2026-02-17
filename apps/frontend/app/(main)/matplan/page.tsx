import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getMealPlan, listMealPlans } from '@/lib/meal-plan-actions'
import { MealPlanClient } from '@/components/meal-plan/meal-plan-client'

export const metadata: Metadata = {
  title: 'Veckoplanerare',
  description: 'Din veckoplan för måltider',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PersonalMealPlanPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const [plan, planList] = await Promise.all([
    getMealPlan(),
    listMealPlans(),
  ])

  return (
    <MealPlanClient initialPlan={plan} planList={planList} />
  )
}
