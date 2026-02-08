"use client";

import { Button } from "@/components/ui/button";
import { useIngredientEditor } from "./context";

export function HeaderControls() {
  const { ingredients, addIngredient, addGroup } = useIngredientEditor();

  return (
    <>
      {ingredients.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Inga ingredienser ännu. Klicka på knappen nedan för att lägga till.
        </p>
      )}

      <div className="flex gap-2 pt-2">
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
        >
          Lägg till grupp
        </Button>
      </div>
    </>
  );
}
