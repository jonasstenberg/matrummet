import { Skeleton } from '@/components/ui/skeleton'
import { RecipeGridSkeleton } from '@/components/recipe-grid-skeleton'

export default function Loading() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-80 max-w-full" />
      </header>

      <RecipeGridSkeleton />
    </div>
  )
}
