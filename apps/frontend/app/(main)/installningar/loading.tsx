import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <>
      <header>
        <Skeleton className="h-10 w-40" />
      </header>
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <div className="px-5 py-4">
          <Skeleton className="h-3 w-16 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="border-t border-border/40 px-5 py-4">
          <Skeleton className="h-3 w-10 mb-2" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
    </>
  )
}
