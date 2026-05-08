import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieMocks = vi.hoisted(() => {
  const cookies = new Map<string, string>()
  return {
    cookies,
    getCookie: vi.fn((name: string) => cookies.get(name)),
    setCookie: vi.fn(),
  }
})

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: cookieMocks.getCookie,
  setCookie: cookieMocks.setCookie,
}))

describe('getSession', () => {
  beforeEach(() => {
    process.env.POSTGREST_URL = 'http://postgrest.test'
    process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars'
    process.env.POSTGREST_JWT_SECRET = 'test-postgrest-secret-at-least-32-chars'

    cookieMocks.cookies.clear()
    cookieMocks.getCookie.mockClear()
    cookieMocks.setCookie.mockClear()
    vi.restoreAllMocks()
  })

  it('does not clear cookies when refresh rotation returns no session', async () => {
    cookieMocks.cookies.set('refresh-token', 'stale-refresh-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const { getSession } = await import('./auth')

    await expect(getSession()).resolves.toBeNull()
    expect(cookieMocks.setCookie).not.toHaveBeenCalled()
  })
})
