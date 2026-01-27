import { getSession, signPostgrestToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SettingsViewToggle } from '@/components/settings-view-toggle'
import { HomeSettingsClient } from '@/components/home/home-settings-client'
import { env } from '@/lib/env'

async function getHomeInfo(token: string) {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const result = await response.json()

  // RPC returns JSONB directly (not wrapped in array)
  // If user is not in a home, function returns null
  if (result === null) {
    return null
  }

  return {
    id: result.id,
    name: result.name,
    join_code: result.join_code,
    join_code_expires_at: result.join_code_expires_at,
    member_count: result.members?.length || 0,
    members: result.members || [],
  }
}

export default async function HomeSettingsPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const postgrestToken = await signPostgrestToken(session.email)
  const home = await getHomeInfo(postgrestToken)

  return (
    <div className="space-y-6">
      <SettingsViewToggle activeView="hemmet" />
      <HomeSettingsClient home={home} userEmail={session.email} />
    </div>
  )
}
