import { useState, useEffect } from 'react'
import { Share2, Copy, Check, RefreshCw, Loader2 } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  createCollectionShareLink,
  revokeCollectionShareLink,
} from '@/lib/collections-actions'

interface ShareCollectionDialogProps {
  collectionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShareCollectionDialog({
  collectionId,
  open,
  onOpenChange,
}: ShareCollectionDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Automatically create a share link when the dialog opens.
  useEffect(() => {
    if (!open) return
    if (shareUrl) return

    let cancelled = false

    async function createLink() {
      setIsLoading(true)
      setError(null)

      const result = await createCollectionShareLink(collectionId)
      if (cancelled) return

      setIsLoading(false)
      if ('error' in result) {
        setError(result.error)
        return
      }

      setShareUrl(result.url)
      setShareToken(result.token)
    }

    createLink()

    return () => {
      cancelled = true
    }
  }, [open, collectionId, shareUrl])

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCreateNewLink() {
    if (!shareToken) return
    setIsRefreshing(true)
    setError(null)

    const revokeResult = await revokeCollectionShareLink(shareToken)
    if ('error' in revokeResult) {
      setError(revokeResult.error)
      setIsRefreshing(false)
      return
    }

    const createResult = await createCollectionShareLink(collectionId)
    setIsRefreshing(false)
    if ('error' in createResult) {
      setError(createResult.error)
      return
    }

    setShareUrl(createResult.url)
    setShareToken(createResult.token)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dela samling</DialogTitle>
          <DialogDescription>
            Alla med länken kan se recepten i samlingen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shareUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="flex-1 text-sm" />
                <Button
                  size="icon"
                  variant={copied ? 'default' : 'outline'}
                  onClick={handleCopy}
                  aria-label="Kopiera länk"
                  className={copied ? 'bg-green-600 hover:bg-green-600' : ''}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="border-t pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateNewLink}
                  disabled={isRefreshing}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Skapa ny länk
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Den gamla länken slutar fungera.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ShareCollectionTriggerProps {
  collectionId: string
}

/** Standalone "Dela" button that opens the share dialog. */
export function ShareCollectionButton({ collectionId }: ShareCollectionTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} aria-label="Dela samling">
        <Share2 className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Dela</span>
      </Button>
      <ShareCollectionDialog
        collectionId={collectionId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
