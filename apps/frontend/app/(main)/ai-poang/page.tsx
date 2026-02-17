import type { Metadata } from 'next'
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreditsDashboard } from "./credits-dashboard";
import { getCreditsData } from '@/lib/credits-actions'

export const metadata: Metadata = {
  title: 'AI-poäng',
  description: 'Hantera dina AI-poäng för import och matplanering',
  robots: { index: false, follow: false },
}

export default async function CreditsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const creditsData = await getCreditsData()
  const hasError = 'error' in creditsData

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-1 mb-6">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          AI-poäng
        </h1>
        <p className="text-sm text-muted-foreground">
          AI-poäng används för att importera recept med AI och generera veckoplanering. Länkar är oftast gratis eftersom många receptsidor har strukturerad data som kan läsas direkt. Du fick några AI-poäng när du skapade ditt konto och kan köpa fler här.
        </p>
      </div>
      <CreditsDashboard
        initialBalance={hasError ? 0 : creditsData.balance}
        initialTransactions={hasError ? [] : creditsData.transactions}
        error={hasError ? creditsData.error : undefined}
      />
    </div>
  );
}
