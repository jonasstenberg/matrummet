import { View, Text, StyleSheet } from 'react-native'
import type { Instruction, InstructionGroup } from '@matrummet/types/types'

interface InstructionListProps {
  instructions: Instruction[]
  groups: InstructionGroup[]
}

export function InstructionList({ instructions: rawInstructions, groups: rawGroups }: InstructionListProps) {
  const instructions = rawInstructions ?? []
  const groups = rawGroups ?? []
  const groupMap = new Map(groups.map((g) => [g.id, g.name]))

  // Collect unique group IDs in order
  const seenGroups = new Set<string | null | undefined>()
  const orderedGroupIds: (string | null | undefined)[] = []
  for (const inst of instructions) {
    if (!seenGroups.has(inst.group_id)) {
      seenGroups.add(inst.group_id)
      orderedGroupIds.push(inst.group_id)
    }
  }

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
              stepCounter++
              return (
                <View key={inst.id ?? idx} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNumber}>{stepCounter}</Text>
                  </View>
                  <Text style={styles.stepText}>{inst.step}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },
  groupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 12,
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
  stepNumber: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
})
