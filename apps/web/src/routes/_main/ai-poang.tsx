import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCreditsData } from '@/lib/credits-actions'
import { CreditsDashboard } from '@/components/credits-dashboard'

const fetchCredits = createServerFn({ method: 'GET' }).handler(async () => {
  const creditsData = await getCreditsData()
  const hasError = 'error' in creditsData

  return {
    initialBalance: hasError ? 0 : creditsData.balance,
    initialTransactions: hasError ? [] : creditsData.transactions,
    error: hasError ? creditsData.error : undefined,
  }
})

export const Route = createFileRoute('/_main/ai-poang')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  loader: () => fetchCredits(),
  head: () => ({
    meta: [
      { title: 'AI-poäng' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: CreditsPage,
})

function CreditsPage() {
  const { initialBalance, initialTransactions, error } = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-1 mb-6">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          AI-poäng
        </h1>
        <p className="text-sm text-muted-foreground">
          AI-poäng används för att importera recept med AI och generera
          veckoplanering. Länkar är oftast gratis eftersom många receptsidor har
          strukturerad data som kan läsas direkt. Du fick några AI-poäng när du
          skapade ditt konto och kan köpa fler här.
        </p>
      </div>
      <CreditsDashboard
        initialBalance={initialBalance}
        initialTransactions={initialTransactions}
        error={error}
      />
    </div>
  )
}
