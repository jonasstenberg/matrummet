import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getUserPantry,
  getCommonPantryItems,
} from '@/lib/ingredient-search-actions'
import { getUserHomes } from '@/lib/home-api'
import { MyPantry } from '@/components/my-pantry'

const fetchPantry = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ homeId: z.string() }))
  .handler(async ({ data: { homeId } }) => {
    const [pantryResult, commonItems, homes] = await Promise.all([
      getUserPantry(homeId),
      getCommonPantryItems(),
      getUserHomes(),
    ])

    const pantryItems = 'error' in pantryResult ? [] : pantryResult
    const homeName = homes.find((h) => h.home_id === homeId)?.home_name

    return { pantryItems, commonItems, homeId, homeName }
  })

export const Route = createFileRoute('/_main/hem/$homeId/skafferi')({
  loader: ({ params }) => fetchPantry({ data: { homeId: params.homeId } }),
  head: () => ({
    meta: [
      { title: 'Skafferi' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: HomePantryPage,
})

function HomePantryPage() {
  const { pantryItems, commonItems, homeId, homeName } = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Skafferi
        </h1>
        {homeName && (
          <p className="text-sm text-muted-foreground mt-1">{homeName}</p>
        )}
      </header>

      <MyPantry
        initialPantry={pantryItems}
        commonPantryItems={commonItems}
        homeId={homeId}
      />
    </div>
  )
}
