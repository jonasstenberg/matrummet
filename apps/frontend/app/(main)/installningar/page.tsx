import { ProfileForm } from '@/components/profile-form'
import { SettingsViewToggle } from '@/components/settings-view-toggle'

export default function SettingsProfilePage() {
  return (
    <div className="space-y-6">
      <SettingsViewToggle activeView="profil" />
      <ProfileForm />
    </div>
  )
}
