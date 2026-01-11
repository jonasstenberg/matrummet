'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeInfo } from '@/lib/types'
import { HomeNameEditor } from './home-name-editor'
import { HomeMemberList } from './home-member-list'
import { HomeInviteSection } from './home-invite-section'
import { HomeLeaveDialog } from './home-leave-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  updateHomeName,
  generateJoinCode,
  disableJoinCode,
  inviteToHome,
  leaveHome,
  removeMember,
} from '@/lib/home-actions'

interface HomeSettingsProps {
  home: HomeInfo
  currentUserEmail: string
}

export function HomeSettings({ home: initialHome, currentUserEmail }: HomeSettingsProps) {
  const router = useRouter()
  const [home, setHome] = useState(initialHome)

  async function handleUpdateName(name: string) {
    const result = await updateHomeName(name)

    if ('error' in result) {
      throw new Error(result.error)
    }

    setHome((prev) => ({ ...prev, name }))
  }

  async function handleRefreshCode() {
    const result = await generateJoinCode()

    if ('error' in result) {
      throw new Error(result.error)
    }

    setHome((prev) => ({
      ...prev,
      join_code: result.code,
      join_code_expires_at: result.expires_at,
    }))
  }

  async function handleDisableCode() {
    const result = await disableJoinCode()

    if ('error' in result) {
      throw new Error(result.error)
    }

    setHome((prev) => ({
      ...prev,
      join_code: null,
      join_code_expires_at: null,
    }))
  }

  async function handleSendInvite(email: string) {
    const result = await inviteToHome(email)

    if ('error' in result) {
      throw new Error(result.error)
    }
  }

  async function handleLeaveHome() {
    const result = await leaveHome()

    if ('error' in result) {
      throw new Error(result.error)
    }

    router.refresh()
  }

  async function handleRemoveMember(email: string) {
    const result = await removeMember(email)

    if ('error' in result) {
      throw new Error(result.error)
    }

    setHome((prev) => ({
      ...prev,
      member_count: prev.member_count - 1,
      members: prev.members.filter((m) => m.email !== email),
    }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ditt hem</CardTitle>
          <CardDescription>
            Hantera ditt hem och dess medlemmar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Hemnamn
            </label>
            <HomeNameEditor name={home.name} onSave={handleUpdateName} />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Medlemmar</h3>
            <HomeMemberList
              members={home.members}
              currentUserEmail={currentUserEmail}
              onRemoveMember={handleRemoveMember}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Bjud in medlem</h3>
            <HomeInviteSection
              joinCode={
                home.join_code && home.join_code_expires_at
                  ? { code: home.join_code, expires_at: home.join_code_expires_at }
                  : null
              }
              onRefreshCode={handleRefreshCode}
              onDisableCode={handleDisableCode}
              onSendInvite={handleSendInvite}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-destructive">Farozon</h3>
            <p className="text-sm text-muted-foreground">
              Om du lämnar hemmet förlorar du åtkomst till delade recept och inköpslistor.
            </p>
            <HomeLeaveDialog homeName={home.name} onLeave={handleLeaveHome} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
