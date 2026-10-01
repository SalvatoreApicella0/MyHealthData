import { describe, expect, it } from 'vitest'
import type { HealthDataSnapshot } from '../core/types'
import { healthDataErrorCode } from './errorCodes'
import { shareUnchangedSnapshotParts } from './snapshotParts'

describe('shareUnchangedSnapshotParts', () => {
  it('reuses unchanged domains and invalidates only changed domains', () => {
    const previous = {
      events: [{ id: 'event-1', title: 'Pain' }],
      measurements: [{ id: 'measurement-1', type: 'weight', value: 70 }],
      documents: [],
      medications: [{ id: 'medication-1', name: 'Example', schedule: { morning: true, evening: false } }],
    } as unknown as HealthDataSnapshot
    const next = {
      events: [{ id: 'event-1', title: 'Pain' }],
      measurements: [{ id: 'measurement-1', type: 'weight', value: 71 }],
      documents: [],
      medications: [{ id: 'medication-1', name: 'Example', schedule: { evening: false, morning: true } }],
    } as unknown as HealthDataSnapshot

    const shared = shareUnchangedSnapshotParts(previous, next)

    expect(shared.events).toBe(previous.events)
    expect(shared.documents).toBe(previous.documents)
    expect(shared.medications).toBe(previous.medications)
    expect(shared.measurements).not.toBe(previous.measurements)
  })

  it('uses updatedAt revisions without walking unchanged nested records', () => {
    const previous = {
      events: [{ id: 'event-1', updatedAt: '2026-09-20T08:00:00.000Z', payload: { very: { deep: true } } }],
      measurements: [],
      documents: [],
    } as unknown as HealthDataSnapshot
    const next = {
      events: [{ id: 'event-1', updatedAt: '2026-09-20T08:00:00.000Z', payload: { very: { deep: false } } }],
      measurements: [],
      documents: [],
    } as unknown as HealthDataSnapshot

    expect(shareUnchangedSnapshotParts(previous, next).events).toBe(previous.events)
  })

  it('does not reuse a revised record even when its payload shape is unchanged', () => {
    const previous = {
      events: [{ id: 'event-1', updatedAt: '2026-09-20T08:00:00.000Z', description: 'Pain' }],
      measurements: [],
      documents: [],
    } as unknown as HealthDataSnapshot
    const next = {
      events: [{ id: 'event-1', updatedAt: '2026-09-20T09:00:00.000Z', description: 'Pain' }],
      measurements: [],
      documents: [],
    } as unknown as HealthDataSnapshot

    expect(shareUnchangedSnapshotParts(previous, next).events).not.toBe(previous.events)
  })

  it('invalidates measurements when a derived note changes', () => {
    const previous = {
      events: [],
      measurements: [{ id: 'sleep-1', type: 'sleep_hours', value: 7, unit: 'h', measuredAt: '2026-09-20T07:00:00.000Z', note: 'sleep_stage=light' }],
      documents: [],
    } as unknown as HealthDataSnapshot
    const next = {
      events: [],
      measurements: [{ ...previous.measurements[0], note: 'sleep_stage=deep' }],
      documents: [],
    } as unknown as HealthDataSnapshot

    expect(shareUnchangedSnapshotParts(previous, next).measurements).not.toBe(previous.measurements)
  })

  it('shares measurements when all derived fields are unchanged', () => {
    const previous = {
      events: [],
      measurements: [{ id: 'sleep-1', type: 'sleep_hours', value: 7, unit: 'h', measuredAt: '2026-09-20T07:00:00.000Z', note: 'sleep_stage=light' }],
      documents: [],
    } as unknown as HealthDataSnapshot
    const next = {
      events: [],
      measurements: [{ ...previous.measurements[0] }],
      documents: [],
    } as unknown as HealthDataSnapshot

    expect(shareUnchangedSnapshotParts(previous, next).measurements).toBe(previous.measurements)
  })

  it('falls back to deep comparison for mixed arrays without losing nested changes', () => {
    const previous = {
      events: [
        { id: 'event-1', updatedAt: '2026-09-20T08:00:00.000Z', description: 'Pain' },
        { id: 'legacy-1', payload: { severity: 2 } },
      ],
      measurements: [],
      documents: [],
    } as unknown as HealthDataSnapshot
    const next = {
      events: [
        { id: 'event-1', updatedAt: '2026-09-20T08:00:00.000Z', description: 'Pain' },
        { id: 'legacy-1', payload: { severity: 3 } },
      ],
      measurements: [],
      documents: [],
    } as unknown as HealthDataSnapshot

    expect(shareUnchangedSnapshotParts(previous, next).events).not.toBe(previous.events)
  })
})

describe('Web error state', () => {
  it('keeps raw messages and PHI out of the UI error channel', () => {
    expect(healthDataErrorCode(new Error('https://example.test/private/referto.pdf'))).toBe('operation_failed')
    expect(healthDataErrorCode(new Error('attachment_hash_mismatch'))).toBe('attachment_hash_mismatch')
  })
})
