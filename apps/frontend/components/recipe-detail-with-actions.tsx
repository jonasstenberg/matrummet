'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RecipeDetail } from '@/components/recipe-detail'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { deleteRecipe } from '@/lib/actions'
import { Recipe } from '@/lib/types'

interface RecipeDetailWithActionsProps {
  recipe: Recipe
  userEmail?: string
}

export function RecipeDetailWithActions({
  recipe,
  userEmail,
}: RecipeDetailWithActionsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const isOwner = userEmail && recipe.owner === userEmail

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError(null)

    try {
      const result = await deleteRecipe(recipe.id)

      if ('error' in result) {
        setDeleteError(result.error)
        setIsDeleting(false)
        return
      }

      // Redirect to home page after successful deletion
      router.push('/')
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Ett oväntat fel uppstod'
      )
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Owner Actions */}
      {isOwner && (
        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/recept/${recipe.id}/redigera`}>Redigera</Link>
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">Ta bort</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ta bort recept</DialogTitle>
                <DialogDescription>
                  Vill du verkligen ta bort detta recept? Denna åtgärd kan inte
                  ångras.
                </DialogDescription>
              </DialogHeader>

              {deleteError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteError}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Avbryt
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Tar bort...' : 'Ta bort'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Recipe Detail */}
      <RecipeDetail recipe={recipe} />
    </div>
  )
}
