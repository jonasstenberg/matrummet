'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserHome } from '@/lib/types'
import { HomeCreateDialog } from './home-create-dialog'
import { createHome } from '@/lib/home-actions'
import { Users, ChevronRight, Settings } from '@/lib/icons'

interface HushallOverviewProps {
  homes: UserHome[]
}

export function HushallOverview({ homes }: HushallOverviewProps) {
  const router = useRouter()

  async function handleCreateHome(name: string) {
    const result = await createHome(name)
    if ('error' in result) throw new Error(result.error)
    router.push(`/hem/${result.id}/installningar`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Home cards */}
      {homes.map((home) => (
        <div key={home.home_id} className="rounded-2xl bg-card shadow-(--shadow-card)">
          <div className="px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">{home.home_name}</h2>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{home.member_count} {home.member_count === 1 ? 'medlem' : 'medlemmar'}</span>
            </div>
          </div>
          <div className="border-t border-border/40">
            <Link
              href={`/hem/${home.home_id}/installningar`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
            >
              <Settings className="h-4 w-4 text-muted-foreground/60" />
              <span className="flex-1 text-[15px] font-medium">Inställningar</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </Link>
          </div>
        </div>
      ))}

      {/* Create new home button */}
      <HomeCreateDialog onCreateHome={handleCreateHome} />
    </div>
  )
}
