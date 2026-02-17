'use client'

import { useState, useTransition } from 'react'
import { removeBookShareConnection } from '@/lib/book-share-actions'
import { BookOpen, Trash2 } from '@/lib/icons'
import type { BookShareConnection } from '@/lib/types'

interface BookShareConnectionsListProps {
  initialConnections: BookShareConnection[]
}

export function BookShareConnectionsList({ initialConnections }: BookShareConnectionsListProps) {
  const [connections, setConnections] = useState(initialConnections)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRemove(connectionId: string) {
    setRemovingId(connectionId)
    startTransition(async () => {
      const result = await removeBookShareConnection(connectionId)

      if ('success' in result && result.success) {
        setConnections((prev) => prev.filter((c) => c.id !== connectionId))
      }
      setRemovingId(null)
    })
  }

  if (connections.length === 0) {
    return (
      <section className="rounded-2xl bg-card p-6 shadow-(--shadow-card)">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Receptböcker du följer</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Du följer inga receptböcker ännu. Be någon dela sin receptbok med dig.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-card p-6 shadow-(--shadow-card)">
      <div className="flex items-center gap-3 mb-4">
        <BookOpen className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Receptböcker du följer</h2>
      </div>
      <ul className="divide-y divide-border/40">
        {connections.map((connection) => (
          <li key={connection.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{connection.sharer_name}</p>
              <p className="text-xs text-muted-foreground">
                Sedan {new Date(connection.created_at).toLocaleDateString('sv-SE')}
              </p>
            </div>
            <button
              onClick={() => handleRemove(connection.id)}
              disabled={isPending && removingId === connection.id}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Ta bort
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
