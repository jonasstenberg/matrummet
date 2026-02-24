import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/providers/auth-provider'
import { api } from '@/lib/api'

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth()
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)

  const handleSaveName = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      Alert.alert('Fel', 'Namn kan inte vara tomt.')
      return
    }
    if (trimmed === user?.name) {
      setEditingName(false)
      return
    }

    setSaving(true)
    try {
      await api.updateProfile(trimmed)
      await refreshUser()
      setEditingName(false)
    } catch (err) {
      Alert.alert('Fel', err instanceof Error ? err.message : 'Kunde inte uppdatera namn.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    Alert.alert('Logga ut', 'Är du säker?', [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Logga ut',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ])
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {/* Profile section */}
      <Text style={styles.sectionHeader}>Profil</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowLabelContainer}>
            <Ionicons name="mail-outline" size={18} color="#6b7280" />
            <Text style={styles.rowLabel}>E-post</Text>
          </View>
          <Text style={styles.rowValue}>{user?.email}</Text>
        </View>
        <View style={styles.separator} />
        <View style={styles.row}>
          <View style={styles.rowLabelContainer}>
            <Ionicons name="person-outline" size={18} color="#6b7280" />
            <Text style={styles.rowLabel}>Namn</Text>
          </View>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void handleSaveName()}
                editable={!saving}
              />
              <TouchableOpacity
                onPress={() => void handleSaveName()}
                disabled={saving}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setName(user?.name ?? '')
                  setEditingName(false)
                }}
                disabled={saving}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editableValue}
              onPress={() => setEditingName(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.rowValue}>{user?.name}</Text>
              <Ionicons name="pencil" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Settings links */}
      <Text style={styles.sectionHeader}>Inställningar</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/settings/change-password')}
        >
          <View style={styles.rowLabelContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#6b7280" />
            <Text style={styles.linkText}>Byt lösenord</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Danger zone */}
      <Text style={styles.sectionHeader}>Farozon</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => router.push('/settings/delete-account')}
        >
          <View style={styles.rowLabelContainer}>
            <Ionicons name="trash-outline" size={18} color="#dc2626" />
            <Text style={styles.dangerLinkText}>Radera konto</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#dc2626" />
        <Text style={styles.logoutText}>Logga ut</Text>
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Platform.select({ ios: '#f2f2f7', android: '#f5f5f5' }),
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    marginBottom: 16,
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
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 16,
    color: '#111827',
  },
  editableValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#16a34a',
    paddingVertical: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e7eb',
    marginLeft: 16,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: {
    fontSize: 16,
    color: '#111827',
  },
  dangerLinkText: {
    fontSize: 16,
    color: '#dc2626',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: Platform.select({ ios: 12, android: 16 }),
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 16,
  },
  bottomSpacer: {
    height: 40,
  },
})
