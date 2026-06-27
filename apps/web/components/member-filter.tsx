
import { useRouter, useLocation, useSearch } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { BookOpen, Home } from '@/lib/icons'

interface MemberFilterProps {
  members: Array<{ id: string; name: string; isCurrentUser: boolean; type?: 'household' | 'shared-book' }>
  selectedIds: string[]
}

export function MemberFilter({ members, selectedIds }: MemberFilterProps) {
  const router = useRouter()
  const { pathname } = useLocation()
  const searchParams = useSearch({ strict: false }) as Record<string, string | undefined> & { offset?: string; members?: string }

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

    // Build new search params, removing offset when filter changes to reset pagination
    const newSearch: Record<string, string | undefined> = { ...searchParams }
    delete newSearch.offset

    // If only the current user is selected (the default), clear the param
    const isDefault = currentSelected.size === 0 ||
      (currentSelected.size === 1 && members.some((m) => m.isCurrentUser && currentSelected.has(m.id)))

    if (!isDefault && currentSelected.size > 0) {
      newSearch.members = Array.from(currentSelected).map(toShortId).join(',')
    } else {
      delete newSearch.members
    }

    router.navigate({ to: pathname, search: newSearch })
  }

  // Sort: current user first, then by tier (household → shared-book), then alphabetically
  const TYPE_RANK: Record<'household' | 'shared-book', number> = {
    household: 0,
    'shared-book': 1,
  }
  const sortedMembers = [...members].sort((a, b) => {
    if (a.isCurrentUser) return -1
    if (b.isCurrentUser) return 1
    const aRank = TYPE_RANK[a.type ?? 'household']
    const bRank = TYPE_RANK[b.type ?? 'household']
    if (aRank !== bRank) return aRank - bRank
    return a.name.localeCompare(b.name, 'sv')
  })

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrera efter medlem">
      {sortedMembers.map((member) => {
        const isSelected = selectedIds.includes(member.id)
        const label = member.isCurrentUser ? 'Mina recept' : member.name
        const memberType = member.type ?? 'household'
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
            {!member.isCurrentUser && memberType === 'shared-book' && <BookOpen className={cn('h-3.5 w-3.5', isSelected ? 'text-background/70' : 'text-warm')} />}
            {!member.isCurrentUser && memberType === 'household' && <Home className={cn('h-3.5 w-3.5', isSelected ? 'text-background/70' : 'text-muted-foreground')} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
