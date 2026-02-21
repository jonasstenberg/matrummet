/**
 * Parse ISO 8601 duration strings to minutes
 * Handles formats like: PT30M, PT1H30M, P1DT2H30M
 */
export function parseDuration(duration: unknown): number | null {
  if (!duration || typeof duration !== "string") return null

  // ISO 8601 duration pattern
  const pattern = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
  const match = duration.match(pattern)

  if (!match) return null

  const [, days, hours, minutes, seconds] = match.map((v) => (v ? parseInt(v, 10) : 0))

  // Convert everything to minutes
  return (days || 0) * 24 * 60 + (hours || 0) * 60 + (minutes || 0) + Math.ceil((seconds || 0) / 60)
}
