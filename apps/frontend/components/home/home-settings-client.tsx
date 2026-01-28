// @deprecated — Replaced by /hemmet/hushall, /hemmet/medlemmar, /hemmet/bjud-in sub-pages (Phase 03). Remove in future cleanup.
'use client'

import { useRouter } from 'next/navigation'
import { HomeInfo } from '@/lib/types'
import { HomeSettings, HomeSetupWizard } from '@/components/home'
import { createHome } from '@/lib/home-actions'

interface HomeSettingsClientProps {
  home: HomeInfo | null
  userEmail: string
}

export function HomeSettingsClient({ home, userEmail }: HomeSettingsClientProps) {
  const router = useRouter()

  async function handleCreateHome(name: string) {
    const result = await createHome(name)

    if ('error' in result) {
      throw new Error(result.error)
    }

    router.refresh()
  }

  if (!home) {
    return (
      <HomeSetupWizard
        onCreateHome={handleCreateHome}
      />
    )
  }

  return <HomeSettings home={home} currentUserEmail={userEmail} />
}
