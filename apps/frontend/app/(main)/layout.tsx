import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { AuthProvider } from '@/components/auth-provider'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { User } from '@/lib/types'
import { env } from '@/lib/env'

async function getUserData(): Promise<User | null> {
  const session = await getSession()

  if (!session) {
    return null
  }

  try {
    // Create PostgREST-compatible JWT with the user's email
    const postgrestToken = await signPostgrestToken(session.email)

    // Fetch full user data from PostgREST with authentication
    const response = await fetch(
      `${env.POSTGREST_URL}/users?email=eq.${encodeURIComponent(session.email)}&select=id,name,email,measures_system,provider,owner,role`,
      {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${postgrestToken}`,
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const users = await response.json()
    const user = users[0]

    if (!user) {
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      measures_system: user.measures_system,
      provider: user.provider,
      owner: user.owner,
      role: user.role,
    }
  } catch (error) {
    console.error('Failed to fetch user data:', error)
    return null
  }
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getUserData()

  return (
    <AuthProvider initialUser={user}>
      <Header />
      <main className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          {children}
        </div>
      </main>
      <Footer />
    </AuthProvider>
  )
}
