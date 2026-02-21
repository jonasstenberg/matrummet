import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getRecipes } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { buildMemberData, resolveSelectedMembers } from '@/lib/member-utils'
import { RecipeGrid } from '@/components/recipe-grid'
import { MemberFilter } from '@/components/member-filter'

const fetchSearchResults = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ q: z.string(), members: z.string() }))
  .handler(async ({ data: { q, members } }) => {
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

    const recipes = q
      ? await getRecipes({ search: q, ownerIds, token })
      : []

    return {
      query: q,
      recipes,
      memberList,
      selectedMemberIds,
    }
  })

export const Route = createFileRoute('/_main/sok')({
  validateSearch: (search) =>
    z
      .object({
        q: z.string().optional().catch(undefined),
        members: z.string().optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => ({
    q: search.q ?? '',
    members: search.members ?? '',
  }),
  loader: ({ deps }) =>
    fetchSearchResults({ data: { q: deps.q, members: deps.members } }),
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
  const { query, recipes, memberList, selectedMemberIds } =
    Route.useLoaderData()

  return (
    <div className="space-y-8">
      {memberList.length > 1 && (
        <MemberFilter members={memberList} selectedIds={selectedMemberIds} />
      )}

      {query && (
        <>
          <header>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              Sökresultat för &quot;{query}&quot;
            </h1>
            <p className="text-lg text-muted-foreground">
              {recipes.length === 0 && 'Inga recept hittades'}
              {recipes.length === 1 && '1 recept hittades'}
              {recipes.length > 1 && `${recipes.length} recept hittades`}
            </p>
          </header>

          <RecipeGrid recipes={recipes} />
        </>
      )}

      {!query && (
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
      )}
    </div>
  )
}
