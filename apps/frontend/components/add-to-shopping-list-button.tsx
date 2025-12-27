'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AddToShoppingListDialog } from '@/components/add-to-shopping-list-dialog'
import { ShoppingCart } from 'lucide-react'
import type { Recipe } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AddToShoppingListButtonProps {
  recipe: Recipe
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  showLabel?: boolean
}

export function AddToShoppingListButton({
  recipe,
  className,
  variant = 'outline',
  showLabel = true,
}: AddToShoppingListButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Don't render if there are no ingredients
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    return null
  }

  return (
    <>
      <Button
        variant={variant}
        onClick={() => setIsDialogOpen(true)}
        className={cn(showLabel ? '' : 'px-3', className)}
        aria-label="Lägg till i inköpslista"
      >
        <ShoppingCart className="h-4 w-4" />
        {showLabel && <span className="hidden sm:inline ml-2">Lägg till i inköpslista</span>}
        {showLabel && <span className="sm:hidden ml-2">Inköpslista</span>}
      </Button>

      <AddToShoppingListDialog
        recipe={recipe}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  )
}
