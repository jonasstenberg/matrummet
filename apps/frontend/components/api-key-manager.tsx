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
import { AlertTriangle, Check, Copy, ExternalLink, Key, Plus, Trash2 } from 'lucide-react'

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
  const [error, setError] = useState<string | null>(null)

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

      // Add the new key to the list (without the full key, just the prefix)
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

      // Show the new key dialog
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
      // Fallback for older browsers
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

      // Remove the key from the list
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
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">API-nycklar</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hantera API-nycklar för externa integrationer som Home Assistant.{' '}
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Se API-dokumentation
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            API:et stödjer: Hämta inköpslista, bocka av/på varor, rensa avbockade varor.
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Skapa ny nyckel
            </Button>
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

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Inga API-nycklar.</p>
          <p className="text-sm">Skapa en för att integrera med Home Assistant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-background"
            >
              <div className="space-y-1">
                <div className="font-medium">{key.name}</div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <code className="font-mono bg-muted px-2 py-0.5 rounded">
                    {key.prefix}...
                  </code>
                  <span>Senast använd: {formatRelativeTime(key.last_used_at)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => openRevokeDialog(key)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Ta bort</span>
              </Button>
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
