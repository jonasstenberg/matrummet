import { redirect } from 'next/navigation'
import { getHomeInfo } from '@/lib/home-api'
import { BjudInClient } from '@/components/home/bjud-in-client'

export default async function BjudInPage() {
  const { home } = await getHomeInfo()

  // No home - redirect to hushall to create/join
  if (!home) {
    redirect('/hemmet/hushall')
  }

  return <BjudInClient home={home} />
}
