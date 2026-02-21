
import { UtensilsCrossed } from "@/lib/icons";

export function PlaceholderImage() {
  return (
    <div className="absolute inset-0 bg-linear-to-br from-muted via-muted/80 to-muted/60">
      <div className="absolute inset-0 bg-dots-lg opacity-20" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-card/60 p-6 shadow-sm backdrop-blur-sm">
          <UtensilsCrossed
            className="h-12 w-12 text-primary/40"
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
}
