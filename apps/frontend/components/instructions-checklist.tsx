"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface Instruction {
  id?: string;
  step: string;
}

interface InstructionsChecklistProps {
  recipeId: string;
  instructions: Instruction[];
}

export function InstructionsChecklist({
  recipeId,
  instructions,
}: InstructionsChecklistProps) {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

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

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_12px_-2px_rgba(139,90,60,0.1)]">
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">Gör så här</h2>
        {hasCheckedSteps && (
          <button
            onClick={clearAll}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Börja om
          </button>
        )}
      </div>

      <ol className="relative space-y-0 p-5">
        {/* Vertical line connecting steps */}
        <div className="absolute bottom-9 left-10 top-9 w-px bg-linear-to-b from-primary/20 via-primary/10 to-transparent" />

        {instructions.map((instruction, index) => {
          const isChecked = checkedSteps.has(index);

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
              </div>
            </li>
          );
        })}
      </ol>

      {allChecked && instructions.length > 0 && (
        <div className="border-t border-border/50 bg-secondary/10 px-5 py-4 text-center">
          <p className="text-sm font-medium text-secondary">
            Alla steg är klara! Smaklig måltid! 🎉
          </p>
        </div>
      )}
    </div>
  );
}
