import type { TokenStorage } from '@matrummet/api-client'

const AUTH_KEY = 'matrummet-auth'

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
}
