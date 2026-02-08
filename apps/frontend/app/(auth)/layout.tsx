import { APP_NAME } from '@/lib/constants'
import { AuthProvider } from '@/components/auth-provider'
import { Footer } from '@/components/footer'

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <AuthProvider initialUser={null}>
      <main className="flex-1 flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">{APP_NAME}</h1>
            <p className="text-muted-foreground">Din digitala kokbok</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-8 shadow-sm">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </AuthProvider>
  )
}
