import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <Skeleton className="h-10 w-48" />
      </header>

      <div className="space-y-4">
        {/* Main card skeleton */}
        <div className="rounded-2xl bg-card shadow-(--shadow-card) overflow-hidden">
          <div className="divide-y divide-border/40">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="h-5 flex-1" />
              </div>
            ))}
          </div>
          <div className="border-t border-border/40 px-5 py-3.5">
            <Skeleton className="h-5 w-40" />
          </div>
        </div>

        {/* Common ingredients card skeleton */}
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <div className="px-5 py-3.5">
            <Skeleton className="h-5 w-44" />
          </div>
        </div>
      </div>
    </div>
  )
}
