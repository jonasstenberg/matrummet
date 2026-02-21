import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { SettingsSidebar } from '@/components/settings-sidebar'
import { SettingsPillNav } from '@/components/settings-pill-nav'

export const Route = createFileRoute('/_main/installningar')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
      <aside className="hidden md:block">
        <SettingsSidebar />
      </aside>
      <div className="md:hidden">
        <SettingsPillNav />
      </div>
      <main className="min-w-0 space-y-6">
        <Outlet />
      </main>
    </div>
  )
}
