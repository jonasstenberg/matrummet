'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeInfo } from '@/lib/types'
import { HomeNameEditor } from './home-name-editor'
import { HomeLeaveDialog } from './home-leave-dialog'
import { updateHomeName, leaveHome } from '@/lib/home-actions'
import { LogOut, Users, ChevronRight } from '@/lib/icons'
import Link from 'next/link'

interface HushallClientProps {
  home: HomeInfo
}

export function HushallClient({ home: initialHome }: HushallClientProps) {
  const router = useRouter()
  const [home, setHome] = useState(initialHome)

  async function handleUpdateName(name: string) {
    const result = await updateHomeName(name)
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({ ...prev, name }))
  }

  async function handleLeaveHome() {
    const result = await leaveHome()
    if ('error' in result) throw new Error(result.error)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Household info card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        {/* Name row */}
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-muted-foreground/70 mb-1.5">
            Namn
          </div>
          <HomeNameEditor name={home.name} onSave={handleUpdateName} />
        </div>

        {/* Members link */}
        <Link
          href="/hushall/medlemmar"
          className="flex items-center gap-3 border-t border-border/40 px-5 py-3.5 transition-colors hover:bg-muted/30"
        >
          <Users className="h-4 w-4 text-muted-foreground/60" />
          <span className="flex-1 text-[15px] font-medium">Medlemmar</span>
          <span className="text-sm text-muted-foreground">
            {home.member_count}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        </Link>
      </div>

      {/* Leave household */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <HomeLeaveDialog homeName={home.name} onLeave={handleLeaveHome}>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] text-destructive transition-colors hover:bg-destructive/5"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Lämna hushållet</span>
          </button>
        </HomeLeaveDialog>
      </div>
    </div>
  )
}
