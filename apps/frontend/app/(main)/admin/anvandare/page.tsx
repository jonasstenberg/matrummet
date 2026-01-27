'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, AlertCircle, UserCog, Sparkles } from 'lucide-react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

type UserRole = 'user' | 'admin'

interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  provider: string | null
  recipe_count: number
  date_published: string
}

interface PaginatedResponse {
  items: User[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function AdminUsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: currentUser, isLoading: authLoading } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination, search, and role filter - read from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const search = searchParams.get('search') || ''
  const roleFilter = (searchParams.get('role') || 'all') as UserRole | 'all'
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Debounce for search
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

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
      })

      if (search) {
        params.set('search', search)
      }

      if (roleFilter !== 'all') {
        params.set('role', roleFilter)
      }

      const response = await fetch(`/api/admin/users?${params}`)

      if (response.status === 403) {
        throw new Error('Du har inte behörighet att hantera användare')
      }

      if (!response.ok) {
        throw new Error('Kunde inte ladda användare')
      }

      const data: PaginatedResponse = await response.json()

      setUsers(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  // Load users when auth is ready and page/search/role params change
  useEffect(() => {
    if (!authLoading && currentUser) {
      loadUsers()
    }
  }, [authLoading, currentUser, loadUsers])

  async function handleRename(id: string, newName: string) {
    if (!newName.trim()) {
      setError('Namn kan inte vara tomt')
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, name: newName.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte uppdatera användare')
      }

      setSuccess('Användare uppdaterad')
      setEditingId(null)
      setEditName('')
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
    }
  }

  async function handleRoleChange() {
    if (!userToChangeRole) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/admin/users/role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: userToChangeRole.id, role: selectedRole }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte ändra roll')
      }

      setSuccess('Roll uppdaterad')
      setRoleDialogOpen(false)
      setUserToChangeRole(null)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setRoleDialogOpen(false)
      setUserToChangeRole(null)
    }
  }

  async function handleDelete() {
    if (!userToDelete) return

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch(
        `/api/admin/users?id=${userToDelete.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte ta bort användare')
      }

      setSuccess('Användare borttagen')
      setDeleteDialogOpen(false)
      setUserToDelete(null)

      // If we deleted the last item on this page and it's not page 1, go back a page
      if (users.length === 1 && page > 1) {
        updateURL(page - 1, search)
      } else {
        await loadUsers()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setDeleteDialogOpen(false)
      setUserToDelete(null)
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

  async function handleGrantCredits() {
    if (!userToGrant) return
    const amount = parseInt(creditAmount, 10)
    if (!amount || amount < 1 || amount > 1000) {
      setError('Antal måste vara mellan 1 och 1000')
      return
    }

    try {
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userToGrant.email, amount }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Kunde inte bevilja krediter')
      }

      const data = await response.json()
      setSuccess(`${amount} krediter beviljades till ${userToGrant.name || userToGrant.email}. Nytt saldo: ${data.balance}`)
      setCreditDialogOpen(false)
      setUserToGrant(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ett fel uppstod')
      setCreditDialogOpen(false)
      setUserToGrant(null)
    }
  }

  function updateURL(newPage: number, newSearch: string, newRole?: UserRole | 'all') {
    const params = new URLSearchParams()

    if (newPage > 1) {
      params.set('page', newPage.toString())
    }

    if (newSearch) {
      params.set('search', newSearch)
    }

    const role = newRole !== undefined ? newRole : roleFilter
    if (role !== 'all') {
      params.set('role', role)
    }

    const queryString = params.toString()
    router.replace(queryString ? `/admin/anvandare?${queryString}` : '/admin/anvandare')
  }

  function setRoleFilterValue(newRole: UserRole | 'all') {
    updateURL(1, search, newRole)
  }

  function handleSearchChange(value: string) {
    clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      // Reset to page 1 when search changes
      updateURL(1, value)
    }, 300)
  }

  function getPageNumbers() {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (page > 3) {
        pages.push('ellipsis')
      }

      // Show pages around current page
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < totalPages - 2) {
        pages.push('ellipsis')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  function getRoleBadge(role: UserRole) {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-green-100 text-green-900 hover:bg-green-100">
            Admin
          </Badge>
        )
      case 'user':
        return (
          <Badge className="bg-gray-100 text-gray-900 hover:bg-gray-100">
            Användare
          </Badge>
        )
    }
  }

  function getProviderBadge(provider: string | null) {
    if (provider === 'google') {
      return (
        <Badge variant="outline" className="border-blue-200 text-blue-700">
          Google
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="border-gray-200 text-gray-700">
        E-post
      </Badge>
    )
  }

  const isCurrentUser = (user: User) => currentUser?.email === user.email

  return (
    <>
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Hantera användare
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Hantera användare, ändra roller och ta bort konton.
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

      {/* Role filter tabs */}
      <Card className="p-4">
        <div className="flex gap-2">
          <Button
            variant={roleFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setRoleFilterValue('all')}
          >
            Alla
          </Button>
          <Button
            variant={roleFilter === 'user' ? 'default' : 'outline'}
            onClick={() => setRoleFilterValue('user')}
          >
            Användare
          </Button>
          <Button
            variant={roleFilter === 'admin' ? 'default' : 'outline'}
            onClick={() => setRoleFilterValue('admin')}
          >
            Administratörer
          </Button>
        </div>
      </Card>

      {/* Search */}
      <Card className="p-4">
        <Input
          type="search"
          placeholder="Sök användare..."
          defaultValue={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </Card>

      {/* Users list */}
      <Card className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Användare</h2>
          {!loading && (
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? 'användare' : 'användare'}
            </p>
          )}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">Laddar användare...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {search
              ? 'Inga användare hittades'
              : 'Inga användare finns ännu'}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50"
                >
                  {editingId === user.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRename(user.id, editName)
                          } else if (e.key === 'Escape') {
                            cancelEdit()
                          }
                        }}
                        autoFocus
                        className="flex-1"
                        placeholder="Ange namn"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleRename(user.id, editName)}
                      >
                        Spara
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        Avbryt
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {user.name || user.email}
                          </span>
                          {getRoleBadge(user.role)}
                          {getProviderBadge(user.provider)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {user.name && <span>{user.email} &bull; </span>}
                          {user.recipe_count} recept
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(user)}
                          aria-label="Redigera användare"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCreditDialog(user)}
                          aria-label="Bevilja krediter"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                        {/* Hide role change to user for current user */}
                        {!(isCurrentUser(user) && user.role === 'admin') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openRoleDialog(user)}
                            aria-label="Byt roll"
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Hide delete for current user */}
                        {!isCurrentUser(user) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => confirmDelete(user)}
                            aria-label="Ta bort användare"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 border-t border-border pt-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          if (page > 1) {
                            updateURL(page - 1, search)
                          }
                        }}
                        className={
                          page === 1
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
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
                              updateURL(pageNum, search)
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
                          if (page < totalPages) {
                            updateURL(page + 1, search)
                          }
                        }}
                        className={
                          page === totalPages
                            ? 'pointer-events-none opacity-50'
                            : ''
                        }
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
            <Button onClick={handleRoleChange}>
              Spara
            </Button>
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
                  Varning: Denna användare har {userToDelete.recipe_count} recept
                  som också kommer att tas bort.
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
            <DialogTitle>Bevilja AI-krediter</DialogTitle>
            <DialogDescription>
              Ge krediter till {userToGrant?.name || userToGrant?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min={1}
              max={1000}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="Antal krediter"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreditDialogOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={handleGrantCredits}>
              Bevilja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
