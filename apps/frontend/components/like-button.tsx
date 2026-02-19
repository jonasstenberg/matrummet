'use client'

import { useOptimistic, useTransition } from 'react'
import { Heart } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { toggleRecipeLike } from '@/lib/actions'
import { cn } from '@/lib/utils'

interface LikeButtonProps {
  recipeId: string
  initialLiked: boolean
  isOwner: boolean
  className?: string
}

export function LikeButton({
  recipeId,
  initialLiked,
  isOwner,
  className,
}: LikeButtonProps) {
  const [optimisticLiked, setOptimisticLiked] = useOptimistic(initialLiked)
  const [isPending, startTransition] = useTransition()

  if (isOwner) {
    return null
  }

  function handleClick() {
    const previousLiked = optimisticLiked
    startTransition(async () => {
      // Optimistic update
      setOptimisticLiked(!previousLiked)
      try {
        await toggleRecipeLike(recipeId)
      } catch (error) {
        // Revert optimistic state on error
        setOptimisticLiked(previousLiked)
        console.error('Failed to toggle like:', error)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      aria-label={optimisticLiked ? 'Ta bort gillning' : 'Gilla recept'}
      className={cn(className)}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-colors',
          optimisticLiked && 'fill-red-500 text-red-500'
        )}
      />
    </Button>
  )
}
