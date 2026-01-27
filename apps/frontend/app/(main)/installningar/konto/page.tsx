import { AccountDeletionForm } from '@/components/account-deletion-form'

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Konto</h2>
        <p className="text-muted-foreground">Hantera ditt konto och radering</p>
      </div>
      <AccountDeletionForm />
    </div>
  )
}
