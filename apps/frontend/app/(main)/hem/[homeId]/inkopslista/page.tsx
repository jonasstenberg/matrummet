import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { getUserShoppingLists } from '@/lib/actions'
import { getUserPantry } from '@/lib/ingredient-search-actions'
import { getUserHomes } from '@/lib/home-api'
import { getShoppingList } from '@/lib/api'
import { ShoppingListPageClient } from './shopping-list-page-client'

export const metadata: Metadata = {
  title: 'Inköpslista',
  description: 'Din inköpslista',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ homeId: string }>
  searchParams: Promise<{ list?: string }>
}

export default async function HomeShoppingListPage({ params, searchParams }: PageProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { homeId } = await params
  const token = await signPostgrestToken(session.email)
  const sp = await searchParams

  // Get shopping lists, pantry, and homes in parallel
  const [listsResult, pantryResult, homes] = await Promise.all([
    getUserShoppingLists(homeId),
    getUserPantry(homeId),
    getUserHomes(),
  ])
  const lists = 'error' in listsResult ? [] : listsResult
  const pantryItems = Array.isArray(pantryResult) ? pantryResult : []
  const homeName = homes.find((h) => h.home_id === homeId)?.home_name

  // Determine which list to show
  let selectedListId: string | null = null
  if (sp.list && lists.find((l) => l.id === sp.list)) {
    selectedListId = sp.list
  } else if (lists.length > 0) {
    const defaultList = lists.find((l) => l.is_default)
    selectedListId = defaultList?.id || lists[0].id
  }

  // Fetch items for the selected list
  const items = selectedListId ? await getShoppingList(token, selectedListId, homeId) : []

  // Build a food_id -> expires_at map for pantry items
  const pantryMap: Record<string, string | null> = {}
  for (const p of pantryItems) {
    pantryMap[p.food_id] = p.expires_at
  }

  return (
    <ShoppingListPageClient
      lists={lists}
      items={items}
      initialSelectedListId={selectedListId}
      pantryMap={pantryMap}
      homeId={homeId}
      homeName={homeName}
    />
  )
}
