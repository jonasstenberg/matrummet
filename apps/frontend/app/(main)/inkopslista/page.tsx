import type { Metadata } from 'next'
import { ShoppingListPageClient } from './shopping-list-page-client'
import { getShoppingList } from '@/lib/api'
import { getUserShoppingLists } from '@/lib/actions'
import { getUserPantry } from '@/lib/ingredient-search-actions'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Inköpslista',
  description: 'Din inköpslista',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ list?: string }>
}

export default async function ShoppingListPage({ searchParams }: PageProps) {
  const session = await getSession()

  // Protected route - redirect to login if not authenticated
  if (!session) {
    redirect('/login')
  }

  const token = await signPostgrestToken(session.email)
  const params = await searchParams

  // Get all shopping lists
  const listsResult = await getUserShoppingLists()
  const lists = 'error' in listsResult ? [] : listsResult

  // Determine which list to show
  let selectedListId: string | null = null
  if (params.list && lists.find((l) => l.id === params.list)) {
    selectedListId = params.list
  } else if (lists.length > 0) {
    // Default to the default list, or the first list
    const defaultList = lists.find((l) => l.is_default)
    selectedListId = defaultList?.id || lists[0].id
  }

  // Fetch items for the selected list and pantry data in parallel
  const [items, pantryResult] = await Promise.all([
    selectedListId ? getShoppingList(token, selectedListId) : Promise.resolve([]),
    getUserPantry(),
  ])

  // Build a food_id -> expires_at map for pantry items
  const pantryMap: Record<string, string | null> = {}
  if (!('error' in pantryResult)) {
    for (const p of pantryResult) {
      pantryMap[p.food_id] = p.expires_at
    }
  }

  return (
    <ShoppingListPageClient
      lists={lists}
      items={items}
      initialSelectedListId={selectedListId}
      pantryMap={pantryMap}
    />
  )
}
