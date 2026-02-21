import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SignupForm } from '@/components/signup-form'

export const Route = createFileRoute('/_auth/registrera')({
  validateSearch: (search) =>
    z.object({ returnUrl: z.string().optional().catch(undefined) }).parse(search),
  head: () => ({
    meta: [{ title: 'Registrera | Matrummet' }],
  }),
  component: RegisterPage,
})

function RegisterPage() {
  return <SignupForm />
}
