
import { Slider } from "@/components/ui/slider";
import { RotateCcw } from "@/lib/icons";
import type { RecipeServingsScalerProps } from "./types";

export function RecipeServingsScaler({
  servings,
  originalServings,
  maxServings,
  yieldName,
  onServingsChange,
}: RecipeServingsScalerProps) {
  const isModified = servings !== originalServings;

  return (
    <div className="shrink-0 space-y-3 py-4">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-foreground">
          {servings} {yieldName || "portioner"}
        </span>
        {isModified && (
          <button
            onClick={() => onServingsChange(originalServings)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Återställ till originalportioner"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Återställ ({originalServings})</span>
          </button>
        )}
      </div>
      <Slider
        value={[servings]}
        onValueChange={(values) => onServingsChange(values[0])}
        min={1}
        max={maxServings}
        step={1}
        aria-label="Antal portioner"
      />
    </div>
  );
}
