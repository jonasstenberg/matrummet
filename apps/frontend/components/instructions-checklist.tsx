"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { MarkAsCookedButton } from "@/components/mark-as-cooked-button";
import { useIsMobile } from "@/lib/hooks/use-media-query";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import type { Instruction, Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Smartphone } from "@/lib/icons";
import { useEffect, useState } from "react";

interface InstructionGroup {
  id?: string;
  name: string;
  sort_order?: number;
}

interface InstructionsChecklistProps {
  recipe: Recipe;
  instructions: Instruction[];
  instructionGroups?: InstructionGroup[];
}

export function InstructionsChecklist({
  recipe,
  instructions,
  instructionGroups,
}: InstructionsChecklistProps) {
  const recipeId = recipe.id;
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const isMobile = useIsMobile();

  useWakeLock(wakeLockEnabled);

  // Load checked state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`recipe-${recipeId}-steps`);
    if (stored) {
      try {
        setCheckedSteps(new Set(JSON.parse(stored)));
      } catch {
        // Invalid stored data, ignore
      }
    }
  }, [recipeId]);

  // Save checked state to localStorage
  useEffect(() => {
    localStorage.setItem(
      `recipe-${recipeId}-steps`,
      JSON.stringify([...checkedSteps])
    );
  }, [checkedSteps, recipeId]);

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const clearAll = () => {
    setCheckedSteps(new Set());
  };

  const hasCheckedSteps = checkedSteps.size > 0;
  const allChecked = checkedSteps.size === instructions.length;

  // Group instructions by their group_id
  const groupedInstructions = new Map<string | null, Instruction[]>();
  const groupDetails = new Map<string, { name: string; sort_order: number }>();

  // Build group details map
  instructionGroups?.forEach((group) => {
    if (group.id) {
      groupDetails.set(group.id, {
        name: group.name,
        sort_order: group.sort_order || 0,
      });
    }
  });

  // Group instructions
  instructions.forEach((instruction) => {
    const groupId = instruction.group_id || null;
    if (!groupedInstructions.has(groupId)) {
      groupedInstructions.set(groupId, []);
    }
    groupedInstructions.get(groupId)!.push(instruction);
  });

  // Sort groups by sort_order (ungrouped items go last)
  const sortedGroups = Array.from(groupedInstructions.entries()).sort(
    ([aId], [bId]) => {
      if (aId === null) return 1;
      if (bId === null) return -1;
      const aOrder = groupDetails.get(aId)?.sort_order || 0;
      const bOrder = groupDetails.get(bId)?.sort_order || 0;
      return aOrder - bOrder;
    }
  );

  // Build a flat list with group headers for rendering
  type RenderItem =
    | { type: "group-header"; name: string; key: string }
    | { type: "instruction"; instruction: Instruction; globalIndex: number };

  const renderItems: RenderItem[] = [];
  let globalIndex = 0;

  sortedGroups.forEach(([groupId, groupInstructions]) => {
    const groupName = groupId ? groupDetails.get(groupId)?.name : null;

    if (groupName) {
      renderItems.push({
        type: "group-header",
        name: groupName,
        key: `group-${groupId}`,
      });
    }

    groupInstructions.forEach((instruction) => {
      renderItems.push({
        type: "instruction",
        instruction,
        globalIndex,
      });
      globalIndex++;
    });
  });

  return (
    <Card className="overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Gör så här</h2>
        <div className="flex items-center gap-3">
          {hasCheckedSteps && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Börja om
            </button>
          )}
          {isMobile && (
            <button
              onClick={() => setWakeLockEnabled((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                wakeLockEnabled
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={
                wakeLockEnabled
                  ? "Stäng av håll skärmen vaken"
                  : "Håll skärmen vaken"
              }
              title={
                wakeLockEnabled ? "Skärmen hålls vaken" : "Håll skärmen vaken"
              }
            >
              <Smartphone className="h-3.5 w-3.5" />
              {wakeLockEnabled ? "Skärm vaken" : "Håll vaken"}
            </button>
          )}
        </div>
      </div>

      <div className="relative p-5">
        {/* Vertical line connecting steps */}
        <div className="absolute bottom-9 left-10 top-9 w-px bg-linear-to-b from-primary/20 via-primary/10 to-transparent" aria-hidden="true" />

        <ol className="relative space-y-0">
          {renderItems.map((item) => {
            if (item.type === "group-header") {
              return (
                <li key={item.key} className="relative pb-4 pt-2 first:pt-0">
                  <div className="ml-14 text-xs font-semibold uppercase tracking-wider text-primary">
                    {item.name}
                  </div>
                </li>
              );
            }

            const { instruction, globalIndex: index } = item;
            const isChecked = checkedSteps.has(index);
            const matched = instruction.matched_ingredients;

            return (
              <li
                key={instruction.id || index}
                className="relative flex cursor-pointer gap-5 pb-6 last:pb-0"
                onClick={() => toggleStep(index)}
              >
                {/* Step number with checkbox */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-card text-sm font-bold shadow-sm transition-all",
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/20 text-primary"
                  )}
                >
                  {isChecked ? (
                    <Checkbox
                      checked={true}
                      className="h-5 w-5 border-0 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:text-primary-foreground"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleStep(index)}
                    />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 pt-2">
                  <p
                    className={cn(
                      "leading-relaxed transition-colors",
                      isChecked ? "text-muted-foreground/50" : "text-foreground"
                    )}
                  >
                    {instruction.step}
                  </p>
                  {matched && matched.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {matched.map((ing) => (
                        <Badge
                          key={ing.id}
                          variant="outline"
                          className={cn(
                            "px-2 py-0 text-[11px] font-medium",
                            isChecked
                              ? "border-border/30 text-muted-foreground/40"
                              : "border-primary/30 text-primary/70"
                          )}
                        >
                          {[ing.quantity, ing.measurement, ing.name]
                            .filter(Boolean)
                            .join(" ")}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {allChecked && instructions.length > 0 && (
        <div className="border-t border-border/50 bg-secondary/10 px-5 py-4 text-center space-y-3">
          <p className="text-sm font-medium text-secondary">
            Alla steg är klara! Smaklig måltid! 🎉
          </p>
          <MarkAsCookedButton recipe={recipe} />
        </div>
      )}
    </Card>
  );
}
