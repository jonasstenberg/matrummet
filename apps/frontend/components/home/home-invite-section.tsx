'use client'

import { useState } from 'react'
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
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground/70">
          Inbjudningslänk
        </h4>
        <p className="text-xs text-muted-foreground/60">
          Skapa en länk som du kan skicka till den du vill bjuda in. Giltig i 7
          dagar.
        </p>
        <HomeJoinCode
          joinCode={joinCode}
          onRefresh={onRefreshCode}
          onDisable={onDisableCode}
        />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground/70">
          Bjud in via e-post
        </h4>
        <form onSubmit={handleSendInvite} className="relative">
          <input
            type="email"
            placeholder="namn@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-primary transition-colors hover:bg-primary/10 disabled:text-muted-foreground/30"
          >
            {success ? (
              <Check className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && <p className="text-xs text-primary">Inbjudan skickad!</p>}
      </div>
    </div>
  )
}
