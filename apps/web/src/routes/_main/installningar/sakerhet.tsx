import { createFileRoute } from '@tanstack/react-router'
import { SecurityForm } from '@/components/security-form'

export const Route = createFileRoute('/_main/installningar/sakerhet')({
  head: () => ({ meta: [{ title: 'Säkerhet' }] }),
  component: PageComponent,
})

function PageComponent() {
  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Säkerhet
        </h1>
      </header>
      <SecurityForm />
    </>
  )
}
