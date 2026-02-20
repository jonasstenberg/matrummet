'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BookOpen, Home } from '@/lib/icons'

interface MemberFilterProps {
  members: Array<{ id: string; name: string; isCurrentUser: boolean; type?: 'household' | 'shared-book' }>
  selectedIds: string[]
}

export function MemberFilter({ members, selectedIds }: MemberFilterProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  // Use short ID prefixes (first 4 chars) for clean URLs
  const SHORT_ID_LEN = 4

  function toShortId(id: string) {
    return id.slice(0, SHORT_ID_LEN)
  }

  function handleToggle(memberId: string) {
    const currentSelected = new Set(selectedIds)

    if (currentSelected.has(memberId)) {
      currentSelected.delete(memberId)
    } else {
      currentSelected.add(memberId)
    }

    const params = new URLSearchParams(searchParams.toString())
    // Remove offset when filter changes to reset pagination
    params.delete('offset')

    // If only the current user is selected (the default), clear the param
    const isDefault = currentSelected.size === 0 ||
      (currentSelected.size === 1 && members.some((m) => m.isCurrentUser && currentSelected.has(m.id)))

    if (!isDefault && currentSelected.size > 0) {
      params.set('members', Array.from(currentSelected).map(toShortId).join(','))
    } else {
      params.delete('members')
    }

    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }

  // Sort: current user first, then household alphabetically, then shared-book alphabetically
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isCurrentUser) return -1
    if (b.isCurrentUser) return 1
    const aType = a.type ?? 'household'
    const bType = b.type ?? 'household'
    if (aType !== bType) return aType === 'household' ? -1 : 1
    return a.name.localeCompare(b.name, 'sv')
  })

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrera efter medlem">
      {sortedMembers.map((member) => {
        const isSelected = selectedIds.includes(member.id)
        const label = member.isCurrentUser ? 'Mina recept' : member.name
        const isSharedBook = member.type === 'shared-book'
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => handleToggle(member.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
            aria-pressed={isSelected}
          >
            {!member.isCurrentUser && isSharedBook && <BookOpen className={cn('h-3.5 w-3.5', isSelected ? 'text-background/70' : 'text-warm')} />}
            {!member.isCurrentUser && !isSharedBook && <Home className={cn('h-3.5 w-3.5', isSelected ? 'text-background/70' : 'text-muted-foreground')} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
