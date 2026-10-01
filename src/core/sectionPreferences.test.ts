import { describe, expect, it } from 'vitest'
import { isFavoriteId, normalizeFavoriteIds, normalizeSectionOrder } from './sectionPreferences'

describe('section preferences', () => {
  it('drops retired or unknown sections and preserves the first occurrence', () => {
    expect(normalizeSectionOrder(['denti', 'diabete', 'denti', 'analisi'], ['denti', 'analisi'])).toEqual(['denti', 'analisi'])
  })

  it('keeps valid namespaced favorites and removes duplicates in first-seen order', () => {
    expect(normalizeFavoriteIds(['section:denti', 'measurement:weight', 'section:denti'], ['denti', 'analisi'])).toEqual(['section:denti', 'measurement:weight'])
  })

  it('drops malformed, legacy and unknown measurement favorites at the persistence boundary', () => {
    expect(normalizeFavoriteIds([
      'module:hydration',
      'measurement:diabetes',
      'section:',
      'measurement:weight:extra',
      'section:body pain',
      null,
      'measurement:six_minute_walk_distance',
    ], ['denti', 'analisi'])).toEqual(['measurement:six_minute_walk_distance'])
    expect(normalizeFavoriteIds(['section:diabete', 'section:hydration', 'section:unknown'], ['denti', 'analisi'])).toEqual([])
    expect(isFavoriteId('section:denti', ['denti'])).toBe(true)
    expect(isFavoriteId('measurement:not-a-measurement')).toBe(false)
    expect(isFavoriteId('module:hydration')).toBe(false)
  })

  it('is an idempotent migration for historical persisted keys', () => {
    const legacyPayload = [
      'section:alimentazione',
      'measurement:sleep_hours',
      'section:alimentazione',
      'measurement:weight',
    ]
    const migrated = normalizeFavoriteIds(legacyPayload)

    expect(migrated).toEqual(['section:alimentazione', 'measurement:sleep_hours', 'measurement:weight'])
    expect(normalizeFavoriteIds(migrated)).toEqual(migrated)
  })
})
