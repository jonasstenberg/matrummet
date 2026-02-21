import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminPillNav } from '@/components/admin-pill-nav'

export const Route = createFileRoute('/_main/admin')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login', search: { returnUrl: '/admin' } })
    }
    if (context.session.role !== 'admin') {
      throw redirect({ to: '/' })
    }
    return { session: context.session }
  },
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden md:block">
          <AdminSidebar />
        </aside>
        <div className="md:hidden">
          <AdminPillNav />
        </div>
        <main className="min-w-0 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
