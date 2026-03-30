import * as SecureStore from 'expo-secure-store'
import type { TokenStorage } from '@matrummet/api-client'

const AUTH_KEY = 'matrummet-auth'
const REFRESH_KEY = 'matrummet-refresh'

export const mobileTokenStorage: TokenStorage = {
  async getAppToken() {
    return SecureStore.getItemAsync(AUTH_KEY)
  },
  async setAppToken(token: string) {
    await SecureStore.setItemAsync(AUTH_KEY, token)
  },
  async removeAppToken() {
    await SecureStore.deleteItemAsync(AUTH_KEY)
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY)
  },
  async setRefreshToken(token: string) {
    await SecureStore.setItemAsync(REFRESH_KEY, token)
  },
  async removeRefreshToken() {
    await SecureStore.deleteItemAsync(REFRESH_KEY)
  },
}
