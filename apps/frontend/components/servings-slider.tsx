"use client";

import { Slider } from "@/components/ui/slider";
import { RotateCcw } from "lucide-react";

interface ServingsSliderProps {
  originalServings: number;
  servingsName?: string;
  value: number;
  onChange: (value: number) => void;
}

export function ServingsSlider({
  originalServings,
  servingsName = "portioner",
  value,
  onChange,
}: ServingsSliderProps) {
  const isModified = value !== originalServings;
  const maxServings = Math.max(originalServings * 3, 12);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {value} {servingsName}
        </span>
        {isModified && (
          <button
            onClick={() => onChange(originalServings)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Återställ till originalportioner"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Återställ ({originalServings})</span>
          </button>
        )}
      </div>
      <Slider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={1}
        max={maxServings}
        step={1}
        aria-label="Antal portioner"
      />
    </div>
  );
}
