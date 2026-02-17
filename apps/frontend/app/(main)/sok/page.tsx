import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getRecipes } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { RecipeGrid } from '@/components/recipe-grid'
import { RecipeGridSkeleton } from '@/components/recipe-grid-skeleton'
import { MemberFilter } from '@/components/member-filter'
import { buildMemberData, resolveSelectedMembers } from '@/lib/member-utils'
import type { MemberEntry } from '@/lib/member-utils'

interface SearchPageProps {
  searchParams: Promise<{ q?: string; members?: string }>
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams
  const query = params.q || ''

  return {
    title: query ? `Sök: ${query}` : 'Sök recept',
    description: query
      ? `Sökresultat för "${query}"`
      : 'Sök efter recept',
  }
}

async function SearchResults({
  query,
  token,
  ownerIds,
  memberList,
  selectedMemberIds,
}: {
  query: string
  token: string
  ownerIds: string[] | undefined
  memberList: MemberEntry[]
  selectedMemberIds: string[]
}) {
  const recipes = query
    ? await getRecipes({ search: query, ownerIds, token })
    : []

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Sökresultat för &quot;{query}&quot;
          </h1>
          <p className="text-lg text-muted-foreground">
            {recipes.length === 0 && 'Inga recept hittades'}
            {recipes.length === 1 && '1 recept hittades'}
            {recipes.length > 1 && `${recipes.length} recept hittades`}
          </p>
        </div>
        {memberList.length > 1 && (
          <MemberFilter members={memberList} selectedIds={selectedMemberIds} />
        )}
      </header>

      <RecipeGrid recipes={recipes} />
    </>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await getSession()

  // Require authentication
  if (!session) {
    redirect('/logga-in')
  }

  const token = await signPostgrestToken(session.email)
  const params = await searchParams
  const query = params.q || ''

  const memberData = await buildMemberData(session)
  const { memberList, currentUserId } = memberData
  const selectedMemberIds = resolveSelectedMembers(params.members, currentUserId, memberList)
  const ownerIds = selectedMemberIds.length > 0 ? selectedMemberIds : undefined

  return (
    <div className="space-y-8">
      {/* Results with query */}
      {query && (
        <Suspense fallback={<RecipeGridSkeleton count={6} />}>
          <SearchResults
            query={query}
            token={token}
            ownerIds={ownerIds}
            memberList={memberList}
            selectedMemberIds={selectedMemberIds}
          />
        </Suspense>
      )}

      {/* Empty state when no query */}
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
