import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { CategoryGroup } from '@matrummet/types/types'

interface CategoryPickerProps {
  visible: boolean
  groups: CategoryGroup[]
  selected: string[]
  onToggle: (category: string) => void
  onClose: () => void
}

export function CategoryPicker({ visible, groups, selected, onToggle, onClose }: CategoryPickerProps) {
  return (
    <Modal
      visible={visible}
      animationType={Platform.select({ ios: 'slide', android: 'fade' })}
      presentationStyle={Platform.select({ ios: 'pageSheet', android: 'fullScreen' })}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Välj kategorier</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.doneButton}>Klar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {groups.map(group => (
            <View key={group.name} style={styles.group}>
              <Text style={styles.groupName}>{group.name}</Text>
              <View style={styles.chipsContainer}>
                {group.categories.map(cat => {
                  const isSelected = selected.includes(cat)
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => onToggle(cat)}
                      activeOpacity={0.7}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#15803d" style={styles.checkIcon} />
                      )}
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.select({ ios: '#f2f2f7', android: '#ffffff' }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.select({ ios: 20, android: 16 }),
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  doneButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#16a34a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  group: {
    marginBottom: 24,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#16a34a',
  },
  checkIcon: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#15803d',
    fontWeight: '600',
  },
})
