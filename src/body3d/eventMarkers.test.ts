import { describe, expect, it } from 'vitest'
import type { HealthEvent } from '../core/types'
import { markersForEvents, regionCountsForEvents, WEB_BODY_MODEL_VERSION } from './eventMarkers'

// Task 7 widens `HealthEvent.bodyPoint` with `modelVersion`; the override type keeps
// these tests type-safe until then.
type HealthEventOverrides = Partial<HealthEvent> & {
  bodyPoint?: HealthEvent['bodyPoint'] & { modelVersion?: string }
}

function event(overrides: HealthEventOverrides): HealthEvent {
  return {
    id: 'event_1',
    type: 'pain',
    occurredAt: '2026-09-14T10:00:00.000Z',
    description: 'test',
    tags: [],
    attachments: [],
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...overrides,
  }
}

describe('markersForEvents', () => {
  it('keeps only points created with the web model', () => {
    const markers = markersForEvents([
      event({ bodyPoint: { x: 0.1, y: 0.9, z: -0.2, modelVersion: WEB_BODY_MODEL_VERSION } }),
      event({ id: 'event_2', bodyPoint: { x: 0.1, y: 0.9, z: -0.2, modelVersion: 'final-base-mesh-v1' } }),
      event({ id: 'event_3', bodyRegionId: 'chest' }),
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ eventId: 'event_1', x: 0.1, y: 0.9, z: -0.2 })
    expect(markers[0]?.color).toMatch(/^#/)
  })
})

describe('regionCountsForEvents', () => {
  it('counts events per region and tracks the maximum intensity', () => {
    const counts = regionCountsForEvents([
      event({ bodyRegionId: 'lower_back', intensity: 3 }),
      event({ id: 'event_2', bodyRegionId: 'lower_back', intensity: 9 }),
      event({ id: 'event_3', bodyRegionId: 'chest' }),
    ])
    expect(counts.get('lower_back')).toEqual({ count: 2, maxIntensity: 9 })
    expect(counts.get('chest')).toEqual({ count: 1, maxIntensity: 0 })
  })
})
