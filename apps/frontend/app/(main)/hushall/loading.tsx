import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <header>
        <Skeleton className="h-10 w-32" />
      </header>
      <div className="space-y-4">
        <div className="rounded-2xl bg-card p-5">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="rounded-2xl bg-card p-5">
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </>
  )
}
