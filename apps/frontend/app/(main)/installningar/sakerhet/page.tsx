import { SecurityForm } from '@/components/security-form'
import { SettingsViewToggle } from '@/components/settings-view-toggle'

export default function SettingsSecurityPage() {
  return (
    <div className="space-y-6">
      <SettingsViewToggle activeView="sakerhet" />
      <SecurityForm />
    </div>
  )
}
