'use client'

import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface MemberFilterProps {
  members: Array<{ id: string; name: string; isCurrentUser: boolean }>
  selectedIds: string[]
}

export function MemberFilter({ members, selectedIds }: MemberFilterProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

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

    if (currentSelected.size > 0) {
      params.set('members', Array.from(currentSelected).join(','))
    } else {
      params.delete('members')
    }

    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    })
  }

  // Sort: current user first, then alphabetically
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isCurrentUser) return -1
    if (b.isCurrentUser) return 1
    return a.name.localeCompare(b.name, 'sv')
  })

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrera efter medlem">
      {sortedMembers.map((member) => {
        const isSelected = selectedIds.includes(member.id)
        const label = member.isCurrentUser ? 'Mina recept' : member.name
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => handleToggle(member.id)}
            className={cn(
              'inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            )}
            aria-pressed={isSelected}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
