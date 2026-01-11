'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { HomeJoinCode } from './home-join-code'
import { HomeJoinCode as JoinCodeType } from '@/lib/types'
import { Send, Check } from 'lucide-react'

interface HomeInviteSectionProps {
  joinCode: JoinCodeType | null
  onRefreshCode: () => Promise<void>
  onDisableCode: () => Promise<void>
  onSendInvite: (email: string) => Promise<void>
}

export function HomeInviteSection({
  joinCode,
  onRefreshCode,
  onDisableCode,
  onSendInvite,
}: HomeInviteSectionProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSendInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      await onSendInvite(email.trim())
      setEmail('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunde inte skicka inbjudan')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Via e-post</h4>
        <form onSubmit={handleSendInvite} className="flex gap-2">
          <Input
            type="email"
            placeholder="namn@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !email.trim()}>
            {success ? (
              <Check className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>Inbjudan skickad!</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">eller</span>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Dela denna länk</Label>
        <HomeJoinCode joinCode={joinCode} onRefresh={onRefreshCode} onDisable={onDisableCode} />
      </div>
    </div>
  )
}
