import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SettingsSidebar } from '@/components/settings-sidebar'
import { SettingsPillNav } from '@/components/settings-pill-nav'

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="font-heading text-3xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground">
          Hantera ditt konto och dina inställningar
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden md:block">
          <SettingsSidebar />
        </aside>
        <div className="md:hidden">
          <SettingsPillNav />
        </div>
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
