
import { useState } from 'react'
import { Download } from '@/lib/icons'

export function ExportRecipes() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/user/export', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Export misslyckades')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mina-recept.md'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Kunde inte exportera recept. Försök igen.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        <button
          type="button"
          onClick={handleExport}
          disabled={isLoading}
          className="flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-[15px] text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          <span className="font-medium">
            {isLoading ? 'Exporterar...' : 'Exportera alla recept'}
          </span>
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-destructive/5 px-5 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </>
  )
}
