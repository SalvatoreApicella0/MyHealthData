import { describe, expect, it } from 'vitest'
import { clearAllData, getSnapshotParts, saveMeasurement } from './repository'
import type { Measurement } from '../core/types'

describe('targeted snapshot reads', () => {
  it('reads only the requested domain while leaving unrelated data untouched', async () => {
    await clearAllData()
    const measurement: Measurement = {
      id: 'measurement-targeted', type: 'weight', value: 80, unit: 'kg', measuredAt: '2026-09-20T10:00:00.000Z', createdAt: '2026-09-20T10:00:00.000Z',
    }
    await saveMeasurement(measurement)
    await expect(getSnapshotParts(['measurements'])).resolves.toEqual({ measurements: [measurement] })
    await clearAllData()
  })

  it('returns an empty partial snapshot for an unrelated domain', async () => {
    await clearAllData()
    await expect(getSnapshotParts(['sleepSessions'])).resolves.toEqual({})
  })
})
