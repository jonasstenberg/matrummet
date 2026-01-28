'use client'

import { useState } from 'react'
import { HomeInfo } from '@/lib/types'
import { HomeInviteSection } from './home-invite-section'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { generateJoinCode, disableJoinCode, inviteToHome } from '@/lib/home-actions'

interface BjudInClientProps {
  home: HomeInfo
}

export function BjudInClient({ home: initialHome }: BjudInClientProps) {
  const [home, setHome] = useState(initialHome)

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

  return (
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
  )
}
