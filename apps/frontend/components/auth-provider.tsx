'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, UserHome } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  homes: UserHome[]
  isLoading: boolean
  credits: number | null
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
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

  // Sync homes when server re-renders with fresh data (e.g. after creating/deleting a home)
  useEffect(() => {
    setHomes(initialHomes)
  }, [initialHomes])
  const [credits, setCredits] = useState<number | null>(null)

  const refreshCredits = useCallback(async () => {
    try {
      const response = await fetch('/api/credits/balance')
      if (response.ok) {
        const data = await response.json()
        setCredits(data.balance)
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

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Inloggning misslyckades')
      }

      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/registrera', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registrering misslyckades')
      }

      setUser(data.user)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Utloggning misslyckades')
      }

      setUser(null)
      router.refresh()
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
    <AuthContext.Provider value={{ user, homes, isLoading, credits, login, signup, logout, clearUser, updateUser, setCredits, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  )
}
