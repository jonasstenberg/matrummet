import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { listCollections } from '@/lib/collections-api'
import { CreateCollectionDialog } from '@/components/create-collection-dialog'
import { Badge } from '@/components/ui/badge'
import { Library } from '@/lib/icons'

const fetchCollections = createServerFn({ method: 'GET' }).handler(async () => {
  return listCollections()
})

export const Route = createFileRoute('/_main/samlingar/')({
  loader: () => fetchCollections(),
  head: () => ({
    meta: [
      { title: 'Samlingar' },
      { name: 'description', content: 'Dina receptsamlingar' },
    ],
  }),
  component: CollectionsPage,
})

function CollectionsPage() {
  const collections = Route.useLoaderData()

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
            Samlingar
          </h1>
          <p className="text-muted-foreground">
            Gruppera dina recept och dela dem med andra.
          </p>
        </div>
        <CreateCollectionDialog />
      </header>

      {collections.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Library className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Inga samlingar ännu
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Skapa din första samling för att gruppera dina favoritrecept.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              to="/samlingar/$id"
              params={{ id: collection.id }}
              preloadDelay={200}
              className="block"
            >
              <article className="group relative h-full overflow-hidden rounded-2xl bg-card p-6 shadow-(--shadow-card) transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-(--shadow-card-hover)">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Library className="h-6 w-6 text-primary/60" />
                  </div>
                  {collection.kind === 'curated' && (
                    <Badge variant="secondary">Kurerad</Badge>
                  )}
                </div>

                <h2 className="mt-4 line-clamp-2 text-lg font-semibold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
                  {collection.name}
                </h2>

                {collection.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {collection.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-3 border-t border-border/50 pt-3 text-sm text-muted-foreground">
                  <span>{collection.recipe_count} recept</span>
                  {!collection.is_owner && (
                    <span className="text-xs">
                      Delad av {collection.owner_name}
                    </span>
                  )}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
