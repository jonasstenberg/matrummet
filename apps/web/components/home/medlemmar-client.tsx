
import { useState } from 'react'
import { HomeInfo } from '@/lib/types'
import { HomeMemberList } from './home-member-list'
import { HomeInviteSection } from './home-invite-section'
import {
  removeMember,
  generateJoinCode,
  disableJoinCode,
  inviteToHome,
} from '@/lib/home-actions'
import { ChevronDown } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface MedlemmarClientProps {
  home: HomeInfo
  userEmail: string
}

export function MedlemmarClient({
  home: initialHome,
  userEmail,
}: MedlemmarClientProps) {
  const [home, setHome] = useState(initialHome)
  const [inviteCollapsed, setInviteCollapsed] = useState(true)

  async function handleRemoveMember(email: string) {
    const result = await removeMember(email)
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({
      ...prev,
      member_count: prev.member_count - 1,
      members: prev.members.filter((m) => m.email !== email),
    }))
  }

  async function handleRefreshCode() {
    const result = await generateJoinCode()
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({
      ...prev,
      join_code: result.code,
      join_code_expires_at: result.expires_at,
    }))
  }

  async function handleDisableCode() {
    const result = await disableJoinCode()
    if ('error' in result) throw new Error(result.error)
    setHome((prev) => ({
      ...prev,
      join_code: null,
      join_code_expires_at: null,
    }))
  }

  async function handleSendInvite(email: string) {
    const result = await inviteToHome(email)
    if ('error' in result) throw new Error(result.error)
  }

  return (
    <div className="space-y-4">
      {/* Members card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
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
    </div>
  )
}
