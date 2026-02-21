import { createFileRoute, Outlet } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { AuthProvider } from '@/components/auth-provider'
import { Header } from '@/components/header'
import { SearchRow } from '@/components/search-row'
import { Footer } from '@/components/footer'
import type { User, UserHome } from '@/lib/types'

const getSessionFn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  return { session }
})

const fetchUserData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ user: User | null; homes: UserHome[] }> => {
    const session = await getSession()

    if (!session) {
      return { user: null, homes: [] }
    }

    try {
      const postgrestToken = await signPostgrestToken(session.email)

      const [userResponse, homeResponse, homesResponse] = await Promise.all([
        fetch(
          `${env.POSTGREST_URL}/users?email=eq.${encodeURIComponent(session.email)}&select=id,name,email,measures_system,provider,owner,role`,
          {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${postgrestToken}` },
          },
        ),
        fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        }),
        fetch(`${env.POSTGREST_URL}/rpc/get_user_homes`, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        }),
      ])

      if (!userResponse.ok) {
        return { user: null, homes: [] }
      }

      const users = await userResponse.json()
      const user = users[0]

      if (!user) {
        return { user: null, homes: [] }
      }

      let homeId: string | undefined
      let homeName: string | undefined

      if (homeResponse.ok) {
        const homeInfo = await homeResponse.json()
        if (homeInfo) {
          homeId = homeInfo.id
          homeName = homeInfo.name
        }
      }

      let homes: UserHome[] = []
      if (homesResponse.ok) {
        homes = await homesResponse.json()
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          measures_system: user.measures_system,
          provider: user.provider,
          owner: user.owner,
          role: user.role,
          home_id: homeId,
          home_name: homeName,
          homes,
        },
        homes,
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
      return { user: null, homes: [] }
    }
  },
)

export const Route = createFileRoute('/_main')({
  beforeLoad: async () => {
    const { session } = await getSessionFn()
    return { session }
  },
  loader: async () => {
    return fetchUserData()
  },
  component: MainLayout,
})

function MainLayout() {
  const { user, homes } = Route.useLoaderData()

  return (
    <AuthProvider initialUser={user} initialHomes={homes}>
      <Header />
      {user && <SearchRow />}
      <main className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <Outlet />
        </div>
      </main>
      <Footer />
    </AuthProvider>
  )
}
