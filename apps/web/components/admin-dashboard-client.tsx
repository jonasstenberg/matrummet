import { Link } from '@tanstack/react-router'
import { UtensilsCrossed, Tag, Ruler, Sparkles, Users, BookOpen } from '@/lib/icons'
import type { ComponentType } from 'react'

export interface DashboardStats {
  pendingFoods: number
  approvedFoods: number
  totalCategories: number
  totalUnits: number
  unusedUnits: number
  totalRecipes: number
  totalUsers: number
  lastAiReview: { created_at: string; decision: string } | null
}

interface AdminDashboardClientProps {
  stats: DashboardStats
}

interface StatCard {
  label: string
  value: number | string
  href: string
  icon: ComponentType<{ className?: string }>
  subtitle?: string
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just nu'
  if (diffMins < 60) return `${diffMins} min sedan`
  if (diffHours < 24) return `${diffHours} tim sedan`
  if (diffDays === 1) return 'igår'
  if (diffDays < 7) return `${diffDays} dagar sedan`
  return date.toLocaleDateString('sv-SE')
}

function decisionLabel(decision: string): string {
  switch (decision) {
    case 'approved': return 'Godkänd'
    case 'rejected': return 'Avvisad'
    case 'merged': return 'Sammanslagen'
    default: return decision
  }
}

export function AdminDashboardClient({ stats }: AdminDashboardClientProps) {
  const cards: StatCard[] = [
    {
      label: 'Väntande matvaror',
      value: stats.pendingFoods,
      href: '/admin/matvaror?status=pending',
      icon: UtensilsCrossed,
    },
    {
      label: 'Godkända matvaror',
      value: stats.approvedFoods,
      href: '/admin/matvaror?status=approved',
      icon: UtensilsCrossed,
    },
    {
      label: 'Kategorier',
      value: stats.totalCategories,
      href: '/admin/kategorier',
      icon: Tag,
    },
    {
      label: 'Enheter',
      value: stats.totalUnits,
      href: '/admin/enheter',
      icon: Ruler,
      subtitle: stats.unusedUnits > 0 ? `${stats.unusedUnits} oanvända` : undefined,
    },
    {
      label: 'Recept',
      value: stats.totalRecipes,
      href: '/admin',
      icon: BookOpen,
    },
    {
      label: 'Användare',
      value: stats.totalUsers,
      href: '/admin/anvandare',
      icon: Users,
    },
  ]

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Översikt
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Administrationspanel för Matrummet
        </p>
      </header>

      {/* Stat cards */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Statistik
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.label}
                to={card.href}
                className="group rounded-2xl bg-card p-5 shadow-(--shadow-card) transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-3xl font-bold tracking-tight text-foreground">
                      {card.value}
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {card.label}
                    </p>
                    {card.subtitle && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                        {card.subtitle}
                      </p>
                    )}
                  </div>
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground/30" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* AI Review section */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          AI-granskning
        </p>
        <Link
          to="/admin/ai-granskning"
          className="group flex items-center gap-4 rounded-2xl bg-card p-5 shadow-(--shadow-card) transition-colors hover:bg-muted/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-foreground">
              Senaste AI-granskning
            </p>
            {stats.lastAiReview ? (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {decisionLabel(stats.lastAiReview.decision)} &middot;{' '}
                {formatRelativeTime(stats.lastAiReview.created_at)}
              </p>
            ) : (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Ingen granskning ännu
              </p>
            )}
          </div>
        </Link>
      </section>
    </>
  )
}
