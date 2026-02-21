
import { useState } from 'react'
import { Copy, Check, RefreshCw, Trash2 } from '@/lib/icons'
import { HomeJoinCode as JoinCodeType } from '@/lib/types'

interface HomeJoinCodeProps {
  joinCode: JoinCodeType | null
  onRefresh: () => Promise<void>
  onDisable: () => Promise<void>
}

export function HomeJoinCode({
  joinCode,
  onRefresh,
  onDisable,
}: HomeJoinCodeProps) {
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)

  function getJoinUrl(code: string): string {
    const baseUrl =
      typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/join/${code}`
  }

  async function handleCopy() {
    if (!joinCode) return
    await navigator.clipboard.writeText(getJoinUrl(joinCode.code))
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
    const diffMs = date.getTime() - Date.now()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) return 'Utgången'
    if (diffDays === 1) return 'Giltig i 1 dag'
    return `Giltig i ${diffDays} dagar`
  }

  if (!joinCode) {
    return (
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <RefreshCw
          className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`}
        />
        Skapa länk
      </button>
    )
  }

  const isExpired = new Date(joinCode.expires_at) <= new Date()
  const joinUrl = getJoinUrl(joinCode.code)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={joinUrl}
          className="flex-1 min-w-0 bg-transparent text-xs font-mono text-muted-foreground truncate focus:outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
          title="Kopiera länk"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${isExpired ? 'text-destructive' : 'text-muted-foreground/60'}`}
        >
          {formatExpiration(joinCode.expires_at)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isDisabling}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-30"
            title="Förnya länk"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={handleDisable}
            disabled={isRefreshing || isDisabling}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            title="Ta bort länk"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
