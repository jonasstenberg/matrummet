import { useState, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { acceptCollectionShare } from '@/lib/collections-actions'
import { Library } from '@/lib/icons'
import type { CollectionShareInfo } from '@/lib/types'

interface AcceptCollectionShareViewProps {
  info: CollectionShareInfo
  token: string
}

export function AcceptCollectionShareView({
  info,
  token,
}: AcceptCollectionShareViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptCollectionShare(token)

      if ('error' in result) {
        setError(result.error)
        return
      }

      await router.invalidate()
      router.navigate({
        to: '/samlingar/$id',
        params: { id: result.collection_id },
      })
    })
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Library className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">{info.collection_name}</h1>
      <p className="mb-6 text-muted-foreground">
        {info.sharer_name} vill dela samlingen med dig ({info.recipe_count}{' '}
        recept).
        <br />
        Du kommer kunna se recepten i samlingen.
      </p>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? 'Accepterar...' : 'Acceptera'}
      </button>
    </div>
  )
}
