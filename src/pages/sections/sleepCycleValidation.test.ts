import { describe, expect, it } from 'vitest'
import { validateCycleSettings } from './CycleSection'
import { validateSleepEntry } from './SleepSection'

describe('sleep and cycle form validation', () => {
  it('rejects invalid sleep quality and awakenings before saving', () => {
    expect(validateSleepEntry('2026-09-20T22:00', '2026-09-21T07:00', '6', '0')).toBe('quality')
    expect(validateSleepEntry('2026-09-20T22:00', '2026-09-21T07:00', '5', '-1')).toBe('awakenings')
    expect(validateSleepEntry('2026-09-20T22:00', '2026-09-21T07:00', '5', '2')).toBeUndefined()
  })

  it('keeps cycle settings within plausible integer ranges', () => {
    expect(validateCycleSettings('2', '2')).toBe('cycle')
    expect(validateCycleSettings('28', '16')).toBe('period')
    expect(validateCycleSettings('3', '1')).toBeUndefined()
    expect(validateCycleSettings('28', '5')).toBeUndefined()
  })
})
