import { redirect } from 'next/navigation'
import { getHomeInfo } from '@/lib/home-api'
import { MedlemmarClient } from '@/components/home/medlemmar-client'

export default async function MedlemmarPage() {
  const { home, userEmail } = await getHomeInfo()

  // No home - redirect to hushall to create/join
  if (!home) {
    redirect('/hemmet/hushall')
  }

  return <MedlemmarClient home={home} userEmail={userEmail} />
}
