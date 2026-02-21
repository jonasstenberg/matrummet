import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/offline')({
  head: () => ({
    meta: [
      { title: 'Offline' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: OfflinePage,
})

function OfflinePage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center' as const,
        color: '#1f2937',
        backgroundColor: '#ffffff',
      }}
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          marginTop: '1.5rem',
          marginBottom: '0.5rem',
        }}
      >
        Du verkar vara offline
      </h1>
      <p style={{ color: '#6b7280', maxWidth: '24rem', lineHeight: 1.6 }}>
        Kontrollera din internetanslutning och försök igen. Sidor du besökt
        tidigare kan fortfarande vara tillgängliga.
      </p>
      <a
        href=""
        style={{
          display: 'inline-block',
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#16a34a',
          color: '#ffffff',
          borderRadius: '0.5rem',
          fontSize: '1rem',
          fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Försök igen
      </a>
    </div>
  )
}
