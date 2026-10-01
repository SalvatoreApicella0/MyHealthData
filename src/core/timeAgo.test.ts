import { describe, expect, it } from 'vitest'
import { timeAgo } from './timeAgo'

const now = new Date('2026-09-14T12:00:00.000Z')
const at = (offsetMs: number) => new Date(now.getTime() - offsetMs).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const YEAR = 365 * DAY

describe('timeAgo', () => {
  it('returns "ora" under one minute', () => {
    expect(timeAgo(at(30_000), 'it', now)).toBe('ora')
  })

  it('returns minutes under one hour', () => {
    expect(timeAgo(at(5 * MINUTE), 'it', now)).toBe('5 min fa')
    expect(timeAgo(at(5 * MINUTE), 'en', now)).toBe('5 min ago')
  })

  it('returns hours under one day', () => {
    expect(timeAgo(at(3 * HOUR), 'it', now)).toBe('3 h fa')
    expect(timeAgo(at(3 * HOUR), 'en', now)).toBe('3 h ago')
  })

  it('returns days under one year', () => {
    expect(timeAgo(at(10 * DAY), 'it', now)).toBe('10 g fa')
    expect(timeAgo(at(10 * DAY), 'en', now)).toBe('10 d ago')
  })

  it('returns years plus remaining days', () => {
    expect(timeAgo(at(YEAR + 25 * DAY), 'it', now)).toBe('1 a 25 g fa')
    expect(timeAgo(at(YEAR + 25 * DAY), 'en', now)).toBe('1 y 25 d ago')
  })

  it('omits remaining days when zero', () => {
    expect(timeAgo(at(YEAR), 'it', now)).toBe('1 a fa')
    expect(timeAgo(at(YEAR), 'en', now)).toBe('1 y ago')
  })

  it('returns an empty string for invalid dates', () => {
    expect(timeAgo('not-a-date', 'it', now)).toBe('')
  })
})
