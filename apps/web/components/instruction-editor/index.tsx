
import { useState } from "react";
import { InstructionEditorContext } from "./context";
import { GroupHeader } from "./group-header";
import { HeaderControls } from "./header-controls";
import { InstructionRow } from "./instruction-row";
import type {
  EditorItem,
  GroupInfo,
  Instruction,
  InstructionEditorProps,
} from "./types";

export type { GroupInfo, Instruction, InstructionEditorProps };

export function InstructionEditor({
  instructions,
  groups: initialGroups,
  onChange,
}: InstructionEditorProps) {
  const extractGroups = (): GroupInfo[] => {
    const groupNameMap = new Map<string, string>();
    if (initialGroups) {
      initialGroups.forEach((g) => groupNameMap.set(g.id, g.name));
    }

    const orderedGroups: GroupInfo[] = [];
    const seen = new Set<string>();

    instructions.forEach((inst) => {
      if (inst.group_id && !seen.has(inst.group_id)) {
        const name =
          groupNameMap.get(inst.group_id) || `Grupp ${orderedGroups.length + 1}`;
        orderedGroups.push({ id: inst.group_id, name });
        seen.add(inst.group_id);
      }
    });

    return orderedGroups;
  };

  const [internalGroups, setInternalGroups] = useState<GroupInfo[]>(
    extractGroups()
  );

  const updateWithGroups = (
    newInstructions: Instruction[],
    newGroups?: GroupInfo[]
  ) => {
    const updatedGroups = newGroups || internalGroups;
    setInternalGroups(updatedGroups);
    onChange(newInstructions, updatedGroups);
  };

  function buildEditorItems(): EditorItem[] {
    const items: EditorItem[] = [];
    let currentGroupId: string | null = null;

    instructions.forEach((instruction, index) => {
      const groupId = instruction.group_id;

      if (groupId && groupId !== currentGroupId) {
        const group = internalGroups.find((g) => g.id === groupId);
        items.push({
          type: "group",
          id: groupId,
          name: group?.name ?? "Grupp",
        });
        currentGroupId = groupId;
      } else if (!groupId && currentGroupId !== null) {
        currentGroupId = null;
      }

      items.push({
        type: "instruction",
        index,
        data: instruction,
      });
    });

    return items;
  }

  function addInstruction(groupId?: string | null) {
    const newInstruction = { step: "", group_id: groupId || null };

    if (!groupId) {
      updateWithGroups([...instructions, newInstruction]);
      return;
    }

    let insertIndex = -1;
    for (let i = instructions.length - 1; i >= 0; i--) {
      if (instructions[i].group_id === groupId) {
        insertIndex = i + 1;
        break;
      }
    }

    if (insertIndex === -1) {
      updateWithGroups([...instructions, newInstruction]);
      return;
    }

    const updated = [
      ...instructions.slice(0, insertIndex),
      newInstruction,
      ...instructions.slice(insertIndex),
    ];
    updateWithGroups(updated);
  }

  function addGroup() {
    const newGroupId = `temp-group-${Date.now()}`;
    const newGroupName = `Grupp ${internalGroups.length + 1}`;
    const newGroups = [
      ...internalGroups,
      { id: newGroupId, name: newGroupName },
    ];

    updateWithGroups(
      [...instructions, { step: "", group_id: newGroupId }],
      newGroups
    );
  }

  function updateInstruction(index: number, step: string) {
    const updated = [...instructions];
    updated[index] = { ...updated[index], step };
    updateWithGroups(updated);
  }

  function removeInstruction(index: number) {
    updateWithGroups(instructions.filter((_, i) => i !== index));
  }

  function removeGroup(groupId: string) {
    const newInstructions = instructions.filter(
      (inst) => inst.group_id !== groupId
    );
    const newGroups = internalGroups.filter((g) => g.id !== groupId);
    updateWithGroups(newInstructions, newGroups);
  }

  function moveInstruction(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === instructions.length - 1)
    ) {
      return;
    }

    const updated = [...instructions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const currentInstruction = updated[index];
    const adjacentInstruction = updated[newIndex];

    const currentGroupId = currentInstruction.group_id || null;
    const adjacentGroupId = adjacentInstruction.group_id || null;

    if (currentGroupId !== adjacentGroupId) {
      updated[index] = { ...currentInstruction, group_id: adjacentGroupId };
      updateWithGroups(updated);
    } else {
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      updateWithGroups(updated);
    }
  }

  function getGroupOrder(): string[] {
    const seen = new Set<string>();
    const order: string[] = [];
    instructions.forEach((inst) => {
      if (inst.group_id && !seen.has(inst.group_id)) {
        order.push(inst.group_id);
        seen.add(inst.group_id);
      }
    });
    return order;
  }

  function isFirstGroup(groupId: string): boolean {
    const order = getGroupOrder();
    return order.length > 0 && order[0] === groupId;
  }

  function isLastGroup(groupId: string): boolean {
    const order = getGroupOrder();
    return order.length > 0 && order[order.length - 1] === groupId;
  }

  function moveGroup(groupId: string, direction: "up" | "down") {
    const groupOrder = getGroupOrder();
    const currentIndex = groupOrder.indexOf(groupId);

    if (currentIndex === -1) return;
    if (direction === "up" && currentIndex === 0) return;
    if (direction === "down" && currentIndex === groupOrder.length - 1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    const ungrouped = instructions.filter((inst) => !inst.group_id);
    const grouped = new Map<string, Instruction[]>();

    groupOrder.forEach((gid) => {
      grouped.set(
        gid,
        instructions.filter((inst) => inst.group_id === gid)
      );
    });

    const newOrder = [...groupOrder];
    [newOrder[currentIndex], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[currentIndex],
    ];

    const reordered = [...ungrouped];
    newOrder.forEach((gid) => {
      const groupInstructions = grouped.get(gid) || [];
      reordered.push(...groupInstructions);
    });

    updateWithGroups(reordered);
  }

  function updateGroupName(groupId: string, newName: string) {
    const newGroups = internalGroups.map((g) =>
      g.id === groupId ? { ...g, name: newName } : g
    );
    updateWithGroups(instructions, newGroups);
  }

  const editorItems = buildEditorItems();

  const contextValue = {
    instructions,
    internalGroups,
    addInstruction,
    updateInstruction,
    removeInstruction,
    moveInstruction,
    addGroup,
    removeGroup,
    moveGroup,
    updateGroupName,
    isFirstGroup,
    isLastGroup,
  };

  return (
    <InstructionEditorContext.Provider value={contextValue}>
      <div className="space-y-4">
        <div className="divide-y divide-border/40">
          {editorItems.map((item, i) => {
            if (item.type === "group") {
              return (
                <GroupHeader
                  key={`group-${item.id}-${i}`}
                  groupId={item.id}
                  name={item.name}
                />
              );
            }

            return (
              <InstructionRow
                key={`instruction-${item.index}`}
                index={item.index}
                instruction={item.data}
                isInGroup={!!item.data.group_id}
              />
            );
          })}
        </div>
        <HeaderControls />
      </div>
    </InstructionEditorContext.Provider>
  );
}
