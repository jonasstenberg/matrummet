'use client'

import { createContext, useContext } from 'react'

interface HomeContextValue {
  homeId: string
  homeName: string
}

export const HomeContext = createContext<HomeContextValue | null>(null)

export function useHome() {
  const ctx = useContext(HomeContext)
  if (!ctx) throw new Error('useHome must be used within a HomeProvider')
  return ctx
}

export function HomeProvider({ homeId, homeName, children }: HomeContextValue & { children: React.ReactNode }) {
  return <HomeContext.Provider value={{ homeId, homeName }}>{children}</HomeContext.Provider>
}
