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

  it('returns the session and sets both cookies on successful rotation', async () => {
    cookieMocks.cookies.set('refresh-token', 'valid-refresh-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            token_id: 'b3b9c1c0-0000-4000-8000-000000000000',
            user_email: 'user@example.com',
            user_name: 'User',
            user_role: 'user',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { getSession } = await import('./auth')

    await expect(getSession()).resolves.toEqual({
      email: 'user@example.com',
      name: 'User',
      role: 'user',
    })
    const cookieNames = cookieMocks.setCookie.mock.calls.map(call => call[0])
    expect(cookieNames).toContain('auth-token')
    expect(cookieNames).toContain('refresh-token')
  })

  it('returns the session and sets only the access cookie on grace-window reuse', async () => {
    // A concurrent request already rotated this refresh token (token_id is
    // null). The session must still resolve so the page renders logged in,
    // but the winner's refresh cookie must not be overwritten.
    cookieMocks.cookies.set('refresh-token', 'just-rotated-refresh-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            token_id: null,
            user_email: 'user@example.com',
            user_name: 'User',
            user_role: 'user',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const { getSession } = await import('./auth')

    await expect(getSession()).resolves.toEqual({
      email: 'user@example.com',
      name: 'User',
      role: 'user',
    })
    const cookieNames = cookieMocks.setCookie.mock.calls.map(call => call[0])
    expect(cookieNames).toEqual(['auth-token'])
  })
})
