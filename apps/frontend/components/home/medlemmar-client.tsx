'use client'

import { useState } from 'react'
import { HomeInfo } from '@/lib/types'
import { HomeMemberList } from './home-member-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { removeMember } from '@/lib/home-actions'

interface MedlemmarClientProps {
  home: HomeInfo
  userEmail: string
}

export function MedlemmarClient({ home: initialHome, userEmail }: MedlemmarClientProps) {
  const [home, setHome] = useState(initialHome)

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
    <Card>
      <CardHeader>
        <CardTitle>Medlemmar ({home.members.length})</CardTitle>
        <CardDescription>Personer som delar detta hem</CardDescription>
      </CardHeader>
      <CardContent>
        <HomeMemberList
          members={home.members}
          currentUserEmail={userEmail}
          onRemoveMember={handleRemoveMember}
        />
      </CardContent>
    </Card>
  )
}
