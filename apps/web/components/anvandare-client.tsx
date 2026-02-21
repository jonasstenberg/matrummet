import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pencil,
  Trash2,
  AlertCircle,
  UserCog,
  Sparkles,
  Search,
  EllipsisVertical,
  ChevronUp,
  ChevronDown,
} from '@/lib/icons'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import type { User, UserRole, UserSortField, SortDir, UsersPaginatedResponse } from '@/lib/admin-api'
import {
  updateUserRole,
  updateUserName,
  deleteUser,
  grantUserCredits,
} from '@/lib/admin-actions'

interface AnvandareClientProps {
  initialData: UsersPaginatedResponse
  page: number
  search: string
  roleFilter: UserRole | 'all'
  sortBy: UserSortField
  sortDir: SortDir
}

export function AnvandareClient({
  initialData,
  page,
  search,
  roleFilter,
  sortBy,
  sortDir,
}: AnvandareClientProps) {
  const router = useRouter()
  const { user: currentUser } = useAuth()
  const [isPending, startTransition] = useTransition()
  const [users, setUsers] = useState<User[]>(initialData.items)
  const [total, setTotal] = useState(initialData.total)
  const [totalPages, setTotalPages] = useState(initialData.totalPages)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setUsers(initialData.items)
    setTotal(initialData.total)
    setTotalPages(initialData.totalPages)
  }, [initialData])

  // Auto-dismiss success messages
  useEffect(() => {
    if (!success) return
    const timer = setTimeout(() => setSuccess(null), 3000)
    return () => clearTimeout(timer)
  }, [success])

  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Role change dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false)
  const [userToChangeRole, setUserToChangeRole] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  // Credit grant dialog
  const [creditDialogOpen, setCreditDialogOpen] = useState(false)
  const [userToGrant, setUserToGrant] = useState<User | null>(null)
  const [creditAmount, setCreditAmount] = useState('10')

  function navigate(overrides: {
    page?: number
    search?: string
    role?: UserRole | 'all'
    sort?: UserSortField
    dir?: SortDir
  }) {
    const p = overrides.page ?? page
    const s = overrides.search ?? search
    const r = overrides.role ?? roleFilter
    const sort = overrides.sort ?? sortBy
    const dir = overrides.dir ?? sortDir

    startTransition(() => {
      router.navigate({
        to: '/admin/anvandare',
        search: {
          page: p > 1 ? p : undefined,
          search: s || undefined,
          role: r !== 'all' ? r : undefined,
          sortBy: sort !== 'name' || dir !== 'asc' ? sort : undefined,
          sortDir: sort !== 'name' || dir !== 'asc' ? dir : undefined,
        },
        replace: true,
      })
    })
  }

  function handleSearchChange(value: string) {
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      navigate({ page: 1, search: value })
    }, 300)
  }

  function handleSort(field: UserSortField) {
    if (sortBy === field) {
      navigate({ page: 1, sort: field, dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      navigate({ page: 1, sort: field, dir: 'asc' })
    }
  }

  async function handleRename(id: string, newName: string) {
    if (!newName.trim()) {
      setError('Namn kan inte vara tomt')
      return
    }

    setError(null)
    setSuccess(null)

    const result = await updateUserName(id, newName.trim())

    if (result.success) {
      setSuccess('Användare uppdaterad')
      setEditingId(null)
      setEditName('')
      router.invalidate()
    } else {
      setError(result.error)
    }
  }

  async function handleRoleChange() {
    if (!userToChangeRole) return

    setError(null)
    setSuccess(null)

    const result = await updateUserRole(userToChangeRole.id, selectedRole)

    if (result.success) {
      setSuccess('Roll uppdaterad')
      setRoleDialogOpen(false)
      setUserToChangeRole(null)
      router.invalidate()
    } else {
      setError(result.error)
      setRoleDialogOpen(false)
      setUserToChangeRole(null)
    }
  }

  async function handleDelete() {
    if (!userToDelete) return

    setError(null)
    setSuccess(null)

    const result = await deleteUser(userToDelete.id)

    if (result.success) {
      setSuccess('Användare borttagen')
      setDeleteDialogOpen(false)
      setUserToDelete(null)

      if (users.length === 1 && page > 1) {
        navigate({ page: page - 1 })
      } else {
        router.invalidate()
      }
    } else {
      setError(result.error)
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  async function handleGrantCredits() {
    if (!userToGrant) return
    const amount = parseInt(creditAmount, 10)
    if (!amount || amount < 1 || amount > 1000) {
      setError('Antal måste vara mellan 1 och 1000')
      return
    }

    setError(null)
    setSuccess(null)

    const result = await grantUserCredits(userToGrant.email, amount)

    if (result.success) {
      setSuccess(
        `${amount} AI-poäng beviljades till ${userToGrant.name || userToGrant.email}. Nytt saldo: ${result.data?.balance}`
      )
      setCreditDialogOpen(false)
      setUserToGrant(null)
      router.invalidate()
    } else {
      setError(result.error)
      setCreditDialogOpen(false)
      setUserToGrant(null)
    }
  }

  function startEdit(user: User) {
    setEditingId(user.id)
    setEditName(user.name || '')
    setError(null)
    setSuccess(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setError(null)
  }

  function openRoleDialog(user: User) {
    setUserToChangeRole(user)
    setSelectedRole(user.role === 'admin' ? 'user' : 'admin')
    setRoleDialogOpen(true)
  }

  function confirmDelete(user: User) {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  function openCreditDialog(user: User) {
    setUserToGrant(user)
    setCreditAmount('10')
    setCreditDialogOpen(true)
  }

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (page > 3) {
        pages.push('ellipsis')
      }

      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis')
      }

      pages.push(totalPages)
    }

    return pages
  }

  const isCurrentUser = (user: User) => currentUser?.email === user.email

  const roleFilterOptions: { value: UserRole | 'all'; label: string }[] = [
    { value: 'all', label: 'Alla' },
    { value: 'user', label: 'Användare' },
    { value: 'admin', label: 'Admins' },
  ]

  function SortableHeader({ field, children, className }: { field: UserSortField; children: React.ReactNode; className?: string }) {
    const active = sortBy === field
    return (
      <TableHead className={className}>
        <button
          onClick={() => handleSort(field)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {children}
          {active ? (
            sortDir === 'asc' ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-30" />
          )}
        </button>
      </TableHead>
    )
  }

  function UserActions({ user }: { user: User }) {
    const isSelf = isCurrentUser(user)

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <EllipsisVertical className="h-4 w-4" />
            <span className="sr-only">Åtgärder</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => startEdit(user)}>
            <Pencil className="mr-2 h-4 w-4" />
            Redigera namn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCreditDialog(user)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Bevilja AI-poäng
          </DropdownMenuItem>
          {!(isSelf && user.role === 'admin') && (
            <DropdownMenuItem onClick={() => openRoleDialog(user)}>
              <UserCog className="mr-2 h-4 w-4" />
              Byt roll
            </DropdownMenuItem>
          )}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => confirmDelete(user)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Ta bort
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Användare
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Hantera användare, roller och AI-poäng.
        </p>
      </header>

      {/* Status messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-900">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Toolbar: search + role filter */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Sök användare..."
              defaultValue={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex rounded-lg bg-muted p-1">
            {roleFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => navigate({ page: 1, role: opt.value })}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  roleFilter === opt.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Users list */}
      <Card>
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Användare</h2>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? 'användare' : 'användare'}
          </p>
        </div>

        {isPending ? (
          <div className="p-4">
            {/* Desktop skeleton */}
            <div className="hidden space-y-3 md:block">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="ml-auto h-5 w-12" />
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
            {/* Mobile skeleton */}
            <div className="space-y-3 md:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <Skeleton className="mb-2 h-5 w-32" />
                  <Skeleton className="mb-2 h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            {search ? 'Inga användare hittades' : 'Inga användare finns ännu'}
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="name">Användare</SortableHeader>
                    <SortableHeader field="role">Roll</SortableHeader>
                    <SortableHeader field="provider">Inloggning</SortableHeader>
                    <SortableHeader field="recipe_count" className="text-right">Recept</SortableHeader>
                    <SortableHeader field="credit_balance" className="text-right">AI-poäng</SortableHeader>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {editingId === user.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(user.id, editName)
                                else if (e.key === 'Escape') cancelEdit()
                              }}
                              autoFocus
                              className="h-8 w-48"
                              placeholder="Ange namn"
                            />
                            <Button size="sm" className="h-8" onClick={() => handleRename(user.id, editName)}>
                              Spara
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8" onClick={cancelEdit}>
                              Avbryt
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium">{user.name || user.email}</p>
                            {user.name && (
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role === 'admin' ? (
                          <Badge className="bg-green-100 text-green-900 hover:bg-green-100">Admin</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-100">Användare</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.provider === 'google' ? (
                          <Badge variant="outline" className="border-blue-200 text-blue-700">Google</Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-200 text-gray-700">E-post</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{user.recipe_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{user.credit_balance}</TableCell>
                      <TableCell>
                        <UserActions user={user} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 p-4 md:hidden">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-lg border border-border p-3"
                >
                  {editingId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(user.id, editName)
                          else if (e.key === 'Escape') cancelEdit()
                        }}
                        autoFocus
                        className="flex-1"
                        placeholder="Ange namn"
                      />
                      <Button size="sm" onClick={() => handleRename(user.id, editName)}>
                        Spara
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Avbryt
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{user.name || user.email}</span>
                          {user.role === 'admin' ? (
                            <Badge className="bg-green-100 text-green-900 hover:bg-green-100">Admin</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-100">Användare</Badge>
                          )}
                          {user.provider === 'google' ? (
                            <Badge variant="outline" className="border-blue-200 text-blue-700">Google</Badge>
                          ) : (
                            <Badge variant="outline" className="border-gray-200 text-gray-700">E-post</Badge>
                          )}
                        </div>
                        {user.name && (
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
                        )}
                        <div className="mt-1.5 flex gap-4 text-sm text-muted-foreground">
                          <span>{user.recipe_count} recept</span>
                          <span>{user.credit_balance} AI-poäng</span>
                        </div>
                      </div>
                      <UserActions user={user} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t border-border p-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1) navigate({ page: page - 1 })
                        }}
                        className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>

                    {getPageNumbers().map((pageNum, idx) => (
                      <PaginationItem key={idx}>
                        {pageNum === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              navigate({ page: pageNum })
                            }}
                            isActive={pageNum === page}
                          >
                            {pageNum}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page < totalPages) navigate({ page: page + 1 })
                        }}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Role change dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Byt roll</DialogTitle>
            <DialogDescription>
              Ändra roll för {userToChangeRole?.name || userToChangeRole?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as UserRole)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Välj roll" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Användare</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoleDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleRoleChange}>Spara</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort användare</DialogTitle>
            <DialogDescription>
              Är du säker på att du vill ta bort användaren{' '}
              {userToDelete?.name || userToDelete?.email}?
              {userToDelete && userToDelete.recipe_count > 0 && (
                <span className="mt-2 block font-semibold text-destructive">
                  Varning: Denna användare har {userToDelete.recipe_count}{' '}
                  recept som också kommer att tas bort.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Ta bort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant credits dialog */}
      <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bevilja AI-poäng</DialogTitle>
            <DialogDescription>
              Ge AI-poäng till {userToGrant?.name || userToGrant?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min={1}
              max={1000}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Antal"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreditDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleGrantCredits}>Bevilja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
