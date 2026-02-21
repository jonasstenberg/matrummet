import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from '@tanstack/react-router'
import { User, UserHome } from '@/lib/types'
import { logoutFn } from '@/lib/auth-actions'
import { getCreditBalance } from '@/lib/credits-actions'

interface AuthContextValue {
  user: User | null
  homes: UserHome[]
  isLoading: boolean
  credits: number | null
  logout: () => Promise<void>
  clearUser: () => void
  updateUser: (updates: Partial<User>) => void
  setCredits: (credits: number) => void
  refreshCredits: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const EMPTY_HOMES: UserHome[] = []

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
  initialUser: User | null
  initialHomes?: UserHome[]
}

export function AuthProvider({ children, initialUser, initialHomes = EMPTY_HOMES }: AuthProviderProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(initialUser)
  const [homes, setHomes] = useState<UserHome[]>(initialHomes)
  const [isLoading, setIsLoading] = useState(false)

  // Sync user/homes when server re-renders with fresh data (e.g. after login or creating a home)
  useEffect(() => {
    setUser(initialUser)
  }, [initialUser])
  useEffect(() => {
    setHomes(initialHomes)
  }, [initialHomes])
  const [credits, setCredits] = useState<number | null>(null)

  const refreshCredits = useCallback(async () => {
    try {
      const result = await getCreditBalance()
      if ('balance' in result) {
        setCredits(result.balance)
      }
    } catch {
      // Silent fail
    }
  }, [])

  // Fetch credits when user changes
  useEffect(() => {
    if (user) {
      refreshCredits()
    } else {
      setCredits(null)
    }
  }, [user, refreshCredits])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await logoutFn()

      if (result && 'error' in result && result.error) {
        throw new Error(result.error)
      }

      setUser(null)
      router.invalidate()
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : null)
  }, [])

  const clearUser = useCallback(() => {
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, homes, isLoading, credits, logout, clearUser, updateUser, setCredits, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  )
}
