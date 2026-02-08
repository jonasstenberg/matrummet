import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

export default function RecipeNotFound() {
  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center space-y-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Recept hittades inte</h1>
        <p className="text-lg text-muted-foreground">
          Receptet du letade efter kunde tyvärr inte hittas.
        </p>
      </div>

      <Button asChild size="lg">
        <Link href="/">
          <Home className="mr-2 h-4 w-4" />
          Tillbaka till recepten
        </Link>
      </Button>
    </div>
  )
}
