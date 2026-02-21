import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSession } from '@/lib/auth'
import { AuthProvider } from '@/components/auth-provider'
import { Footer } from '@/components/footer'
import { APP_NAME } from '@/lib/constants'

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
      <main className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">{APP_NAME}</h1>
            <p className="text-muted-foreground">Din digitala kokbok</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </AuthProvider>
  )
}
