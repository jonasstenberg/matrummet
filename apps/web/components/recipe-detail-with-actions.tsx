import { AddToShoppingListButton } from "@/components/add-to-shopping-list-button";
import { useAuth } from "@/components/auth-provider";
import { CopyRecipeButton } from "@/components/copy-recipe-button";
import { LikeButton } from "@/components/like-button";
import { MarkAsCookedButton } from "@/components/mark-as-cooked-button";
import { RecipeDetail } from "@/components/recipe-detail";
import { ShareRecipeDialog } from "@/components/share-recipe-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteRecipe } from "@/lib/actions";
import { Copy, EllipsisVertical, Pencil, Share2, Trash2 } from "@/lib/icons";
import { Recipe } from "@/lib/types";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";

interface RecipeDetailWithActionsProps {
  recipe: Recipe;
}

export function RecipeDetailWithActions({
  recipe,
}: RecipeDetailWithActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const isOwner = recipe.is_owner ?? false;
  const isLoggedIn = !!user;
  // Can copy if logged in and not the owner (household member's recipe)
  const canCopy = isLoggedIn && !isOwner;

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteRecipe(recipe.id);

      if (result && typeof result === 'object' && "error" in result) {
        setDeleteError(result.error);
        setIsDeleting(false);
        return;
      }

      // Redirect to home page after successful deletion
      await router.invalidate();
      router.navigate({ to: "/" });
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Ett oväntat fel uppstod",
      );
      setIsDeleting(false);
    }
  }

  // Like button for image overlay (only for logged-in non-owners)
  const likeButton =
    isLoggedIn && !isOwner ? (
      <LikeButton
        recipeId={recipe.id}
        initialLiked={recipe.is_liked ?? false}
        isOwner={false}
        className="h-10 w-10 rounded-full bg-white/90 shadow-md backdrop-blur-sm hover:bg-white"
      />
    ) : null;

  return (
    <div className="space-y-6">
      {/* Actions */}
      {isLoggedIn && (
        <div className="flex items-center justify-end gap-2">
          <AddToShoppingListButton recipe={recipe} />
          <MarkAsCookedButton recipe={recipe} />

          {(canCopy || isOwner) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fler alternativ"
                >
                  <EllipsisVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner && (
                  <DropdownMenuItem onSelect={() => setShareDialogOpen(true)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Dela
                  </DropdownMenuItem>
                )}
                {canCopy && (
                  <DropdownMenuItem onSelect={() => setCopyDialogOpen(true)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Kopiera
                  </DropdownMenuItem>
                )}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/recept/$id/redigera" params={{ id: recipe.id }}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Redigera
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setIsDialogOpen(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Ta bort
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Dialogs rendered outside dropdown */}
      {isOwner && (
        <ShareRecipeDialog
          recipeId={recipe.id}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}
      {canCopy && (
        <CopyRecipeButton
          recipeId={recipe.id}
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
        />
      )}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ta bort recept</DialogTitle>
            <DialogDescription>
              Vill du verkligen ta bort detta recept? Denna åtgard kan inte
              ångras.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isDeleting}
            >
              Avbryt
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Tar bort..." : "Ta bort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe Detail */}
      <RecipeDetail recipe={recipe} actionButton={likeButton} />
    </div>
  );
}
