import { View, Text, StyleSheet } from 'react-native'
import type { Ingredient, IngredientGroup } from '@matrummet/types/types'

interface IngredientListProps {
  ingredients: Ingredient[]
  groups: IngredientGroup[] | undefined
}

export function IngredientList({ ingredients: rawIngredients, groups: rawGroups }: IngredientListProps) {
  const ingredients = rawIngredients
  const groups = rawGroups ?? []
  // Group ingredients by group_id
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))

  // Collect unique group IDs in order
  const seenGroups = new Set<string | null | undefined>()
  const orderedGroupIds: (string | null | undefined)[] = []
  for (const ing of ingredients) {
    if (!seenGroups.has(ing.group_id)) {
      seenGroups.add(ing.group_id)
      orderedGroupIds.push(ing.group_id)
    }
  }

  return (
    <View>
      {orderedGroupIds.map((groupId) => {
        const groupIngredients = ingredients.filter((i) => i.group_id === groupId)
        const groupName = groupId ? groupMap.get(groupId) : null

        return (
          <View key={groupId ?? 'ungrouped'} style={styles.group}>
            {groupName && (
              <Text style={styles.groupName}>{groupName}</Text>
            )}
            {groupIngredients.map((ing, idx) => (
              <View key={ing.id ?? idx} style={styles.ingredientRow}>
                <Text style={styles.quantity}>
                  {ing.quantity}{ing.measurement ? ` ${ing.measurement}` : ''}
                </Text>
                <Text style={styles.ingredientName}>
                  {ing.name}{ing.form ? `, ${ing.form}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 12,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  quantity: {
    color: '#6b7280',
    width: 80,
    fontSize: 14,
  },
  ingredientName: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
})
