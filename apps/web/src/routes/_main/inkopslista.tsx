import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getUserHomes } from '@/lib/home-api'
import { HomeSetupWizard } from '@/components/home/home-setup-wizard'

const fetchShoppingListRedirect = createServerFn({ method: 'GET' }).handler(
  async () => {
    const homes = await getUserHomes()

    if (homes.length > 0) {
      throw redirect({
        to: '/hem/$homeId/inkopslista',
        params: { homeId: homes[0].home_id },
      })
    }

    return { noHomes: true as const }
  },
)

export const Route = createFileRoute('/_main/inkopslista')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  loader: () => fetchShoppingListRedirect(),
  head: () => ({
    meta: [
      { title: 'Inköpslista' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: ShoppingListRedirectPage,
})

function ShoppingListRedirectPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Inköpslista
        </h1>
      </header>
      <HomeSetupWizard />
    </div>
  )
}
