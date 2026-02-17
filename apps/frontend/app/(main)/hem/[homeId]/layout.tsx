import { redirect } from 'next/navigation'
import { getUserHomes } from '@/lib/home-api'
import { HomeProvider } from '@/lib/home-context'

interface HomeLayoutProps {
  children: React.ReactNode
  params: Promise<{ homeId: string }>
}

export default async function HomeLayout({ children, params }: HomeLayoutProps) {
  const { homeId } = await params
  const homes = await getUserHomes()

  const home = homes.find((h) => h.home_id === homeId)

  if (!home) {
    redirect('/hushall')
  }

  return (
    <HomeProvider homeId={homeId} homeName={home.home_name}>
      {children}
    </HomeProvider>
  )
}
