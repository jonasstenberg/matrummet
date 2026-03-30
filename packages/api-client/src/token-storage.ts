/**
 * Platform-agnostic token storage interface.
 * Web: implements via cookies
 * Mobile: implements via expo-secure-store
 */
export interface TokenStorage {
  getAppToken(): Promise<string | null>
  setAppToken(token: string): Promise<void>
  removeAppToken(): Promise<void>
  getRefreshToken(): Promise<string | null>
  setRefreshToken(token: string): Promise<void>
  removeRefreshToken(): Promise<void>
}
