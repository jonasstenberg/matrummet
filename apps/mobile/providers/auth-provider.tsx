import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { JWTPayload } from '@matrummet/api-client'
import { api } from '@/lib/api'

interface AuthContextType {
  user: JWTPayload | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<JWTPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.getCurrentUser().then((u) => {
      setUser(u)
      setIsLoading(false)
    })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const payload = await api.login(email, password)
    setUser(payload)
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const payload = await api.signup(name, email, password)
    setUser(payload)
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const u = await api.getCurrentUser()
    setUser(u)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
