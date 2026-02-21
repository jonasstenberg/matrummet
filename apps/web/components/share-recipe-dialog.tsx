
import { useState, useTransition, useEffect } from "react";
import { Share2, Copy, Check, RefreshCw, Loader2 } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createShareLink, revokeShareLink } from "@/lib/recipe-actions";

interface ShareRecipeDialogProps {
  recipeId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ShareRecipeDialog({
  recipeId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: ShareRecipeDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isDialogOpen = controlledOpen ?? internalOpen;
  const setIsDialogOpen = controlledOnOpenChange ?? setInternalOpen;
  const isControlled = controlledOpen !== undefined;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Automatically create share link when dialog opens
  useEffect(() => {
    if (!isDialogOpen) return;
    if (shareUrl) return; // Already have a link

    let cancelled = false;

    async function getOrCreateLink() {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);

      const result = await createShareLink(recipeId);
      if (cancelled) return;

      setIsLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      setShareUrl(result.url);
      setShareToken(result.token);
    }

    getOrCreateLink();

    return () => {
      cancelled = true;
    };
  }, [isDialogOpen, recipeId, shareUrl]);

  function handleCopyLink() {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCreateNewLink() {
    if (!shareToken) return;

    startTransition(async () => {
      // Revoke old link
      const revokeResult = await revokeShareLink(shareToken);
      if ("error" in revokeResult) {
        setError(revokeResult.error);
        return;
      }

      // Create new link
      const createResult = await createShareLink(recipeId);
      if ("error" in createResult) {
        setError(createResult.error);
        return;
      }

      setShareUrl(createResult.url);
      setShareToken(createResult.token);
    });
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" aria-label="Dela recept">
            <Share2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Dela</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dela recept</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : shareUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="flex-1 text-sm" />
                <Button
                  size="icon"
                  variant={copied ? "default" : "outline"}
                  onClick={handleCopyLink}
                  className={copied ? "bg-green-600 hover:bg-green-600" : ""}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Alla med länken kan se receptet.
              </p>
              <div className="pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateNewLink}
                  disabled={isPending}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Skapa ny länk
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Den gamla länken slutar fungera.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
