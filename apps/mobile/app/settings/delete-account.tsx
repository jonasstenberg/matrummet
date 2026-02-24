import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/auth-provider'

const isIOS = Platform.OS === 'ios'

export default function DeleteAccountScreen() {
  const { logout } = useAuth()
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDelete = () => {
    Alert.alert(
      'Radera konto',
      'Är du helt säker? Ditt konto raderas permanent. Dina recept behålls men kopplas bort från ditt konto.',
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Radera',
          style: 'destructive',
          onPress: () => void confirmDelete(),
        },
      ],
    )
  }

  const confirmDelete = async () => {
    if (!password) {
      Alert.alert('Fel', 'Ange ditt lösenord för att bekräfta.')
      return
    }

    setDeleting(true)
    try {
      await api.deleteAccount(password)
      await logout()
    } catch (err) {
      Alert.alert('Fel', err instanceof Error ? err.message : 'Kunde inte radera kontot.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Radera konto' }} />
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={24} color="#dc2626" />
              <Text style={styles.warningTitle}>Permanent åtgärd</Text>
            </View>
            <Text style={styles.warningText}>
              Om du raderar ditt konto:
            </Text>
            <View style={styles.warningList}>
              <Text style={styles.warningItem}>
                {'\u2022'} Ditt konto och all personlig data tas bort
              </Text>
              <Text style={styles.warningItem}>
                {'\u2022'} Dina recept behålls men kopplas bort
              </Text>
              <Text style={styles.warningItem}>
                {'\u2022'} Du kan inte ångra detta
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Bekräfta med lösenord</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="Ange ditt lösenord"
              placeholderTextColor="#9ca3af"
              editable={!deleting}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color="#ffffff" />
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Raderar...' : 'Radera mitt konto'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flex: 1,
    backgroundColor: Platform.select({ ios: '#f2f2f7', android: '#f5f5f5' }),
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  warningCard: {
    backgroundColor: '#fef2f2',
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#dc2626',
  },
  warningText: {
    fontSize: 15,
    color: '#7f1d1d',
    marginBottom: 8,
  },
  warningList: {
    gap: 4,
  },
  warningItem: {
    fontSize: 14,
    color: '#991b1b',
    paddingLeft: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    color: '#111827',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#dc2626',
    borderRadius: Platform.select({ ios: 12, android: 28 }),
    paddingVertical: 16,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
})
