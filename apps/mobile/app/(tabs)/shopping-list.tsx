import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native'
import type { ShoppingListItem } from '@matrummet/types/types'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/auth-provider'
import { ShoppingItem } from '@/components/shopping-item'

export default function ShoppingListScreen() {
  const { user } = useAuth()
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newItemName, setNewItemName] = useState('')

  const loadItems = useCallback(async () => {
    try {
      const data = await api.getShoppingList()
      setItems(data)
    } catch (_err) {
      console.error('Failed to load shopping list:', _err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (user) loadItems()
  }, [user, loadItems])

  const toggleItem = useCallback(async (itemId: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_checked: !item.is_checked } : item
      )
    )
    try {
      await api.toggleShoppingListItem(itemId)
    } catch (_err) {
      loadItems() // Revert on error
    }
  }, [loadItems])

  const addItem = useCallback(async () => {
    const name = newItemName.trim()
    if (!name) return

    setNewItemName('')
    try {
      await api.addCustomShoppingListItem(name)
      await loadItems()
    } catch (_err) {
      Alert.alert('Fel', 'Kunde inte lägga till varan.')
    }
  }, [newItemName, loadItems])

  const clearChecked = useCallback(async () => {
    const checkedCount = items.filter((i) => i.is_checked).length
    if (checkedCount === 0) return

    Alert.alert(
      'Rensa avprickade',
      `Ta bort ${checkedCount} avprickade varor?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Rensa',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.clearCheckedItems()
              await loadItems()
            } catch (_err) {
              Alert.alert('Fel', 'Kunde inte rensa varor.')
            }
          },
        },
      ]
    )
  }, [items, loadItems])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    )
  }

  const checkedCount = items.filter((i) => i.is_checked).length

  return (
    <View style={styles.container}>
      {/* Add item input */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="Lägg till vara..."
          value={newItemName}
          onChangeText={setNewItemName}
          returnKeyType="done"
          onSubmitEditing={addItem}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={addItem}
        >
          <Text style={styles.addButtonText}>Lägg till</Text>
        </TouchableOpacity>
      </View>

      {/* Clear checked button */}
      {checkedCount > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearChecked}
        >
          <Text style={styles.clearButtonText}>
            Rensa {checkedCount} avprickade
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ShoppingItem item={item} onToggle={() => toggleItem(item.id)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              loadItems()
            }}
            tintColor="#16a34a"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Din inköpslista är tom</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  addRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  clearButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ef4444',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
})
