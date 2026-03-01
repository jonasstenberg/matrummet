import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Instruction, InstructionGroup } from '@matrummet/types/types'

interface InstructionListProps {
  instructions: Instruction[]
  groups: InstructionGroup[] | undefined
}

export function InstructionList({ instructions: rawInstructions, groups: rawGroups }: InstructionListProps) {
  const instructions = rawInstructions
  const groups = rawGroups ?? []
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set())

  // Collect unique group IDs in order
  const seenGroups = new Set<string | null | undefined>()
  const orderedGroupIds: (string | null | undefined)[] = []
  for (const inst of instructions) {
    if (!seenGroups.has(inst.group_id)) {
      seenGroups.add(inst.group_id)
      orderedGroupIds.push(inst.group_id)
    }
  }

  const toggleStep = useCallback((index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const allChecked = checkedSteps.size === instructions.length && instructions.length > 0

  let stepCounter = 0

  return (
    <View>
      {orderedGroupIds.map((groupId) => {
        const groupInstructions = instructions.filter((i) => i.group_id === groupId)
        const groupName = groupId ? groupMap.get(groupId) : null

        return (
          <View key={groupId ?? 'ungrouped'} style={styles.group}>
            {groupName && (
              <Text style={styles.groupName}>{groupName}</Text>
            )}
            {groupInstructions.map((inst, idx) => {
              const currentStep = stepCounter
              stepCounter++
              const isChecked = checkedSteps.has(currentStep)

              return (
                <TouchableOpacity
                  key={inst.id ?? idx}
                  style={styles.stepRow}
                  onPress={() => toggleStep(currentStep)}
                  activeOpacity={0.6}
                >
                  <View style={[styles.stepBadge, isChecked && styles.stepBadgeChecked]}>
                    {isChecked ? (
                      <Ionicons name="checkmark" size={16} color="#ffffff" />
                    ) : (
                      <Text style={styles.stepNumber}>{currentStep + 1}</Text>
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepText, isChecked && styles.stepTextChecked]}>
                      {inst.step}
                    </Text>
                    {inst.matched_ingredients && inst.matched_ingredients.length > 0 && (
                      <View style={styles.matchedRow}>
                        {inst.matched_ingredients.map((ing) => (
                          <View
                            key={ing.id}
                            style={[styles.matchedBadge, isChecked && styles.matchedBadgeChecked]}
                          >
                            <Text
                              style={[styles.matchedBadgeText, isChecked && styles.matchedBadgeTextChecked]}
                            >
                              {[ing.quantity || null, ing.measurement, ing.name]
                                .filter(Boolean)
                                .join(' ')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )
      })}
      {allChecked && (
        <View style={styles.allDone}>
          <Text style={styles.allDoneText}>Alla steg är klara! Smaklig måltid!</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 20,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 10,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepBadgeChecked: {
    backgroundColor: '#16a34a',
  },
  stepNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    flexShrink: 1,
  },
  stepText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  stepTextChecked: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  matchedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  matchedBadge: {
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  matchedBadgeChecked: {
    borderColor: 'rgba(156, 163, 175, 0.3)',
  },
  matchedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(22, 163, 74, 0.7)',
  },
  matchedBadgeTextChecked: {
    color: 'rgba(156, 163, 175, 0.7)',
  },
  allDone: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  allDoneText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
  },
})
