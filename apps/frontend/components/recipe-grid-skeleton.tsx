import { Skeleton } from '@/components/ui/skeleton'

function RecipeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_8px_-2px_rgba(139,90,60,0.08),0_4px_16px_-4px_rgba(139,90,60,0.12)]">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-full" />
        <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}

export function RecipeGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  )
}
