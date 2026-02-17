'use client'

import { useState, useTransition } from 'react'
import { createBookShareLink } from '@/lib/book-share-actions'
import { Copy, Check, BookOpen } from '@/lib/icons'

export function ShareBookSection() {
  const [isPending, startTransition] = useTransition()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleCreateLink() {
    startTransition(async () => {
      setError(null)
      const result = await createBookShareLink()

      if ('error' in result) {
        setError(result.error)
        return
      }

      setShareUrl(result.url)
    })
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="rounded-2xl bg-card p-6 shadow-(--shadow-card)">
      <div className="flex items-center gap-3 mb-4">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Dela din receptbok</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Skapa en länk som du kan skicka till någon. När de accepterar kan de se alla dina recept.
      </p>
      {shareUrl ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
          />
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
          </button>
        </div>
      ) : (
        <button
          onClick={handleCreateLink}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Skapar länk...' : 'Skapa delningslänk'}
        </button>
      )}
      {error && (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      )}
    </section>
  )
}
