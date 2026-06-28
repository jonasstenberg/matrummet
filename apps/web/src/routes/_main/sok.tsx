import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getRecipesWithCount } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { buildMemberData, resolveSelectedMembers } from '@/lib/member-utils'
import { SearchResultsClient } from '@/components/search-results-client'

const PAGE_SIZE = 24

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  members: z.string().optional().catch(undefined),
  offset: z.number().int().positive().optional().catch(undefined),
})

const fetchSearchResults = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      q: z.string(),
      members: z.string(),
      offset: z.number().optional(),
    }),
  )
  .handler(async ({ data: { q, members, offset: offsetParam } }) => {
    const session = await getSession()

    if (!session) {
      throw redirect({ to: '/login' })
    }

    const token = await signPostgrestToken(session.email)
    const memberData = await buildMemberData(session)
    const { memberList, currentUserId } = memberData
    const selectedMemberIds = resolveSelectedMembers(
      members,
      currentUserId,
      memberList,
    )
    const ownerIds =
      selectedMemberIds.length > 0 ? selectedMemberIds : undefined

    // On a fresh load with an offset (e.g. back-navigation), restore the whole
    // list up to that offset; otherwise load the first page.
    const initialLimit = offsetParam ? Math.max(PAGE_SIZE, offsetParam) : PAGE_SIZE

    const { recipes, totalCount } = q
      ? await getRecipesWithCount({ search: q, ownerIds, token, limit: initialLimit })
      : { recipes: [], totalCount: 0 }

    return {
      query: q,
      recipes,
      totalCount,
      memberList,
      selectedMemberIds,
    }
  })

export const Route = createFileRoute('/_main/sok')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    // offset is intentionally excluded: "load more" updates the URL without
    // re-running the loader. The loader reads offset from location for fresh loads.
    q: search.q ?? '',
    members: search.members ?? '',
  }),
  loader: ({ deps, location }) => {
    const { offset } = location.search as z.infer<typeof searchSchema>
    return fetchSearchResults({
      data: { q: deps.q, members: deps.members, offset },
    })
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.query
          ? `Sök: ${loaderData.query}`
          : 'Sök recept',
      },
      {
        name: 'description',
        content: loaderData?.query
          ? `Sökresultat för "${loaderData.query}"`
          : 'Sök efter recept',
      },
    ],
  }),
  component: SearchPage,
})

function SearchPage() {
  const { query, recipes, totalCount, memberList, selectedMemberIds } =
    Route.useLoaderData()

  if (!query) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="max-w-md text-center">
          <h1 className="mb-4 text-3xl font-bold text-foreground">
            Sök efter recept
          </h1>
          <p className="mb-2 text-lg text-muted-foreground">
            Använd sökfältet i menyn ovan för att hitta dina favoritrecept
          </p>
          <p className="text-sm text-muted-foreground">
            Du kan söka efter ingredienser, rätter eller kategorier
          </p>
        </div>
      </div>
    )
  }

  return (
    <SearchResultsClient
      query={query}
      initialRecipes={recipes}
      totalCount={totalCount}
      members={memberList}
      selectedMemberIds={selectedMemberIds}
      pageSize={PAGE_SIZE}
    />
  )
}
