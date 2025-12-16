import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Logga in</h2>
        <p className="text-sm text-muted-foreground">
          Ange dina uppgifter för att fortsätta
        </p>
      </div>
      <LoginForm />
    </div>
  )
}
