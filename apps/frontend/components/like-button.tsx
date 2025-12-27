'use client'

import { useState, useTransition } from 'react'
import { Heart } from 'lucide-react'
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
  const [liked, setLiked] = useState(initialLiked)
  const [isPending, startTransition] = useTransition()

  if (isOwner) {
    return null
  }

  function handleClick() {
    // Optimistic update
    setLiked((prev) => !prev)

    startTransition(async () => {
      const result = await toggleRecipeLike(recipeId)
      // Revert on error
      if ('error' in result) {
        setLiked((prev) => !prev)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={isPending}
      aria-label={liked ? 'Ta bort gillning' : 'Gilla recept'}
      className={cn(className)}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-colors',
          liked && 'fill-red-500 text-red-500'
        )}
      />
    </Button>
  )
}
