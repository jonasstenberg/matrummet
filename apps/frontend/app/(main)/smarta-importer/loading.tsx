import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-1 mb-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>

      <div className="space-y-4">
        {/* Balance + purchase card skeleton */}
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <div className="flex items-center gap-4 px-5 py-5">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-10" />
            </div>
          </div>
          <div className="border-t border-border/60">
            <div className="px-5 pt-3.5 pb-2">
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* History card skeleton */}
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <div className="px-5 py-3.5">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="border-t border-border/40 divide-y divide-border/60">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-4 w-8 ml-auto" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
