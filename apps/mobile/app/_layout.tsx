import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/providers/auth-provider'

function RootLayoutNav() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [user, isLoading, segments, router])

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            headerShown: true,
            title: '',
            headerBackTitle: 'Tillbaka',
          }}
        />
        <Stack.Screen
          name="recipe/new"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="recipe/import"
          options={{
            headerShown: true,
            title: 'Importera recept',
            headerBackTitle: 'Tillbaka',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="recipe/manual"
          options={{
            headerShown: true,
            title: 'Nytt recept',
            headerBackTitle: 'Tillbaka',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="recipe/edit/[id]"
          options={{
            headerShown: true,
            title: 'Redigera recept',
            headerBackTitle: 'Tillbaka',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="settings/change-password"
          options={{
            headerShown: true,
            title: 'Byt lösenord',
            headerBackTitle: 'Tillbaka',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="settings/delete-account"
          options={{
            headerShown: true,
            title: 'Radera konto',
            headerBackTitle: 'Tillbaka',
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
