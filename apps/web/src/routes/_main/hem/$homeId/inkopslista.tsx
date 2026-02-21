import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { getUserShoppingLists } from '@/lib/actions'
import { getUserPantry } from '@/lib/ingredient-search-actions'
import { getUserHomes } from '@/lib/home-api'
import { getShoppingList } from '@/lib/api'
import { ShoppingListPageClient } from '@/components/shopping-list-page-client'

const fetchShoppingList = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ homeId: z.string(), list: z.string().optional() }))
  .handler(async ({ data: { homeId, list: listParam } }) => {
    // Session is guaranteed by beforeLoad, but we need it here for the token
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }

    const token = await signPostgrestToken(session.email)

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
    if (listParam && lists.find((l) => l.id === listParam)) {
      selectedListId = listParam
    } else if (lists.length > 0) {
      const defaultList = lists.find((l) => l.is_default)
      selectedListId = defaultList?.id || lists[0].id
    }

    // Fetch items for the selected list
    const items = selectedListId
      ? await getShoppingList(token, selectedListId, homeId)
      : []

    // Build a food_id -> expires_at map for pantry items
    const pantryMap: Record<string, string | null> = {}
    for (const p of pantryItems) {
      pantryMap[p.food_id] = p.expires_at
    }

    return { lists, items, selectedListId, pantryMap, homeId, homeName }
  })

export const Route = createFileRoute('/_main/hem/$homeId/inkopslista')({
  validateSearch: (search) =>
    z.object({ list: z.string().optional().catch(undefined) }).parse(search),
  loaderDeps: ({ search }) => ({ list: search.list }),
  loader: ({ params, deps }) =>
    fetchShoppingList({
      data: { homeId: params.homeId, list: deps.list },
    }),
  head: () => ({
    meta: [
      { title: 'Inköpslista' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: HomeShoppingListPage,
})

function HomeShoppingListPage() {
  const { lists, items, selectedListId, pantryMap, homeId, homeName } =
    Route.useLoaderData()

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
