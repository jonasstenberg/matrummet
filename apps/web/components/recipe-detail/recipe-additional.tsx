
interface RecipeAdditionalProps {
  cuisine: string;
}

export function RecipeAdditional({ cuisine }: RecipeAdditionalProps) {
  return (
    <div className="rounded-xl bg-card p-5 shadow-(--shadow-card)">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Kök
      </h3>
      <p className="mt-1 text-foreground">{cuisine}</p>
    </div>
  );
}
