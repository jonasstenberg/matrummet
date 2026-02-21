import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function RecipeDetailSkeleton() {
  return (
    <article className="space-y-8">
      {/* Hero Section: Metadata left, Image right */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        {/* Left: Metadata */}
        <div className="flex flex-col justify-center space-y-4 order-2 md:order-1">
          {/* Categories */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>

          {/* Title */}
          <Skeleton className="h-10 w-3/4 sm:h-12" />

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>

          {/* Meta Information (author, date) */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Recipe Info (time, yield) */}
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Right: Image */}
        <div className="order-1 md:order-2">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Ingredients */}
        <div className="lg:col-span-1">
          <div className="space-y-4">
            {/* Servings slider */}
            <Skeleton className="h-20 w-full rounded-2xl" />

            {/* Ingredients card */}
            <Card className="overflow-hidden rounded-2xl">
              <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
                <Skeleton className="h-6 w-28" />
              </div>
              <div className="space-y-3 p-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Instructions */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden rounded-2xl">
            <div className="border-b border-border/50 bg-muted/30 px-5 py-4">
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="space-y-4 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </article>
  )
}
