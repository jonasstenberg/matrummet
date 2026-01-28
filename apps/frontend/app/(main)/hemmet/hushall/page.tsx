import { getHomeInfo } from '@/lib/home-api'
import { HushallClient } from '@/components/home/hushall-client'

export default async function HushallPage() {
  const { home, userEmail } = await getHomeInfo()

  // HushallClient handles both no-home (setup wizard) and has-home (household info) cases
  return <HushallClient home={home} userEmail={userEmail} />
}
