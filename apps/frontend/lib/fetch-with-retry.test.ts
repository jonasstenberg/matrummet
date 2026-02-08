import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from './fetch-with-retry'

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns successful response without retry', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const result = await fetchWithRetry('https://example.com')

    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on 500 error with exponential backoff', async () => {
    const mockError = new Response('error', { status: 500 })
    const mockSuccess = new Response('ok', { status: 200 })

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockError)
      .mockResolvedValueOnce(mockError)
      .mockResolvedValueOnce(mockSuccess)

    const promise = fetchWithRetry('https://example.com')

    // First retry after 1s
    await vi.advanceTimersByTimeAsync(1000)
    // Second retry after 2s
    await vi.advanceTimersByTimeAsync(2000)

    const result = await promise

    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retries on 429 rate limit', async () => {
    const mockRateLimit = new Response('rate limited', { status: 429 })
    const mockSuccess = new Response('ok', { status: 200 })

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockRateLimit)
      .mockResolvedValueOnce(mockSuccess)

    const promise = fetchWithRetry('https://example.com')

    await vi.advanceTimersByTimeAsync(1000)

    const result = await promise

    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 400 client error', async () => {
    const mockError = new Response('bad request', { status: 400 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockError)

    const result = await fetchWithRetry('https://example.com')

    expect(result.status).toBe(400)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 404 not found', async () => {
    const mockError = new Response('not found', { status: 404 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockError)

    const result = await fetchWithRetry('https://example.com')

    expect(result.status).toBe(404)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on network error', async () => {
    const networkError = new Error('Network error')
    const mockSuccess = new Response('ok', { status: 200 })

    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(mockSuccess)

    const promise = fetchWithRetry('https://example.com')

    await vi.advanceTimersByTimeAsync(1000)

    const result = await promise

    expect(result.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws after max retries exceeded', async () => {
    const networkError = new Error('Network error')

    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)

    const promise = fetchWithRetry('https://example.com')

    // Attach rejection handler immediately to avoid unhandled rejection warning
    const expectation = expect(promise).rejects.toThrow('Network error')

    // Flush all timers and microtasks to complete all retry attempts
    await vi.runAllTimersAsync()

    await expectation
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('respects custom maxRetries option', async () => {
    const mockError = new Response('error', { status: 500 })

    vi.spyOn(global, 'fetch').mockResolvedValue(mockError)

    const promise = fetchWithRetry('https://example.com', { maxRetries: 2 })

    await vi.advanceTimersByTimeAsync(1000)

    const result = await promise

    expect(result.status).toBe(500)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('passes through fetch options', async () => {
    const mockResponse = new Response('ok', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    await fetchWithRetry('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    })

    expect(fetch).toHaveBeenCalledWith('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    })
  })
})
