'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { ShoppingList as ShoppingListComponent } from '@/components/shopping-list'
import { ShoppingListManager } from '@/components/shopping-list-manager'
import type { ShoppingListItem, ShoppingList } from '@/lib/types'

interface ShoppingListPageClientProps {
  lists: ShoppingList[]
  items: ShoppingListItem[]
  initialSelectedListId: string | null
}

export function ShoppingListPageClient({
  lists,
  items,
  initialSelectedListId,
}: ShoppingListPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedListId = searchParams.get('list') || initialSelectedListId
  const selectedList = lists.find((l) => l.id === selectedListId)

  const handleSelectList = useCallback(
    (listId: string) => {
      router.push(`/inkopslista?list=${listId}`)
    },
    [router]
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Inköpslista
        </h1>
      </header>

      {/* Shopping list manager */}
      <ShoppingListManager
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={handleSelectList}
      />

      {/* Shopping list content */}
      <ShoppingListComponent
        items={selectedList ? items : []}
        listId={selectedListId || undefined}
      />
    </div>
  )
}
