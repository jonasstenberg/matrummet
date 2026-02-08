"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "@/lib/icons";
import type { ShoppingListSelectorProps } from "./types";

export function ShoppingListSelector({
  lists,
  selectedListId,
  onSelectedListChange,
  isLoading,
  newListName,
  onNewListNameChange,
  onCreateList,
  isCreating,
}: ShoppingListSelectorProps) {
  return (
    <div className="shrink-0 space-y-3 py-4 rounded-lg bg-muted/30">
      <label className="text-sm font-medium">Välj inköpslista</label>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Laddar listor...</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <Select value={selectedListId} onValueChange={onSelectedListChange}>
            <SelectTrigger className="flex-1 bg-background">
              <SelectValue placeholder="Välj lista" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name}
                  {list.is_default && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (standard)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Ny lista..."
            value={newListName}
            onChange={(e) => onNewListNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCreateList();
              }
            }}
            className="w-24 sm:w-28 bg-background"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onCreateList}
            disabled={!newListName.trim() || isCreating}
            aria-label="Skapa ny lista"
            className="shrink-0 bg-background"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
