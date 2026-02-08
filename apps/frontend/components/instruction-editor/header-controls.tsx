"use client";

import { Button } from "@/components/ui/button";
import { useInstructionEditor } from "./context";

export function HeaderControls() {
  const { instructions, addInstruction, addGroup } = useInstructionEditor();

  return (
    <>
      {instructions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Inga instruktioner ännu. Klicka på knappen nedan för att lägga till.
        </p>
      )}

      <div className="flex gap-2 pt-2">
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
        >
          Lägg till grupp
        </Button>
      </div>
    </>
  );
}
