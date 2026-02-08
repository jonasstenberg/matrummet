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
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
      <aside className="hidden md:block">
        <SettingsSidebar />
      </aside>
      <div className="md:hidden">
        <SettingsPillNav />
      </div>
      <main className="min-w-0 space-y-6">
        {children}
      </main>
    </div>
  )
}
