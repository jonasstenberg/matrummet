"use client";

import { AsyncAutocompleteInput } from "@/components/ui/async-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface Ingredient {
  name: string;
  measurement: string;
  quantity: string;
  form?: string;
  group_id?: string | null;
}

// Internal state to track group names
interface GroupInfo {
  id: string;
  name: string;
}

interface IngredientEditorProps {
  ingredients: Ingredient[];
  groups?: GroupInfo[]; // Optional initial groups from parent
  lowConfidenceIndices?: number[]; // Indices of ingredients to warn about
  onChange: (ingredients: Ingredient[], groups: GroupInfo[]) => void;
}

// Internal editor item type - can be either a group header or an ingredient
type EditorItem =
  | { type: "group"; id: string; name: string }
  | { type: "ingredient"; index: number; data: Ingredient };

export function IngredientEditor({
  ingredients,
  groups: initialGroups,
  lowConfidenceIndices = [],
  onChange,
}: IngredientEditorProps) {
  // Extract and order groups based on their first appearance in ingredients
  const extractGroups = (): GroupInfo[] => {
    // Build a map of group IDs to their names from initialGroups
    const groupNameMap = new Map<string, string>();
    if (initialGroups) {
      initialGroups.forEach((g) => groupNameMap.set(g.id, g.name));
    }

    // Order groups by their first appearance in ingredients
    const orderedGroups: GroupInfo[] = [];
    const seen = new Set<string>();

    ingredients.forEach((ing) => {
      if (ing.group_id && !seen.has(ing.group_id)) {
        const name = groupNameMap.get(ing.group_id) || `Grupp ${orderedGroups.length + 1}`;
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

  // Build editor items from ingredients and groups
  function buildEditorItems(): EditorItem[] {
    const items: EditorItem[] = [];
    let currentGroupId: string | null = null;

    ingredients.forEach((ingredient, index) => {
      const groupId = ingredient.group_id;

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
        type: "ingredient",
        index,
        data: ingredient,
      });
    });

    return items;
  }

  function addIngredient(groupId?: string | null) {
    const newIngredient = { name: "", measurement: "", quantity: "", form: "", group_id: groupId || null };

    if (!groupId) {
      // No group specified - add at end
      updateWithGroups([...ingredients, newIngredient]);
      return;
    }

    // Find the last index of an ingredient in this group
    let insertIndex = -1;
    for (let i = ingredients.length - 1; i >= 0; i--) {
      if (ingredients[i].group_id === groupId) {
        insertIndex = i + 1; // Insert after the last ingredient in the group
        break;
      }
    }

    if (insertIndex === -1) {
      // Group has no ingredients yet, add at end
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
        { name: "", measurement: "", quantity: "", form: "", group_id: newGroupId },
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
    // Remove all ingredients in this group
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
      // Crossing group boundary - only change group_id, don't swap
      // This makes the item move exactly one visual position (across the header)
      updated[index] = { ...currentIngredient, group_id: adjacentGroupId };
      updateWithGroups(updated);
    } else {
      // Same group - swap positions
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      updateWithGroups(updated);
    }
  }

  function getGroupOrder(): string[] {
    // Return list of group IDs in their current display order
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

    // Reorder ingredients to reflect new group order
    // Get all ingredients grouped by their group_id
    const ungrouped = ingredients.filter((ing) => !ing.group_id);
    const grouped = new Map<string, typeof ingredients>();

    groupOrder.forEach((gid) => {
      grouped.set(
        gid,
        ingredients.filter((ing) => ing.group_id === gid)
      );
    });

    // Swap the two groups in the order
    const newOrder = [...groupOrder];
    [newOrder[currentIndex], newOrder[targetIndex]] = [
      newOrder[targetIndex],
      newOrder[currentIndex],
    ];

    // Rebuild ingredients array with new order
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 justify-between">
        <Label className="text-base">Ingredienser</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addIngredient(null)}
          >
            Lägg till ingrediens
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

      {ingredients.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Inga ingredienser ännu. Klicka på knappen ovan för att lägga till.
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
                    placeholder="Gruppnamn (t.ex. 'Sås', 'Pasta')"
                    value={item.name}
                    onChange={(e) => updateGroupName(item.id, e.target.value)}
                    className="border-orange-300 bg-white font-semibold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveGroup(item.id, "up")}
                    disabled={isFirstGroup(item.id)}
                    className="h-8 w-8"
                    aria-label="Flytta grupp upp"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveGroup(item.id, "down")}
                    disabled={isLastGroup(item.id)}
                    className="h-8 w-8"
                    aria-label="Flytta grupp ner"
                  >
                    ↓
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addIngredient(item.id)}
                  className="text-xs"
                >
                  + Ingrediens
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

          const ingredient = item.data;
          const index = item.index;
          const isInGroup = !!ingredient.group_id;
          const hasLowConfidence = lowConfidenceIndices.includes(index);

          return (
            <div key={`ingredient-${index}`} className="space-y-1">
              <div
                className={cn(
                  "flex gap-2 rounded-lg border p-3",
                  isInGroup && "ml-4 border-orange-200 bg-orange-50/30"
                )}
              >
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <div className="flex-1">
                    <AsyncAutocompleteInput
                      placeholder="Namn"
                      fetchUrl="/api/foods"
                      value={ingredient.name}
                      onChange={(value) =>
                        updateIngredient(index, "name", value)
                      }
                      className={cn(isInGroup && "bg-white")}
                    />
                  </div>
                  <div className="w-full sm:w-24">
                    <Input
                      placeholder="Mängd"
                      value={ingredient.quantity}
                      onChange={(e) =>
                        updateIngredient(index, "quantity", e.target.value)
                      }
                      className={cn(isInGroup && "bg-white")}
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <AsyncAutocompleteInput
                      placeholder="Mått"
                      fetchUrl="/api/units"
                      value={ingredient.measurement}
                      onChange={(value) =>
                        updateIngredient(index, "measurement", value)
                      }
                      className={cn(isInGroup && "bg-white")}
                    />
                  </div>
                  <div className="w-full sm:w-28">
                    <Input
                      placeholder="Form"
                      value={ingredient.form || ""}
                      onChange={(e) =>
                        updateIngredient(index, "form", e.target.value)
                      }
                      className={cn(isInGroup && "bg-white")}
                      title="T.ex. klyftor, zest, strimlad"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveIngredient(index, "up")}
                    disabled={index === 0}
                    className="h-8 w-8"
                    aria-label="Flytta ingrediens upp"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveIngredient(index, "down")}
                    disabled={index === ingredients.length - 1}
                    className="h-8 w-8"
                    aria-label="Flytta ingrediens ner"
                  >
                    ↓
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIngredient(index)}
                  className="h-8 w-8 text-destructive"
                  aria-label="Ta bort ingrediens"
                >
                  ×
                </Button>
              </div>
              {hasLowConfidence && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 text-sm text-amber-700",
                    isInGroup && "ml-4"
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Kontrollera mängd och enhet</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
