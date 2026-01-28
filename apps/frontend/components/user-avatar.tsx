import { cn } from '@/lib/utils'
import { User } from '@/lib/types'

interface UserAvatarProps {
  user: User
  className?: string
}

function getInitials(user: User): string {
  if (user.name) {
    const words = user.name.trim().split(/\s+/)
    if (words.length >= 2) {
      // Take first letter of first and last word
      return (words[0][0] + words[words.length - 1][0]).toUpperCase()
    }
    // Single word - take first 2 chars
    return user.name.substring(0, 2).toUpperCase()
  }
  // Fallback to first 2 chars of email
  return user.email.substring(0, 2).toUpperCase()
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  const initials = getInitials(user)

  return (
    <div
      className={cn(
        'h-9 w-9 rounded-full bg-warm text-warm-foreground flex items-center justify-center text-sm font-medium select-none',
        className
      )}
      aria-label={user.name || user.email}
    >
      {initials}
    </div>
  )
}
