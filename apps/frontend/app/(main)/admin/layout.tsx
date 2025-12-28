'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { isAdmin } from '@/lib/is-admin'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const adminLinks = [
  { href: '/admin/kategorier', label: 'Kategorier' },
  { href: '/admin/matvaror', label: 'Matvaror' },
  { href: '/admin/enheter', label: 'Enheter' },
  { href: '/admin/strukturera', label: 'Strukturera' },
  { href: '/admin/anvandare', label: 'Användare' },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    )
  }

  if (!isAdmin(user)) {
    return (
      <div className="space-y-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du har inte behörighet att visa denna sida. Endast administratörer har åtkomst.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Admin Navigation */}
      <nav className="flex gap-1 border-b border-border">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              pathname === link.href
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  )
}
