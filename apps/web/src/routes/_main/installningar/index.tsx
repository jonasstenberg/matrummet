import { createFileRoute } from '@tanstack/react-router'
import { ProfileForm } from '@/components/profile-form'

export const Route = createFileRoute('/_main/installningar/')({
  head: () => ({ meta: [{ title: 'Profil' }] }),
  component: PageComponent,
})

function PageComponent() {
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
