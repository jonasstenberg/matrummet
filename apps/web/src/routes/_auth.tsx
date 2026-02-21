import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { AuthProvider } from '@/components/auth-provider'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

const redirectIfAuthenticated = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getSession()
    if (session) {
      throw redirect({ to: '/', search: { offset: undefined, members: undefined } })
    }
  },
)

export const Route = createFileRoute('/_auth')({
  beforeLoad: () => redirectIfAuthenticated(),
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <AuthProvider initialUser={null}>
      <Header />
      <main className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </AuthProvider>
  )
}
