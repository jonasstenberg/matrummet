import type { ComponentType } from 'react'
import { Home, Users, Tag, UtensilsCrossed, Ruler, Wand2, Sparkles } from '@/lib/icons'

export interface AdminNavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

export const adminNavItems: AdminNavItem[] = [
  { href: '/admin', label: 'Översikt', icon: Home },
  { href: '/admin/anvandare', label: 'Användare', icon: Users },
  { href: '/admin/kategorier', label: 'Kategorier', icon: Tag },
  { href: '/admin/matvaror', label: 'Matvaror', icon: UtensilsCrossed },
  { href: '/admin/enheter', label: 'Enheter', icon: Ruler },
  { href: '/admin/strukturera', label: 'Strukturera', icon: Wand2 },
  { href: '/admin/ai-granskning', label: 'AI-granskning', icon: Sparkles },
]
