import { describe, expect, it } from 'vitest'
import { sortCanonicalRecords } from './canonicalOrdering'

describe('canonical record ordering', () => {
  it('sorts known domains by their canonical date and then by id', () => {
    const records = [
      { id: 'b', scheduledAt: '2026-10-02T08:30:00.000Z' },
      { id: 'a', scheduledAt: '2026-10-02T08:30:00.000Z' },
      { id: 'c', scheduledAt: '2026-09-01T08:30:00.000Z' },
    ]

    expect(sortCanonicalRecords('appointments', records).map((record) => record.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps undated records deterministic and does not mutate the source', () => {
    const records = [{ id: 'z' }, { id: 'a' }]

    expect(sortCanonicalRecords('foodRecipes', records).map((record) => record.id)).toEqual(['a', 'z'])
    expect(records.map((record) => record.id)).toEqual(['z', 'a'])
  })
})
