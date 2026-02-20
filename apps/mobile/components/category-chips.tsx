import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { CategoryGroup } from '@matrummet/types/types'

interface CategoryChipsProps {
  groups: CategoryGroup[]
  selected: string[]
  onToggle: (category: string) => void
}

export function CategoryChips({ groups, selected, onToggle }: CategoryChipsProps) {
  // Flatten all categories from all groups
  const allCategories = groups.flatMap((g) => g.categories)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {allCategories.map((cat) => {
        const isSelected = selected.includes(cat)
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => onToggle(cat)}
            style={[
              styles.chip,
              isSelected ? styles.chipSelected : styles.chipUnselected,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: '#16a34a',
  },
  chipUnselected: {
    backgroundColor: '#e5e5ea',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  chipTextUnselected: {
    color: '#374151',
  },
})
