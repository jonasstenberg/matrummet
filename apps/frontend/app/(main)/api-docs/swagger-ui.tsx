'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import 'swagger-ui-react/swagger-ui.css'

const SwaggerUIReact = dynamic(() => import('swagger-ui-react'), { ssr: false })

interface SwaggerUIProps {
  token?: string
}

export function SwaggerUI({ token }: SwaggerUIProps) {
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/openapi')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then(setSpec)
      .catch((err) => setError(err.message))
  }, [])

  const requestInterceptor = useCallback(
    (req: Record<string, unknown>) => {
      if (token) {
        const headers = (req.headers ?? {}) as Record<string, string>
        headers.Authorization = `Bearer ${token}`
        req.headers = headers
      }
      return req
    },
    [token]
  )

  if (error) {
    return <p className="text-destructive">Kunde inte ladda API-specifikationen: {error}</p>
  }

  if (!spec) {
    return <p className="text-muted-foreground">Laddar...</p>
  }

  return (
    <div className="[&_.swagger-ui_.info]:hidden [&_.swagger-ui_.scheme-container]:hidden">
      <SwaggerUIReact spec={spec} requestInterceptor={requestInterceptor} />
    </div>
  )
}
