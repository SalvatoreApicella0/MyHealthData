import { describe, expect, it } from 'vitest'
import { createExportFile, healthEventSchema, parseMhdExportFile } from './schema'
import type { HealthDataSnapshot, HealthEvent } from './types'

function makeEvent(overrides: Partial<HealthEvent> = {}): HealthEvent {
  const now = new Date('2026-07-05T12:00:00.000Z').toISOString()
  return {
    id: 'event_test',
    type: 'pain',
    bodyRegionId: 'lower_back',
    occurredAt: now,
    intensity: 7,
    durationMinutes: 180,
    description: 'Lower back pain after training',
    suspectedTrigger: 'training',
    helpedBy: 'rest',
    tags: ['training'],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('MHD export schema', () => {
  it('creates a valid v0.1 export file', () => {
    const snapshot: HealthDataSnapshot = {
      events: [makeEvent()],
      measurements: [],
      documents: [],
    }

    const exportFile = createExportFile(snapshot)
    const parsed = parseMhdExportFile(exportFile)

    expect(parsed.manifest.app).toBe('MyHealthData')
    expect(parsed.manifest.schemaVersion).toBe('0.1.0')
    expect(parsed.metadata.recordCounts.events).toBe(1)
    expect(parsed.events[0]?.bodyRegionId).toBe('lower_back')
  })

  it('rejects an export with an unsupported schema version', () => {
    const exportFile = createExportFile({ events: [], measurements: [], documents: [] })

    expect(() =>
      parseMhdExportFile({
        ...exportFile,
        manifest: {
          ...exportFile.manifest,
          schemaVersion: '9.9.9',
        },
      }),
    ).toThrow()
  })

  it('accepts mobile Apple Health measurement types', () => {
    const exportFile = createExportFile({
      events: [],
      measurements: [
        {
          id: 'measurement_steps',
          type: 'step_count',
          value: 8200,
          unit: 'count',
          measuredAt: '2026-07-05T12:00:00.000Z',
          createdAt: '2026-07-05T12:00:00.000Z',
          note: 'Imported from Apple Health',
        },
      ],
      documents: [],
    })

    expect(parseMhdExportFile(exportFile).measurements[0]?.type).toBe('step_count')
  })
})

describe('bodyPoint', () => {
  it('preserves iOS-only point fields on parse', () => {
    const parsed = healthEventSchema.parse({
      ...makeEvent(),
      bodyPoint: {
        x: 0.1,
        y: 0.9,
        z: -0.2,
        id: 'body_point_1',
        modelVersion: 'final-base-mesh-v1',
        approximateRegionId: 'lower_back',
      },
    })
    expect(parsed.bodyPoint).toMatchObject({
      x: 0.1,
      modelVersion: 'final-base-mesh-v1',
      approximateRegionId: 'lower_back',
    })
  })
})
