import type { Metadata } from 'next'
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreditsDashboard } from "./credits-dashboard";
import { getCreditsData } from '@/lib/credits-actions'

export const metadata: Metadata = {
  title: 'Smarta importer',
  description: 'Hantera dina smarta importer',
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
          Smarta importer
        </h1>
        <p className="text-sm text-muted-foreground">
          När du importerar recept från text eller bilder tolkar AI:n innehållet åt dig, och det kostar en smart import. Länkar är oftast gratis eftersom många receptsidor har strukturerad data som kan läsas direkt. Du fick några smarta importer när du skapade ditt konto och kan köpa fler här.
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
