"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Sparkles, Loader2, CheckCircle, Plus, Minus, AlertCircle, ChevronDown, ChevronRight } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { CreditTransaction } from '@/lib/credits-actions'

const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, price: 29, label: "10 smarta importer" },
  { id: "pack_25", credits: 25, price: 59, label: "25 smarta importer", popular: true },
]

function transactionTypeLabel(type: string): string {
  switch (type) {
    case "signup_bonus":
      return "Välkomstbonus"
    case "purchase":
      return "Köp"
    case "admin_grant":
      return "Beviljat"
    case "ai_generation":
      return "Smart import"
    case "refund":
      return "Återbetalning"
    default:
      return type
  }
}

function transactionTypeIcon(type: string) {
  switch (type) {
    case "signup_bonus":
      return Sparkles
    case "purchase":
      return Plus
    case "ai_generation":
      return Minus
    default:
      return type === "refund" ? Plus : Plus
  }
}

interface CreditsDashboardProps {
  initialBalance: number
  initialTransactions: CreditTransaction[]
  error?: string
}

export function CreditsDashboard({ initialBalance, initialTransactions, error }: CreditsDashboardProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)

  const showSuccess = searchParams.get("status") === "success"

  useEffect(() => {
    if (showSuccess) {
      router.refresh()
    }
  }, [showSuccess, router])

  async function handlePurchase(packId: string) {
    setPurchaseLoading(packId)
    setPurchaseError(null)
    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        }
      } else {
        setPurchaseError("Kunde inte starta köpet. Försök igen.")
      }
    } catch {
      setPurchaseError("Ett fel uppstod. Försök igen.")
    } finally {
      setPurchaseLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 px-5 py-3.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {purchaseError && (
        <div className="flex items-center gap-3 rounded-2xl bg-destructive/10 px-5 py-3.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{purchaseError}</span>
        </div>
      )}

      {showSuccess && (
        <div className="flex items-center gap-3 rounded-2xl bg-green-500/10 px-5 py-3.5 text-sm text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Köpet genomfördes! Dina smarta importer har lagts till.</span>
        </div>
      )}

      {/* Balance + Purchase card */}
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        {/* Balance row */}
        <div className="flex items-center gap-4 px-5 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/20">
            <Sparkles className="h-5 w-5 text-warm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">Tillgängliga</p>
            <p className="text-2xl font-bold tracking-tight">{initialBalance}</p>
          </div>
        </div>

        {/* Purchase options */}
        <div className="border-t border-border/60">
          <div className="px-5 pt-3.5 pb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Köp fler</span>
          </div>
          <div className="divide-y divide-border/60">
            {CREDIT_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => handlePurchase(pack.id)}
                disabled={purchaseLoading !== null}
                className="group flex w-full items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30 disabled:opacity-60"
              >
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  "bg-primary/10 text-primary"
                )}>
                  <Plus className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[15px] font-medium">{pack.label}</p>
                  {pack.popular && (
                    <p className="text-xs text-primary font-medium">Populärast</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {purchaseLoading === pack.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <span className="text-[15px] font-semibold">{pack.price} kr</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction history — collapsible card */}
      {initialTransactions.length > 0 && (
        <div className="rounded-2xl bg-card shadow-(--shadow-card)">
          <button
            type="button"
            onClick={() => setHistoryCollapsed((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30"
          >
            <span className="font-medium">Historik</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                historyCollapsed && '-rotate-90'
              )}
            />
          </button>

          {!historyCollapsed && (
            <div className="border-t border-border/40 divide-y divide-border/60">
              {initialTransactions.map((tx) => {
                const Icon = transactionTypeIcon(tx.transaction_type)
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
                  >
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                      tx.amount > 0
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-medium">
                        {transactionTypeLabel(tx.transaction_type)}
                      </p>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {tx.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn(
                        "text-[15px] font-medium tabular-nums",
                        tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                      )}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
