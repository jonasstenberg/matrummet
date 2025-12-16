import { User } from './types'

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin'
}
