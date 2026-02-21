
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useInstructionEditor } from "./context";
import type { Instruction } from "./types";

interface InstructionRowProps {
  index: number;
  instruction: Instruction;
  isInGroup: boolean;
}

export function InstructionRow({
  index,
  instruction,
  isInGroup,
}: InstructionRowProps) {
  const {
    instructions,
    updateInstruction,
    moveInstruction,
    removeInstruction,
  } = useInstructionEditor();

  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg p-3",
        isInGroup && "ml-4 bg-muted/30"
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-1.5">
        {index + 1}
      </div>

      <div className="flex-1">
        <Textarea
          placeholder="Beskriv steget..."
          value={instruction.step}
          onChange={(e) => updateInstruction(index, e.target.value)}
          className={cn("min-h-[80px]", isInGroup && "bg-background")}
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
}
