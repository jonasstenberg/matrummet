import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginForm } from '@/components/login-form'

const loginSearchSchema = z.object({
  returnUrl: z.string().optional().catch(undefined),
  error: z.string().optional().catch(undefined),
  forgot: z
    .literal('true')
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search) => loginSearchSchema.parse(search),
  head: () => ({
    meta: [{ title: 'Logga in | Matrummet' }],
  }),
  component: LoginPage,
})

function LoginPage() {
  return <LoginForm />
}
