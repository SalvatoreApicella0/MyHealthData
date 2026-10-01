import { describe, expect, it } from 'vitest'
import { createDraftFhirBundle, mapMeasurementToFhirObservation } from './mapping'
import type { HealthDataSnapshot, Measurement } from '../core/types'

describe('draft FHIR mapping', () => {
  it('maps a measurement to an Observation-like resource', () => {
    const measurement: Measurement = {
      id: 'measurement_1',
      type: 'heart_rate',
      value: 72,
      unit: 'bpm',
      measuredAt: '2026-07-05T12:00:00.000Z',
      createdAt: '2026-07-05T12:00:00.000Z',
    }

    const observation = mapMeasurementToFhirObservation(measurement)

    expect(observation.resourceType).toBe('Observation')
    expect(observation.valueQuantity).toEqual({ value: 72, unit: 'bpm' })
  })

  it('creates a draft collection bundle', () => {
    const snapshot: HealthDataSnapshot = {
      profile: {
        id: 'local-profile',
        alias: 'Example',
        updatedAt: '2026-07-05T12:00:00.000Z',
      },
      events: [],
      measurements: [],
      documents: [],
    }

    const bundle = createDraftFhirBundle(snapshot)

    expect(bundle.resourceType).toBe('Bundle')
    expect(bundle.type).toBe('collection')
  })
})
