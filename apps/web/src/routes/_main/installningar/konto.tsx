import { createFileRoute } from '@tanstack/react-router'
import { AccountDeletionForm } from '@/components/account-deletion-form'

export const Route = createFileRoute('/_main/installningar/konto')({
  head: () => ({ meta: [{ title: 'Konto' }] }),
  component: PageComponent,
})

function PageComponent() {
  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Konto
        </h1>
      </header>
      <AccountDeletionForm />
    </>
  )
}
