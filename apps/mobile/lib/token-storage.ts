import * as SecureStore from 'expo-secure-store'
import type { TokenStorage } from '@matrummet/api-client'

const AUTH_KEY = 'matrummet-auth'

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
}
