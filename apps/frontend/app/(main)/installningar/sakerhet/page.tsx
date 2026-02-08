import type { Metadata } from 'next'
import { SecurityForm } from '@/components/security-form'

export const metadata: Metadata = {
  title: 'Säkerhet',
}

export default function SettingsSecurityPage() {
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
