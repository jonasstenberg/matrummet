'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeInfo } from '@/lib/types'
import { HomeNameEditor } from './home-name-editor'
import { HomeMemberList } from './home-member-list'
import { HomeInviteSection } from './home-invite-section'
import { HomeLeaveDialog } from './home-leave-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
          <CardTitle>Hemmet</CardTitle>
          <CardDescription>
            Namn och grundinformation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Hemnamn
            </label>
            <HomeNameEditor name={home.name} onSave={handleUpdateName} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medlemmar ({home.members.length})</CardTitle>
          <CardDescription>
            Personer som delar detta hem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HomeMemberList
            members={home.members}
            currentUserEmail={currentUserEmail}
            onRemoveMember={handleRemoveMember}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bjud in medlem</CardTitle>
          <CardDescription>
            Bjud in nya medlemmar via e-post eller delningslänk
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">Farozon</CardTitle>
          <CardDescription>
            Åtgärder som inte kan ångras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Om du lämnar hemmet förlorar du åtkomst till delade recept och inköpslistor.
          </p>
          <HomeLeaveDialog homeName={home.name} onLeave={handleLeaveHome} />
        </CardContent>
      </Card>
    </div>
  )
}
