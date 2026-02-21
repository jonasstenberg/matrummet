
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIngredientEditor } from "./context";

interface GroupHeaderProps {
  groupId: string;
  name: string;
}

export function GroupHeader({ groupId, name }: GroupHeaderProps) {
  const {
    moveGroup,
    isFirstGroup,
    isLastGroup,
    addIngredient,
    removeGroup,
    updateGroupName,
  } = useIngredientEditor();

  return (
    <div className="group flex items-center gap-2 rounded-lg bg-muted/50 p-3">
      <div className="flex-1">
        <Input
          placeholder="Gruppnamn (t.ex. 'Sås', 'Pasta')"
          value={name}
          onChange={(e) => updateGroupName(groupId, e.target.value)}
          className="bg-background font-semibold"
        />
      </div>
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => moveGroup(groupId, "up")}
          disabled={isFirstGroup(groupId)}
          className="h-8 w-8"
          aria-label="Flytta grupp upp"
        >
          ↑
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => moveGroup(groupId, "down")}
          disabled={isLastGroup(groupId)}
          className="h-8 w-8"
          aria-label="Flytta grupp ner"
        >
          ↓
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => addIngredient(groupId)}
        className="text-xs"
      >
        + Ingrediens
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => removeGroup(groupId)}
        className="h-8 w-8 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
        aria-label="Ta bort grupp"
      >
        ×
      </Button>
    </div>
  );
}
