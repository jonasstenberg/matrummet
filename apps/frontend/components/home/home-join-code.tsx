'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, RefreshCw, Trash2 } from 'lucide-react'
import { HomeJoinCode as JoinCodeType } from '@/lib/types'

interface HomeJoinCodeProps {
  joinCode: JoinCodeType | null
  onRefresh: () => Promise<void>
  onDisable: () => Promise<void>
}

export function HomeJoinCode({ joinCode, onRefresh, onDisable }: HomeJoinCodeProps) {
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)

  function getJoinUrl(code: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/join/${code}`
  }

  async function handleCopy() {
    if (!joinCode) return

    const joinUrl = getJoinUrl(joinCode.code)
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleDisable() {
    setIsDisabling(true)
    try {
      await onDisable()
    } finally {
      setIsDisabling(false)
    }
  }

  function formatExpiration(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) {
      return 'Utgången'
    } else if (diffDays === 1) {
      return 'Giltig i 1 dag'
    } else {
      return `Giltig i ${diffDays} dagar`
    }
  }

  if (!joinCode) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ingen aktiv inbjudningslänk. Skapa en ny länk för att bjuda in medlemmar.
        </p>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Skapa länk
        </Button>
      </div>
    )
  }

  const isExpired = new Date(joinCode.expires_at) <= new Date()
  const joinUrl = getJoinUrl(joinCode.code)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          readOnly
          value={joinUrl}
          className="flex-1 font-mono text-sm"
        />
        <Button
          size="icon"
          variant="outline"
          onClick={handleCopy}
          title="Kopiera länk"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-sm ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
          {formatExpiration(joinCode.expires_at)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing || isDisabling}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Förnya länk
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDisable}
            disabled={isRefreshing || isDisabling}
            aria-label="Ta bort länk"
            title="Ta bort länk"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}
