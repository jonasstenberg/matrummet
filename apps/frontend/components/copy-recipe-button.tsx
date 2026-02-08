"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { copyRecipe } from "@/lib/actions";

interface CopyRecipeButtonProps {
  recipeId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CopyRecipeButton({
  recipeId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CopyRecipeButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [internalOpen, setInternalOpen] = useState(false);
  const isDialogOpen = controlledOpen ?? internalOpen;
  const setIsDialogOpen = controlledOnOpenChange ?? setInternalOpen;
  const isControlled = controlledOpen !== undefined;

  function handleCopy() {
    setError(null);

    startTransition(async () => {
      const result = await copyRecipe(recipeId);

      if ("error" in result) {
        setError(result.error);
        return;
      }

      // Success - redirect to edit page for the new recipe
      router.push(`/recept/${result.newRecipeId}/redigera`);
    });
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" aria-label="Kopiera recept">
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Kopiera</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kopiera recept</DialogTitle>
          <DialogDescription>
            Detta skapar en kopia av receptet i din samling som du kan redigera.
            Originalreceptet påverkas inte.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsDialogOpen(false)}
            disabled={isPending}
          >
            Avbryt
          </Button>
          <Button onClick={handleCopy} disabled={isPending}>
            {isPending ? "Kopierar..." : "Kopiera recept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
