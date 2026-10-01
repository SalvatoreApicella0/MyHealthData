import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HYDRATION_GOALS,
  parseHydrationGoals,
  ringShare,
  serializeHydrationGoals,
  withDefaultGoals,
} from './hydrationGoals'

describe('parseHydrationGoals', () => {
  it('returns undefined without stored value', () => {
    expect(parseHydrationGoals(null)).toBeUndefined()
  })

  it('returns undefined for invalid JSON', () => {
    expect(parseHydrationGoals('not json')).toBeUndefined()
  })

  it('keeps only positive numeric fields', () => {
    const parsed = parseHydrationGoals(JSON.stringify({ waterMl: 2500, alcoholUnitsPerWeek: 0, caffeineMgPerDay: 'x' }))
    expect(parsed).toEqual({ waterMl: 2500 })
  })

  it('returns undefined when no field is valid', () => {
    expect(parseHydrationGoals(JSON.stringify({ waterMl: -1 }))).toBeUndefined()
  })
})

describe('withDefaultGoals', () => {
  it('fills every missing field with the default', () => {
    expect(withDefaultGoals(undefined)).toEqual(DEFAULT_HYDRATION_GOALS)
  })

  it('keeps provided fields and defaults the rest', () => {
    expect(withDefaultGoals({ waterMl: 3000 })).toEqual({
      waterMl: 3000,
      alcoholUnitsPerWeek: DEFAULT_HYDRATION_GOALS.alcoholUnitsPerWeek,
      caffeineMgPerDay: DEFAULT_HYDRATION_GOALS.caffeineMgPerDay,
    })
  })
})

describe('ringShare', () => {
  it('returns the ratio against a positive goal', () => {
    expect(ringShare(1000, 2000)).toBe(0.5)
  })

  it('clamps below 0 and above 1', () => {
    expect(ringShare(-5, 2000)).toBe(0)
    expect(ringShare(3000, 2000)).toBe(1)
  })

  it('returns 0 without a usable goal', () => {
    expect(ringShare(5, 0)).toBe(0)
    expect(ringShare(5, undefined)).toBe(0)
  })
})

describe('serializeHydrationGoals', () => {
  it('round-trips through parseHydrationGoals', () => {
    const goals = { waterMl: 2200, alcoholUnitsPerWeek: 8, caffeineMgPerDay: 350 }
    expect(parseHydrationGoals(serializeHydrationGoals(goals))).toEqual(goals)
  })
})
