'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HomeInfo } from '@/lib/types'
import { HomeNameEditor } from './home-name-editor'
import { HomeLeaveDialog } from './home-leave-dialog'
import { HomeSetupWizard } from './home-setup-wizard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { updateHomeName, leaveHome, createHome } from '@/lib/home-actions'
import { LogOut } from 'lucide-react'

interface HushallClientProps {
  home: HomeInfo | null
  userEmail: string
}

export function HushallClient({ home: initialHome, userEmail }: HushallClientProps) {
  const router = useRouter()
  const [home, setHome] = useState(initialHome)

  async function handleCreateHome(name: string) {
    const result = await createHome(name)

    if ('error' in result) {
      throw new Error(result.error)
    }

    router.refresh()
  }

  // Show setup wizard if no home
  if (!home) {
    return <HomeSetupWizard onCreateHome={handleCreateHome} />
  }

  async function handleUpdateName(name: string) {
    const result = await updateHomeName(name)

    if ('error' in result) {
      throw new Error(result.error)
    }

    setHome((prev) => (prev ? { ...prev, name } : null))
  }

  async function handleLeaveHome() {
    const result = await leaveHome()

    if ('error' in result) {
      throw new Error(result.error)
    }

    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Hushåll</CardTitle>
            <CardDescription>Namn och grundinformation</CardDescription>
          </div>
          <HomeLeaveDialog homeName={home.name} onLeave={handleLeaveHome}>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Lämna
            </Button>
          </HomeLeaveDialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Hemnamn
          </label>
          <HomeNameEditor name={home.name} onSave={handleUpdateName} />
        </div>
      </CardContent>
    </Card>
  )
}
