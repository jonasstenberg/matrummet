import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Något gick fel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || 'Ett oväntat fel inträffade.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={reset} className="flex-1">
              Försök igen
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/">Gå till startsidan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
