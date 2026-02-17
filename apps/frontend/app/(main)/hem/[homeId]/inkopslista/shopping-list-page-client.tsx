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
  pantryMap: Record<string, string | null>
  homeId: string
  homeName?: string
}

export function ShoppingListPageClient({
  lists,
  items,
  initialSelectedListId,
  pantryMap,
  homeId,
  homeName,
}: ShoppingListPageClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedListId = searchParams.get('list') || initialSelectedListId

  const handleSelectList = useCallback(
    (listId: string) => {
      router.push(`/hem/${homeId}/inkopslista?list=${listId}`)
    },
    [router, homeId]
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Inköpslista
        </h1>
        {homeName && (
          <p className="text-sm text-muted-foreground mt-1">{homeName}</p>
        )}
      </header>

      <ShoppingListManager
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={handleSelectList}
        homeId={homeId}
      />

      <ShoppingListComponent
        items={selectedListId ? items : []}
        listId={selectedListId || undefined}
        pantryMap={pantryMap}
        homeId={homeId}
      />
    </div>
  )
}
