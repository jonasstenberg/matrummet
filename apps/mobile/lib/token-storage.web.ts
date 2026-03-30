import type { TokenStorage } from '@matrummet/api-client'

const AUTH_KEY = 'matrummet-auth'
const REFRESH_KEY = 'matrummet-refresh'

export const mobileTokenStorage: TokenStorage = {
  async getAppToken() {
    return localStorage.getItem(AUTH_KEY)
  },
  async setAppToken(token: string) {
    localStorage.setItem(AUTH_KEY, token)
  },
  async removeAppToken() {
    localStorage.removeItem(AUTH_KEY)
  },
  async getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY)
  },
  async setRefreshToken(token: string) {
    localStorage.setItem(REFRESH_KEY, token)
  },
  async removeRefreshToken() {
    localStorage.removeItem(REFRESH_KEY)
  },
}
