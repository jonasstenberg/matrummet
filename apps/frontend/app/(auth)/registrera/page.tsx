import { SignupForm } from '@/components/signup-form'

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Skapa konto</h2>
        <p className="text-sm text-muted-foreground">
          Börja samla dina favoritrecept
        </p>
      </div>
      <SignupForm />
    </div>
  )
}
