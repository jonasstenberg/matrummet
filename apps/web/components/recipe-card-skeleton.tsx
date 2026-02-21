import { Skeleton } from '@/components/ui/skeleton'

export function RecipeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-(--shadow-card)">
      {/* Image area */}
      <div className="relative aspect-[4/3] w-full">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>

      {/* Content area */}
      <div className="p-4">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />

        {/* Description */}
        <Skeleton className="mt-2 h-4 w-full" />

        {/* Footer with time and yield */}
        <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  )
}
