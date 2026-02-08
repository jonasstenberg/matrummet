'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createApiKey, revokeApiKey } from '@/lib/actions'
import { ApiKey } from '@/lib/types'
import { AlertTriangle, Check, Copy, Key, Plus, Trash2 } from 'lucide-react'

interface ApiKeyManagerProps {
  initialKeys: ApiKey[]
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Aldrig använd'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSeconds < 60) return 'Just nu'
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? 'minut' : 'minuter'} sedan`
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'timme' : 'timmar'} sedan`
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagar'} sedan`
  if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? 'vecka' : 'veckor'} sedan`
  return `${diffMonths} ${diffMonths === 1 ? 'månad' : 'månader'} sedan`
}

export function ApiKeyManager({ initialKeys }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys)

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // New key display state
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Revoke dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCreateError(null)

    if (!keyName.trim()) {
      setCreateError('Ange ett namn för nyckeln')
      return
    }

    setIsCreating(true)

    try {
      const result = await createApiKey(keyName.trim())

      if ('error' in result) {
        setCreateError(result.error)
        return
      }

      setKeys((prev) => [
        {
          id: result.id,
          name: keyName.trim(),
          prefix: result.prefix,
          last_used_at: null,
          date_published: new Date().toISOString(),
        },
        ...prev,
      ])

      setNewApiKey(result.apiKey)
      setCreateDialogOpen(false)
      setKeyName('')
      setNewKeyDialogOpen(true)
    } catch {
      setCreateError('Ett oväntat fel uppstod')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCopy() {
    if (!newApiKey) return

    try {
      await navigator.clipboard.writeText(newApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = newApiKey
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleCloseNewKeyDialog() {
    setNewKeyDialogOpen(false)
    setNewApiKey(null)
    setCopied(false)
  }

  function openRevokeDialog(key: ApiKey) {
    setKeyToRevoke(key)
    setRevokeError(null)
    setRevokeDialogOpen(true)
  }

  async function handleRevoke() {
    if (!keyToRevoke) return

    setIsRevoking(true)
    setRevokeError(null)

    try {
      const result = await revokeApiKey(keyToRevoke.id)

      if ('error' in result) {
        setRevokeError(result.error)
        return
      }

      setKeys((prev) => prev.filter((k) => k.id !== keyToRevoke.id))
      setRevokeDialogOpen(false)
      setKeyToRevoke(null)
    } catch {
      setRevokeError('Ett oväntat fel uppstod')
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Info + create button */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[15px] text-muted-foreground">
                Hantera API-nycklar för externa integrationer.{' '}
                <a
                  href="/api-docs"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  API-dokumentation
                </a>
              </p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ny nyckel
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Skapa ny API-nyckel</DialogTitle>
                  <DialogDescription>
                    Ge nyckeln ett beskrivande namn så du vet vad den används till.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="keyName">Namn</Label>
                      <Input
                        id="keyName"
                        type="text"
                        placeholder="t.ex. Home Assistant"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        disabled={isCreating}
                        autoFocus
                      />
                    </div>
                    {createError && (
                      <Alert variant="destructive">
                        <AlertDescription>{createError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCreateDialogOpen(false)
                        setKeyName('')
                        setCreateError(null)
                      }}
                      disabled={isCreating}
                    >
                      Avbryt
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Skapar...' : 'Skapa nyckel'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Key list */}
      {keys.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <div className="px-5 py-10 text-center">
            <Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-[15px] text-muted-foreground">Inga API-nycklar</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Skapa en för att integrera med Home Assistant.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          {keys.map((key, i) => (
            <div
              key={key.id}
              className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30 ${
                i > 0 ? 'border-t border-border/40' : ''
              }`}
            >
              <Key className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium truncate">{key.name}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
                  <code className="font-mono">{key.prefix}...</code>
                  {key.last_used_at && (
                    <span>{formatRelativeTime(key.last_used_at)}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openRevokeDialog(key)}
                className="shrink-0 rounded-full p-1.5 text-destructive/60 transition-colors hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Ta bort</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Key Display Dialog */}
      <Dialog open={newKeyDialogOpen} onOpenChange={handleCloseNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API-nyckel skapad</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Spara nyckeln nu! Den visas bara en gång.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>Din API-nyckel</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newApiKey || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Kopierad
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Kopiera
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseNewKeyDialog}>Stäng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort API-nyckel?</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort nyckeln &quot;{keyToRevoke?.name}&quot;?
              Alla integrationer som använder denna nyckel kommer sluta fungera.
            </DialogDescription>
          </DialogHeader>
          {revokeError && (
            <Alert variant="destructive">
              <AlertDescription>{revokeError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRevokeDialogOpen(false)}
              disabled={isRevoking}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? 'Tar bort...' : 'Ta bort nyckel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
