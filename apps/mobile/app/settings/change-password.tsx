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
import { Stack, useRouter } from 'expo-router'
import { api } from '@/lib/api'

const isIOS = Platform.OS === 'ios'

export default function ChangePasswordScreen() {
  const router = useRouter()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!oldPassword) {
      Alert.alert('Fel', 'Ange ditt nuvarande lösenord.')
      return
    }
    if (!newPassword) {
      Alert.alert('Fel', 'Ange ett nytt lösenord.')
      return
    }
    if (newPassword.length < 8) {
      Alert.alert('Fel', 'Lösenordet måste vara minst 8 tecken.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Fel', 'Lösenorden matchar inte.')
      return
    }

    setSaving(true)
    try {
      await api.changePassword(oldPassword, newPassword)
      Alert.alert('Klart', 'Lösenordet har ändrats.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      Alert.alert('Fel', err instanceof Error ? err.message : 'Kunde inte byta lösenord.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Byt lösenord' }} />
      <KeyboardAvoidingView
        behavior={isIOS ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.label}>Nuvarande lösenord</Text>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="Ange nuvarande lösenord"
              placeholderTextColor="#9ca3af"
              editable={!saving}
            />

            <View style={styles.separator} />

            <Text style={styles.label}>Nytt lösenord</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Minst 8 tecken, versaler, gemener och siffror"
              placeholderTextColor="#9ca3af"
              editable={!saving}
            />

            <View style={styles.separator} />

            <Text style={styles.label}>Bekräfta nytt lösenord</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="Upprepa nytt lösenord"
              placeholderTextColor="#9ca3af"
              editable={!saving}
              returnKeyType="done"
              onSubmitEditing={() => void handleSave()}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Sparar...' : 'Byt lösenord'}
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
    marginTop: 4,
  },
  input: {
    fontSize: 16,
    color: '#111827',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  separator: {
    height: 12,
  },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: Platform.select({ ios: 12, android: 28 }),
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
})
