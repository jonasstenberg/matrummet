'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeInfo } from '@/lib/types'
import { useHome } from '@/lib/home-context'
import { HomeNameEditor } from '@/components/home/home-name-editor'
import { HomeLeaveDialog } from '@/components/home/home-leave-dialog'
import { HomeMemberList } from '@/components/home/home-member-list'
import { HomeInviteSection } from '@/components/home/home-invite-section'
import {
  updateHomeName,
  leaveHome,
  removeMember,
  generateJoinCode,
  disableJoinCode,
  inviteToHome,
} from '@/lib/home-actions'
import { LogOut, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HomeSettingsClientProps {
  home: HomeInfo
  userEmail: string
}

export function HomeSettingsClient({ home: initialHome, userEmail }: HomeSettingsClientProps) {
  const router = useRouter()
  const { homeId } = useHome()
  const [home, setHome] = useState(initialHome)
  const [inviteCollapsed, setInviteCollapsed] = useState(true)

  const isLastMember = home.member_count <= 1

  async function handleUpdateName(name: string) {
    const result = await updateHomeName(name, homeId)
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({ ...prev, name }))
  }

  async function handleLeaveHome() {
    const result = await leaveHome(homeId)
    if ('error' in result) throw new Error(result.error)
    router.push('/hushall')
    router.refresh()
  }

  async function handleRemoveMember(email: string) {
    const result = await removeMember(email, homeId)
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({
      ...prev,
      member_count: prev.member_count - 1,
      members: prev.members.filter((m) => m.email !== email),
    }))
  }

  async function handleRefreshCode() {
    const result = await generateJoinCode(undefined, homeId)
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({
      ...prev,
      join_code: result.code,
      join_code_expires_at: result.expires_at,
    }))
  }

  async function handleDisableCode() {
    const result = await disableJoinCode(homeId)
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({
      ...prev,
      join_code: null,
      join_code_expires_at: null,
    }))
  }

  async function handleSendInvite(email: string) {
    const result = await inviteToHome(email, homeId)
    if ('error' in result) throw new Error(result.error)
  }

  return (
    <div className="space-y-4">
      {/* Home info card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        {/* Name row */}
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-muted-foreground/70 mb-1.5">
            Namn
          </div>
          <HomeNameEditor name={home.name} onSave={handleUpdateName} />
        </div>
      </div>

      {/* Members card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <div className="px-5 py-3.5">
          <h2 className="text-sm font-medium text-muted-foreground">
            Medlemmar ({home.member_count})
          </h2>
        </div>
        <HomeMemberList
          members={home.members}
          currentUserEmail={userEmail}
          onRemoveMember={handleRemoveMember}
        />
      </div>

      {/* Invite section — collapsible card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <button
          type="button"
          onClick={() => setInviteCollapsed((prev) => !prev)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <span className="font-medium">Bjud in</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              inviteCollapsed && '-rotate-90'
            )}
          />
        </button>
        {!inviteCollapsed && (
          <div className="border-t border-border/40 px-5 py-4">
            <HomeInviteSection
              joinCode={
                home.join_code && home.join_code_expires_at
                  ? {
                      code: home.join_code,
                      expires_at: home.join_code_expires_at,
                    }
                  : null
              }
              onRefreshCode={handleRefreshCode}
              onDisableCode={handleDisableCode}
              onSendInvite={handleSendInvite}
            />
          </div>
        )}
      </div>

      {/* Leave / delete home */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <HomeLeaveDialog homeName={home.name} onLeave={handleLeaveHome} isDelete={isLastMember}>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] text-destructive transition-colors hover:bg-destructive/5"
          >
            {isLastMember ? <Trash2 className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            <span className="font-medium">{isLastMember ? 'Ta bort hushållet' : 'Lämna hushållet'}</span>
          </button>
        </HomeLeaveDialog>
      </div>
    </div>
  )
}
