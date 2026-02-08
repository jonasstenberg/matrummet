import type { Metadata } from 'next'
import { AccountDeletionForm } from '@/components/account-deletion-form'

export const metadata: Metadata = {
  title: 'Konto',
}

export default function AccountPage() {
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
