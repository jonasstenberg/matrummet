import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { ShoppingListItem } from '@matrummet/types/types'

interface ShoppingItemProps {
  item: ShoppingListItem
  onToggle: () => void
}

export function ShoppingItem({ item, onToggle }: ShoppingItemProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onToggle}
      activeOpacity={0.6}
    >
      <View
        style={[
          styles.checkbox,
          item.is_checked ? styles.checkboxChecked : styles.checkboxUnchecked,
        ]}
      >
        {item.is_checked && <Text style={styles.checkmark}>✓</Text>}
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.displayName,
            item.is_checked && styles.displayNameChecked,
          ]}
        >
          {item.display_name}
        </Text>
        {(item.quantity > 0 || item.display_unit) && (
          <Text style={styles.detail}>
            {item.quantity > 0 ? item.quantity : ''} {item.display_unit}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  checkboxUnchecked: {
    borderColor: '#d1d5db',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    color: '#111827',
  },
  displayNameChecked: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  detail: {
    fontSize: 12,
    color: '#9ca3af',
  },
})
