import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUserHomes } from '@/lib/home-api'
import { getMealPlan, listMealPlans } from '@/lib/meal-plan-actions'
import { MealPlanClient } from '@/components/meal-plan/meal-plan-client'

export const metadata: Metadata = {
  title: 'Veckoplanerare',
  description: 'Din veckoplan för måltider',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ homeId: string }>
}

export default async function HomeMealPlanPage({ params }: PageProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { homeId } = await params
  const homes = await getUserHomes()
  const homeName = homes.find((h) => h.home_id === homeId)?.home_name

  const [plan, planList] = await Promise.all([
    getMealPlan(undefined, homeId),
    listMealPlans(homeId),
  ])

  return (
    <MealPlanClient
      initialPlan={plan}
      planList={planList}
      homeId={homeId}
      homeName={homeName}
    />
  )
}
