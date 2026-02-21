
import { AsyncAutocompleteInput } from "@/components/ui/async-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "@/lib/icons";
import { useIngredientEditor } from "./context";
import type { Ingredient } from "./types";

interface IngredientRowProps {
  index: number;
  ingredient: Ingredient;
  isInGroup: boolean;
}

export function IngredientRow({
  index,
  ingredient,
  isInGroup,
}: IngredientRowProps) {
  const {
    ingredients,
    lowConfidenceIndices,
    updateIngredient,
    moveIngredient,
    removeIngredient,
  } = useIngredientEditor();

  const hasLowConfidence = lowConfidenceIndices.includes(index);

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex gap-2 rounded-lg p-3",
          isInGroup && "ml-4 bg-muted/30"
        )}
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <AsyncAutocompleteInput
              placeholder="Namn"
              fetchUrl="/api/foods"
              value={ingredient.name}
              onChange={(value) => updateIngredient(index, "name", value)}
              className={cn(isInGroup && "bg-background")}
            />
          </div>
          <div className="w-full sm:w-24">
            <Input
              placeholder="Mängd"
              value={ingredient.quantity}
              onChange={(e) =>
                updateIngredient(index, "quantity", e.target.value)
              }
              className={cn(isInGroup && "bg-background")}
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
              className={cn(isInGroup && "bg-background")}
            />
          </div>
          <div className="w-full sm:w-28">
            <Input
              placeholder="Form"
              value={ingredient.form || ""}
              onChange={(e) => updateIngredient(index, "form", e.target.value)}
              className={cn(isInGroup && "bg-background")}
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
}
