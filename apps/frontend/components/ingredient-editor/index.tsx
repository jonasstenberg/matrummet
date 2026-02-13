"use client";

import { useState } from "react";
import { IngredientEditorContext } from "./context";
import { GroupHeader } from "./group-header";
import { HeaderControls } from "./header-controls";
import { IngredientRow } from "./ingredient-row";
import type {
  EditorItem,
  GroupInfo,
  Ingredient,
  IngredientEditorProps,
} from "./types";

export type { GroupInfo, Ingredient, IngredientEditorProps };

export function IngredientEditor({
  ingredients,
  groups: initialGroups,
  lowConfidenceIndices = [],
  onChange,
}: IngredientEditorProps) {
  const extractGroups = (): GroupInfo[] => {
    const groupNameMap = new Map<string, string>();
    if (initialGroups) {
      initialGroups.forEach((g) => groupNameMap.set(g.id, g.name));
    }

    const orderedGroups: GroupInfo[] = [];
    const seen = new Set<string>();

    ingredients.forEach((ing) => {
      if (ing.group_id && !seen.has(ing.group_id)) {
        const name =
          groupNameMap.get(ing.group_id) || `Grupp ${orderedGroups.length + 1}`;
        orderedGroups.push({ id: ing.group_id, name });
        seen.add(ing.group_id);
      }
    });

    return orderedGroups;
  };

  const [internalGroups, setInternalGroups] = useState<GroupInfo[]>(
    extractGroups()
  );

  const updateWithGroups = (
    newIngredients: Ingredient[],
    newGroups?: GroupInfo[]
  ) => {
    const updatedGroups = newGroups || internalGroups;
    setInternalGroups(updatedGroups);
    onChange(newIngredients, updatedGroups);
  };

  function buildEditorItems(): EditorItem[] {
    const items: EditorItem[] = [];
    let currentGroupId: string | null = null;

    ingredients.forEach((ingredient, index) => {
      const groupId = ingredient.group_id;

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
        type: "ingredient",
        index,
        data: ingredient,
      });
    });

    return items;
  }

  function addIngredient(groupId?: string | null) {
    const newIngredient = {
      name: "",
      measurement: "",
      quantity: "",
      form: "",
      group_id: groupId || null,
    };

    if (!groupId) {
      updateWithGroups([...ingredients, newIngredient]);
      return;
    }

    let insertIndex = -1;
    for (let i = ingredients.length - 1; i >= 0; i--) {
      if (ingredients[i].group_id === groupId) {
        insertIndex = i + 1;
        break;
      }
    }

    if (insertIndex === -1) {
      updateWithGroups([...ingredients, newIngredient]);
      return;
    }

    const updated = [
      ...ingredients.slice(0, insertIndex),
      newIngredient,
      ...ingredients.slice(insertIndex),
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
      [
        ...ingredients,
        {
          name: "",
          measurement: "",
          quantity: "",
          form: "",
          group_id: newGroupId,
        },
      ],
      newGroups
    );
  }

  function updateIngredient(
    index: number,
    field: keyof Ingredient,
    value: string
  ) {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    updateWithGroups(updated);
  }

  function removeIngredient(index: number) {
    updateWithGroups(ingredients.filter((_, i) => i !== index));
  }

  function removeGroup(groupId: string) {
    const newIngredients = ingredients.filter(
      (ing) => ing.group_id !== groupId
    );
    const newGroups = internalGroups.filter((g) => g.id !== groupId);
    updateWithGroups(newIngredients, newGroups);
  }

  function moveIngredient(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === ingredients.length - 1)
    ) {
      return;
    }

    const updated = [...ingredients];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const currentIngredient = updated[index];
    const adjacentIngredient = updated[newIndex];

    const currentGroupId = currentIngredient.group_id || null;
    const adjacentGroupId = adjacentIngredient.group_id || null;

    if (currentGroupId !== adjacentGroupId) {
      updated[index] = { ...currentIngredient, group_id: adjacentGroupId };
      updateWithGroups(updated);
    } else {
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      updateWithGroups(updated);
    }
  }

  function getGroupOrder(): string[] {
    const seen = new Set<string>();
    const order: string[] = [];
    ingredients.forEach((ing) => {
      if (ing.group_id && !seen.has(ing.group_id)) {
        order.push(ing.group_id);
        seen.add(ing.group_id);
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

    const ungrouped = ingredients.filter((ing) => !ing.group_id);
    const grouped = new Map<string, Ingredient[]>();

    groupOrder.forEach((gid) => {
      grouped.set(
        gid,
        ingredients.filter((ing) => ing.group_id === gid)
      );
    });

    const newOrder = [...groupOrder];
    [newOrder[currentIndex], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[currentIndex],
    ];

    const reordered = [...ungrouped];
    newOrder.forEach((gid) => {
      const groupIngredients = grouped.get(gid) || [];
      reordered.push(...groupIngredients);
    });

    updateWithGroups(reordered);
  }

  function updateGroupName(groupId: string, newName: string) {
    const newGroups = internalGroups.map((g) =>
      g.id === groupId ? { ...g, name: newName } : g
    );
    updateWithGroups(ingredients, newGroups);
  }

  const editorItems = buildEditorItems();

  const contextValue = {
    ingredients,
    internalGroups,
    lowConfidenceIndices,
    addIngredient,
    updateIngredient,
    removeIngredient,
    moveIngredient,
    addGroup,
    removeGroup,
    moveGroup,
    updateGroupName,
    isFirstGroup,
    isLastGroup,
  };

  return (
    <IngredientEditorContext.Provider value={contextValue}>
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
              <IngredientRow
                key={`ingredient-${item.index}`}
                index={item.index}
                ingredient={item.data}
                isInGroup={!!item.data.group_id}
              />
            );
          })}
        </div>
        <HeaderControls />
      </div>
    </IngredientEditorContext.Provider>
  );
}
