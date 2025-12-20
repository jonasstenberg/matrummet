"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Instruction {
  step: string;
  group_id?: string | null;
}

// Internal state to track group names
interface GroupInfo {
  id: string;
  name: string;
}

interface InstructionEditorProps {
  instructions: Instruction[];
  groups?: GroupInfo[]; // Optional initial groups from parent
  onChange: (instructions: Instruction[], groups: GroupInfo[]) => void;
}

// Internal editor item type - can be either a group header or an instruction
type EditorItem =
  | { type: "group"; id: string; name: string }
  | { type: "instruction"; index: number; data: Instruction };

export function InstructionEditor({
  instructions,
  groups: initialGroups,
  onChange,
}: InstructionEditorProps) {
  // Extract initial groups from instructions if not provided
  const extractGroups = (): GroupInfo[] => {
    if (initialGroups && initialGroups.length > 0) {
      return initialGroups;
    }

    const groupMap = new Map<string, string>();
    const seen = new Set<string>();

    instructions.forEach((inst) => {
      if (inst.group_id && !seen.has(inst.group_id)) {
        groupMap.set(inst.group_id, `Grupp ${groupMap.size + 1}`);
        seen.add(inst.group_id);
      }
    });
    return Array.from(groupMap.entries()).map(([id, name]) => ({ id, name }));
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

  // Build editor items from instructions and groups
  function buildEditorItems(): EditorItem[] {
    const items: EditorItem[] = [];
    let currentGroupId: string | null = null;

    instructions.forEach((instruction, index) => {
      const groupId = instruction.group_id;

      // Check if we need to add a new group header
      if (groupId && groupId !== currentGroupId) {
        const group = internalGroups.find((g) => g.id === groupId);
        items.push({
          type: "group",
          id: groupId,
          name: group?.name || "Grupp",
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
    updateWithGroups([
      ...instructions,
      { step: "", group_id: groupId || null },
    ]);
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
    // Remove all instructions in this group
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
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updateWithGroups(updated);
  }

  function updateGroupName(groupId: string, newName: string) {
    const newGroups = internalGroups.map((g) =>
      g.id === groupId ? { ...g, name: newName } : g
    );
    updateWithGroups(instructions, newGroups);
  }

  const editorItems = buildEditorItems();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 justify-between">
        <Label className="text-base">Instruktioner</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addInstruction(null)}
          >
            Lägg till steg
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addGroup}
            className="bg-orange-50 hover:bg-orange-100"
          >
            Lägg till grupp
          </Button>
        </div>
      </div>

      {instructions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Inga instruktioner ännu. Klicka på knappen ovan för att lägga till.
        </p>
      )}

      <div className="space-y-3">
        {editorItems.map((item) => {
          if (item.type === "group") {
            return (
              <div
                key={`group-${item.id}`}
                className="group flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50/50 p-3"
              >
                <div className="flex-1">
                  <Input
                    placeholder="Gruppnamn (t.ex. 'Tillbehör', 'Garnering')"
                    value={item.name}
                    onChange={(e) => updateGroupName(item.id, e.target.value)}
                    className="border-orange-300 bg-white font-semibold"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addInstruction(item.id)}
                  className="text-xs"
                >
                  + Instruktion
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGroup(item.id)}
                  className="h-8 w-8 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Ta bort grupp"
                >
                  ×
                </Button>
              </div>
            );
          }

          const instruction = item.data;
          const index = item.index;
          const isInGroup = !!instruction.group_id;

          return (
            <div
              key={`instruction-${index}`}
              className={cn(
                "flex gap-2 rounded-lg border p-3",
                isInGroup && "ml-4 border-orange-200 bg-orange-50/30"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
                {index + 1}
              </div>

              <div className="flex-1">
                <Textarea
                  placeholder="Beskriv steget..."
                  value={instruction.step}
                  onChange={(e) => updateInstruction(index, e.target.value)}
                  className={cn("min-h-[80px]", isInGroup && "bg-white")}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveInstruction(index, "up")}
                  disabled={index === 0}
                  className="h-8 w-8"
                  aria-label="Flytta instruktion upp"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveInstruction(index, "down")}
                  disabled={index === instructions.length - 1}
                  className="h-8 w-8"
                  aria-label="Flytta instruktion ner"
                >
                  ↓
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInstruction(index)}
                className="h-8 w-8 text-destructive"
                aria-label="Ta bort instruktion"
              >
                ×
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
