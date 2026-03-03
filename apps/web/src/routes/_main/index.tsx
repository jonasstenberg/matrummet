import { createFileRoute, useLocation } from '@tanstack/react-router'
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
import { RecipeGridSkeleton } from '@/components/recipe-grid-skeleton'
import { Skeleton } from '@/components/ui/skeleton'
import { LandingPage } from '@/components/landing-page'

const PAGE_SIZE = 24

const searchSchema = z.object({
  offset: z.number().int().positive().optional().catch(undefined),
  members: z.string().optional().catch(undefined),
})

const fetchHomeData = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({ offset: z.number().optional(), members: z.string().optional() }),
  )
  .handler(async ({ data: { offset: offsetParam, members: membersParam } }) => {
    const session = await getSession()

    if (!session) {
      const featuredRecipes = await getFeaturedRecipes(4)
      return { authenticated: false as const, featuredRecipes }
    }

    const token = await signPostgrestToken(session.email)
    const initialLimit = offsetParam
      ? Math.max(PAGE_SIZE, offsetParam)
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
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    // offset is intentionally excluded: "load more" updates the URL without
    // re-running the loader. The loader reads offset from location on fresh
    // page loads (e.g. back-navigation) to restore the full list.
    members: search.members,
  }),
  loader: ({ deps, location }) => {
    const { offset } = location.search as z.infer<typeof searchSchema>
    return fetchHomeData({ data: { offset, members: deps.members } })
  },
  pendingMs: 0,
  pendingMinMs: 300,
  pendingComponent: HomePageSkeleton,
  head: () => ({
    meta: [
      { title: 'Matrummet' },
      { name: 'description', content: 'Din personliga receptsamling' },
    ],
  }),
  component: HomePage,
})

function HomePageSkeleton() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96 max-w-full" />
      </header>
      <RecipeGridSkeleton />
    </div>
  )
}

function HomePage() {
  const data = Route.useLoaderData()
  const { state } = useLocation()

  // During auth transitions, the router serves stale cached data while refetching.
  // Show skeleton when the data contradicts the expected post-transition state.
  // Once fresh data arrives matching the expected state, the condition is false.
  if (
    (state.authTransition === 'login' && !data.authenticated) ||
    (state.authTransition === 'logout' && data.authenticated)
  ) {
    return <HomePageSkeleton />
  }

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
