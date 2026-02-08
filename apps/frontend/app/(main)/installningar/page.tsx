import type { Metadata } from 'next'
import { ProfileForm } from '@/components/profile-form'

export const metadata: Metadata = {
  title: 'Profil',
}

export default function SettingsProfilePage() {
  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Profil
        </h1>
      </header>
      <ProfileForm />
    </>
  )
}
