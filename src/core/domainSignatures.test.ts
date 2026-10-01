import { describe, expect, it } from 'vitest'
import { MEASUREMENT_MODULE_TYPES } from './healthModules'
import { movementMeasurementSignature, MOVEMENT_DOMAIN_TYPES } from './domainSignatures'
import type { Measurement } from './types'

const measurement = (overrides: Partial<Measurement> = {}): Measurement => ({
  id: 'measurement-1',
  type: 'step_count',
  value: 1200,
  unit: 'count',
  measuredAt: '2026-09-20T08:00:00.000Z',
  createdAt: '2026-09-20T08:00:00.000Z',
  ...overrides,
})

describe('domain signatures', () => {
  it('keeps Movimento independent from unrelated measurement types', () => {
    const activity = [measurement()]
    const withUnrelated = [...activity, measurement({ id: 'weight-1', type: 'weight', value: 70, unit: 'kg' })]

    expect(movementMeasurementSignature(activity)).toBe(movementMeasurementSignature(withUnrelated))
  })

  it('invalidates Movimento when an activity record changes', () => {
    const original = movementMeasurementSignature([measurement()])
    const changed = movementMeasurementSignature([measurement({ value: 1600 })])

    expect(changed).not.toBe(original)
  })

  it('uses the same activity contract as the canonical module catalog', () => {
    expect(MOVEMENT_DOMAIN_TYPES).toEqual(MEASUREMENT_MODULE_TYPES.activity)
  })
})
