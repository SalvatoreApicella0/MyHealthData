import { describe, expect, it } from 'vitest'
import type { HealthEvent } from './types'
import { applyEventValues, type EventFormValues } from './eventPatch'

const base: HealthEvent = {
  id: 'event_1',
  type: 'pain',
  bodyRegionId: 'lower_back',
  occurredAt: '2026-09-14T10:00:00.000Z',
  intensity: 4,
  description: 'old',
  tags: [],
  attachments: [],
  createdAt: '2026-09-10T10:00:00.000Z',
  updatedAt: '2026-09-10T10:00:00.000Z',
  bodyPoint: { x: 0.1, y: 0.9, z: -0.2, modelVersion: 'final-base-mesh-v1', approximateRegionId: 'lower_back' },
  source: 'healthkit',
  sourceRecordId: 'abc',
}

const values: EventFormValues = {
  type: 'pain',
  bodyRegionId: 'lower_back',
  occurredAt: '2026-09-14T11:00:00.000Z',
  intensity: 6,
  description: 'new',
  tags: ['x'],
  attachments: [],
}

describe('applyEventValues', () => {
  it('keeps the existing body point when no new point is provided', () => {
    const next = applyEventValues(base, values, undefined, '2026-09-14T12:00:00.000Z')
    expect(next.bodyPoint).toEqual(base.bodyPoint)
    expect(next.source).toBe('healthkit')
    expect(next.sourceRecordId).toBe('abc')
    expect(next.createdAt).toBe(base.createdAt)
    expect(next.updatedAt).toBe('2026-09-14T12:00:00.000Z')
  })

  it('replaces the body point when a new one is provided', () => {
    const point = { x: 0.2, y: 0.7, z: 0, modelVersion: 'bodyparts3d-4.0', approximateRegionId: 'left_leg' as const }
    const next = applyEventValues(base, values, point, '2026-09-14T12:00:00.000Z')
    expect(next.bodyPoint).toEqual(point)
  })

  it('creates a fresh event when there is no previous one', () => {
    const next = applyEventValues(undefined, values, undefined, '2026-09-14T12:00:00.000Z')
    expect(next.id).toMatch(/^event_/)
    expect(next.createdAt).toBe('2026-09-14T12:00:00.000Z')
    expect(next.bodyPoint).toBeUndefined()
  })
})
