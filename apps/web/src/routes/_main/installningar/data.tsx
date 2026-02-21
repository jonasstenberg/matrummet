import { createFileRoute } from '@tanstack/react-router'
import { ExportRecipes } from '@/components/export-recipes'
import { FileText } from '@/lib/icons'

export const Route = createFileRoute('/_main/installningar/data')({
  head: () => ({ meta: [{ title: 'Data' }] }),
  component: PageComponent,
})

function PageComponent() {
  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Data
        </h1>
      </header>

      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
            <p className="text-[15px] text-muted-foreground">
              Exportera alla dina recept som en Markdown-fil. Filen innehåller
              namn, beskrivning, ingredienser, instruktioner och kategorier för
              varje recept.
            </p>
          </div>
        </div>
      </div>

      <ExportRecipes />
    </>
  )
}
