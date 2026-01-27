import { SecurityForm } from '@/components/security-form'

export default function SettingsSecurityPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold mb-6">Säkerhet</h2>
      <SecurityForm />
    </div>
  )
}
