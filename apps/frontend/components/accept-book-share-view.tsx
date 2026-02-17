'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptBookShare } from '@/lib/book-share-actions'
import { BookOpen } from '@/lib/icons'
import type { BookShareInfo } from '@/lib/types'

interface AcceptBookShareViewProps {
  info: BookShareInfo
  token: string
}

export function AcceptBookShareView({ info, token }: AcceptBookShareViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptBookShare(token)

      if ('error' in result) {
        setError(result.error)
        return
      }

      router.push('/')
    })
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">{info.sharer_name}s receptbok</h1>
      <p className="mb-6 text-muted-foreground">
        {info.sharer_name} vill dela sin receptbok med dig ({info.recipe_count} recept).
        <br />
        Du kommer kunna se alla deras recept på startsidan.
      </p>
      {error && (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      )}
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Accepterar...' : 'Acceptera'}
      </button>
    </div>
  )
}
