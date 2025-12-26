"use client";

import { useAuth } from "@/components/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema, loginInputSchema } from "@/lib/schemas";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_error: "Google-inloggning misslyckades",
        no_code: "Ingen auktoriseringskod mottogs",
        config_error: "Google-inloggning är inte konfigurerad",
        token_error: "Kunde inte verifiera med Google",
        userinfo_error: "Kunde inte hämta användarinfo från Google",
        signup_error: "Kunde inte skapa konto",
        unknown_error: "Ett okänt fel uppstod",
      };
      setError(errorMessages[errorParam] || "Ett fel uppstod");
    }

    // Open forgot password dialog if requested via query param
    const forgotParam = searchParams.get("forgot");
    if (forgotParam === "true") {
      setForgotPasswordOpen(true);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate with Zod
      const result = loginInputSchema.safeParse({ email, password });

      if (!result.success) {
        const firstError = result.error.issues[0];
        setError(firstError.message);
        setIsLoading(false);
        return;
      }

      await login(result.data.email, result.data.password);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ett fel uppstod");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResetError(null);

    // Validate email with Zod
    const result = emailSchema.safeParse({ email: resetEmail });

    if (!result.success) {
      const firstError = result.error.issues[0];
      setResetError(firstError.message);
      return;
    }

    setResetLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: result.data.email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ett fel uppstod");
      }

      setResetSuccess(true);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Ett fel uppstod");
    } finally {
      setResetLoading(false);
    }
  }

  function handleForgotPasswordClose() {
    setForgotPasswordOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setResetEmail("");
      setResetSuccess(false);
      setResetError(null);
    }, 200);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="login-email">E-post</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="din@epost.se"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Lösenord</Label>
            <button
              type="button"
              className="text-sm text-primary hover:underline font-medium"
              onClick={() => setForgotPasswordOpen(true)}
            >
              Glömt lösenord?
            </button>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Loggar in..." : "Logga in"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Eller fortsätt med
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isLoading}
          onClick={() => {
            window.location.href = "/api/auth/google";
          }}
        >
          <GoogleIcon />
          <span className="ml-2">Google</span>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Har du inget konto?{" "}
          <Link
            href="/registrera"
            className="text-primary hover:underline font-medium"
          >
            Registrera dig
          </Link>
        </p>
      </form>

      <Dialog
        open={forgotPasswordOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleForgotPasswordClose();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Återställ lösenord</DialogTitle>
            <DialogDescription>
              Ange din e-postadress så skickar vi en länk för att återställa
              ditt lösenord.
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Om ett konto finns med denna e-postadress kommer du att få
                  ett e-postmeddelande med instruktioner för att återställa
                  ditt lösenord.
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                className="w-full"
                onClick={handleForgotPasswordClose}
              >
                Stäng
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleForgotPassword}
              className="space-y-4"
              autoComplete="off"
            >
              {resetError && (
                <Alert variant="destructive">
                  <AlertDescription>{resetError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="reset-email">E-post</Label>
                <Input
                  id="reset-email"
                  name="reset-email"
                  type="email"
                  autoComplete="off"
                  placeholder="din@epost.se"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetLoading}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleForgotPasswordClose}
                  disabled={resetLoading}
                >
                  Avbryt
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={resetLoading || !resetEmail}
                >
                  {resetLoading ? "Skickar..." : "Skicka"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
