import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSession, signPostgrestToken } from '@/lib/auth'
import {
  getRecipesWithCount,
  getCategories,
  getFeaturedRecipes,
} from '@/lib/api'
import { getUserPantry } from '@/lib/ingredient-search-actions'
import { buildMemberData, resolveSelectedMembers } from '@/lib/member-utils'
import { RecipePageClient } from '@/components/recipe-page-client'
import { LandingPage } from '@/components/landing-page'

const PAGE_SIZE = 24

const fetchHomeData = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ offset: z.string().optional(), members: z.string().optional() }),
  )
  .handler(async ({ data: { offset: offsetParam, members: membersParam } }) => {
    const session = await getSession()

    if (!session) {
      const featuredRecipes = await getFeaturedRecipes(4)
      return { authenticated: false as const, featuredRecipes }
    }

    const token = await signPostgrestToken(session.email)
    const initialLimit = offsetParam
      ? Math.max(PAGE_SIZE, parseInt(offsetParam, 10))
      : PAGE_SIZE

    const [memberData, categories, pantryResult] = await Promise.all([
      buildMemberData(session),
      getCategories(),
      getUserPantry(),
    ])

    const { memberList, currentUserId } = memberData
    const selectedMemberIds = resolveSelectedMembers(
      membersParam,
      currentUserId,
      memberList,
    )
    const ownerIds =
      selectedMemberIds.length > 0 ? selectedMemberIds : undefined

    const recipeResult = await getRecipesWithCount({
      ownerIds,
      token,
      limit: initialLimit,
    })

    const pantryItems = Array.isArray(pantryResult) ? pantryResult : []

    return {
      authenticated: true as const,
      recipes: recipeResult.recipes,
      totalCount: recipeResult.totalCount,
      pantryItems,
      categories,
      memberList,
      selectedMemberIds,
    }
  })

export const Route = createFileRoute('/_main/')({
  validateSearch: (search) =>
    z
      .object({
        offset: z.string().optional().catch(undefined),
        members: z.string().optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => ({
    offset: search.offset,
    members: search.members,
  }),
  loader: ({ deps }) =>
    fetchHomeData({
      data: { offset: deps.offset, members: deps.members },
    }),
  head: () => ({
    meta: [
      { title: 'Matrummet' },
      { name: 'description', content: 'Din personliga receptsamling' },
    ],
  }),
  component: HomePage,
})

function HomePage() {
  const data = Route.useLoaderData()

  if (!data.authenticated) {
    return <LandingPage recipes={data.featuredRecipes} />
  }

  return (
    <RecipePageClient
      initialRecipes={data.recipes}
      initialPantry={data.pantryItems}
      groupedCategories={data.categories}
      members={data.memberList}
      selectedMemberIds={data.selectedMemberIds}
      isAuthenticated={true}
      totalCount={data.totalCount}
      pageSize={PAGE_SIZE}
    />
  )
}
