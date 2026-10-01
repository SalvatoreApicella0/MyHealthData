import { describe, expect, it } from 'vitest'
import { sortCanonicalRecords, sortEventsByOccurredAt } from './dataScrollModel'

describe('data scroll canonical sorting', () => {
  it('sorts records newest first without mutating the snapshot array', () => {
    const records = [
      { id: 'old', scheduledAt: '2026-01-01T10:00:00Z' },
      { id: 'new', scheduledAt: '2026-09-01T10:00:00Z' },
    ]

    expect(sortCanonicalRecords(records, 'scheduledAt').map((record) => record.id)).toEqual(['new', 'old'])
    expect(records.map((record) => record.id)).toEqual(['old', 'new'])
  })

  it('shows the newest event previews first without mutating the snapshot array', () => {
    const events = [
      { id: 'old', occurredAt: '2026-01-01T10:00:00Z' },
      { id: 'new', occurredAt: '2026-09-01T10:00:00Z' },
    ]

    expect(sortEventsByOccurredAt(events).map((event) => event.id)).toEqual(['new', 'old'])
    expect(events.map((event) => event.id)).toEqual(['old', 'new'])
  })
})
