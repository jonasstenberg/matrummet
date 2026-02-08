import { describe, it, expect } from 'vitest'
import { parseContentRange } from '../api'

describe('parseContentRange', () => {
  it('parses standard range format "0-11/150"', () => {
    expect(parseContentRange('0-11/150')).toBe(150)
  })

  it('parses range format with larger numbers', () => {
    expect(parseContentRange('0-99/1234')).toBe(1234)
  })

  it('parses offset range format "24-47/150"', () => {
    expect(parseContentRange('24-47/150')).toBe(150)
  })

  it('parses single item range "0-0/1"', () => {
    expect(parseContentRange('0-0/1')).toBe(1)
  })

  it('parses unknown range format "*/150"', () => {
    // PostgREST uses */total when the range is unknown but total is known
    expect(parseContentRange('*/150')).toBe(150)
  })

  it('returns 0 for null header', () => {
    expect(parseContentRange(null)).toBe(0)
  })

  it('returns 0 for empty string', () => {
    expect(parseContentRange('')).toBe(0)
  })

  it('returns 0 for malformed header without slash', () => {
    expect(parseContentRange('0-11')).toBe(0)
  })

  it('returns 0 for malformed header with non-numeric total', () => {
    expect(parseContentRange('0-11/abc')).toBe(0)
  })

  it('handles edge case of zero total', () => {
    expect(parseContentRange('*/0')).toBe(0)
  })

  it('returns 0 when both range and count are unknown "*/*"', () => {
    expect(parseContentRange('*/*')).toBe(0)
  })
})
