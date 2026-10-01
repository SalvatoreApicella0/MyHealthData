import { describe, expect, it } from 'vitest'
import type { Measurement } from '../../core/types'
import { stageAverages } from './SleepSection'

describe('sleep stage model', () => {
  it('aggregates only recent sleep-stage measurements by stage and day', () => {
    const now = Date.parse('2026-09-20T12:00:00.000Z')
    const measurements = [
      { id: 'deep-1', type: 'sleep_hours', value: 1, unit: 'h', measuredAt: '2026-09-19T07:00:00.000Z', note: 'sleep_stage=deep' },
      { id: 'deep-2', type: 'sleep_hours', value: 0.5, unit: 'h', measuredAt: '2026-09-19T08:00:00.000Z', note: 'sleep_stage=deep' },
      { id: 'rem-old', type: 'sleep_hours', value: 2, unit: 'h', measuredAt: '2026-08-01T07:00:00.000Z', note: 'sleep_stage=rem' },
    ] as Measurement[]

    expect(stageAverages(measurements, now)).toEqual(new Map([['deep', 90]]))
  })
})
