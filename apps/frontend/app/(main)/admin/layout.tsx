import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin-sidebar'
import { AdminPillNav } from '@/components/admin-pill-nav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login?returnUrl=/admin')
  }

  if (session.role !== 'admin') {
    redirect('/')
  }

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
          {children}
        </main>
      </div>
    </div>
  )
}
