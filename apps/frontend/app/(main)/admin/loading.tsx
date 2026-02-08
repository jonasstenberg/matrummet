import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminLoading() {
  return (
    <>
      {/* Header skeleton */}
      <header>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-2 h-6 w-96" />
      </header>

      {/* Filter tabs skeleton */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </Card>

      {/* Search skeleton */}
      <Card className="p-4">
        <Skeleton className="h-10 w-full" />
      </Card>

      {/* List skeleton */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>

        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="mt-1 h-4 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
