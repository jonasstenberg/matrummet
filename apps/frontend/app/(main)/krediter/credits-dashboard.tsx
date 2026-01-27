"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sparkles, Loader2, CheckCircle, Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CreditTransaction {
  id: string
  amount: number
  balance_after: number
  transaction_type: string
  description: string | null
  created_at: string
}

const CREDIT_PACKS = [
  { id: "pack_10", credits: 10, price: 29, label: "10 genereringar" },
  { id: "pack_25", credits: 25, price: 59, label: "25 genereringar" },
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
      return "AI-generering"
    case "refund":
      return "Återbetalning"
    default:
      return type
  }
}

export function CreditsDashboard() {
  const searchParams = useSearchParams()
  const [balance, setBalance] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)

  const showSuccess = searchParams.get("status") === "success"

  useEffect(() => {
    async function fetchData() {
      try {
        const [balanceRes, historyRes] = await Promise.all([
          fetch("/api/credits/balance"),
          fetch("/api/credits/history"),
        ])

        if (balanceRes.ok) {
          const data = await balanceRes.json()
          setBalance(data.balance)
        }

        if (historyRes.ok) {
          const data = await historyRes.json()
          setTransactions(data.transactions)
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  async function handlePurchase(packId: string) {
    setPurchaseLoading(packId)
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
      }
    } catch {
      // Silently fail
    } finally {
      setPurchaseLoading(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {showSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Köpet genomfördes! Dina krediter har lagts till.
          </AlertDescription>
        </Alert>
      )}

      {/* Balance display */}
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/20">
            <Sparkles className="h-7 w-7 text-warm" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">AI-genereringar kvar</p>
            <p className="text-4xl font-bold">{balance ?? 0}</p>
          </div>
        </div>
      </Card>

      {/* Purchase packs */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Köp fler genereringar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id} className="p-5">
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">{pack.label}</h3>
                  <p className="text-2xl font-bold">{pack.price} kr</p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => handlePurchase(pack.id)}
                  disabled={purchaseLoading !== null}
                >
                  {purchaseLoading === pack.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Laddar...
                    </>
                  ) : (
                    "Köp"
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Historik</h2>
          <Card>
            <div className="divide-y">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      tx.amount > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"
                    )}>
                      {tx.amount > 0 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {transactionTypeLabel(tx.transaction_type)}
                      </p>
                      {tx.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {tx.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-medium",
                      tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString("sv-SE")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
