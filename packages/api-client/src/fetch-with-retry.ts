const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number
}

/**
 * Fetch wrapper with exponential backoff retry logic.
 *
 * Retries on:
 * - Network errors (fetch throws)
 * - Rate limiting (429)
 * - Server errors (500+)
 *
 * Does NOT retry on:
 * - Client errors (400-499 except 429)
 * - Successful responses (any 2xx/3xx)
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { maxRetries = 3, ...fetchOptions } = options

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, fetchOptions)

      // Retry on rate limit or server errors
      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries - 1) {
          await delay(Math.pow(2, attempt) * 1000) // 1s, 2s, 4s
          continue
        }
      }

      return res
    } catch (error) {
      // Network error - retry unless last attempt
      if (attempt === maxRetries - 1) throw error
      await delay(Math.pow(2, attempt) * 1000)
    }
  }

  throw new Error('Max retries exceeded')
}
