import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Library } from '@/lib/icons'
import type { Collection } from '@/lib/types'

interface CollectionsShelfProps {
  collections: Collection[]
}

/**
 * Horizontally-scrollable row of collection cards on the frontpage.
 *
 * Each card NAVIGATES to the collection (it is not a grid filter), so this
 * shelf is kept visually distinct from the owner-filter pill row.
 */
export function CollectionsShelf({ collections }: CollectionsShelfProps) {
  if (collections.length === 0) return null

  return (
    <section aria-labelledby="collections-shelf-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2
          id="collections-shelf-heading"
          className="font-heading text-2xl font-bold tracking-tight text-foreground"
        >
          Dina samlingar
        </h2>
        <Link
          to="/samlingar"
          className="flex-shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Se alla →
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            to="/samlingar/$id"
            params={{ id: collection.id }}
            preloadDelay={200}
            className="block w-56 flex-shrink-0 snap-start sm:w-64"
          >
            <article className="group relative h-full overflow-hidden rounded-2xl bg-card p-5 shadow-(--shadow-card) transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Library className="h-5 w-5 text-primary/60" />
                </div>
                {collection.kind === 'curated' && (
                  <Badge variant="secondary">Kurerad</Badge>
                )}
              </div>

              <h3 className="mt-4 line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
                {collection.name}
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                {collection.recipe_count} recept
              </p>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}
