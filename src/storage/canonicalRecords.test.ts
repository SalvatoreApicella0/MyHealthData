import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllData,
  deleteCanonicalRecord,
  getSnapshot,
  replaceSnapshot,
  saveCanonicalRecord,
} from './repository'

const base = { events: [], measurements: [], documents: [] }

describe('canonical domain writes', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('stores, updates and deletes a canonical record without touching other domains', async () => {
    await replaceSnapshot({ ...base, cycleEntries: [{ id: 'cycle_1', date: '2026-09-01' }] })

    await saveCanonicalRecord('appointments', {
      id: 'appointment_1',
      title: 'Visita oculistica',
      scheduledAt: '2026-10-02T08:30:00.000Z',
      status: 'planned',
    })

    let snapshot = (await getSnapshot()) as Record<string, unknown>
    expect((snapshot.appointments as unknown[]).length).toBe(1)
    expect((snapshot.cycleEntries as unknown[]).length).toBe(1)

    await saveCanonicalRecord('appointments', {
      id: 'appointment_1',
      title: 'Visita oculistica',
      scheduledAt: '2026-10-02T09:00:00.000Z',
      status: 'confirmed',
    })

    snapshot = (await getSnapshot()) as Record<string, unknown>
    const appointments = snapshot.appointments as Array<Record<string, unknown>>
    expect(appointments.length).toBe(1)
    expect(appointments[0]?.status).toBe('confirmed')

    await deleteCanonicalRecord('appointments', 'appointment_1')
    snapshot = (await getSnapshot()) as Record<string, unknown>
    expect((snapshot.appointments as unknown[]).length).toBe(0)
  })

  it('serializes concurrent domain writes without losing a sibling domain', async () => {
    await Promise.all([
      saveCanonicalRecord('appointments', {
        id: 'appointment_concurrent',
        title: 'Visita',
        scheduledAt: '2026-10-02T08:30:00.000Z',
      }),
      saveCanonicalRecord('cycleEntries', {
        id: 'cycle_concurrent',
        date: '2026-09-20T00:00:00.000Z',
      }),
    ])

    const snapshot = (await getSnapshot()) as Record<string, unknown>
    expect(snapshot.appointments).toEqual([expect.objectContaining({ id: 'appointment_concurrent' })])
    expect(snapshot.cycleEntries).toEqual([expect.objectContaining({ id: 'cycle_concurrent' })])
  })

  it('returns canonical records in deterministic newest-first order', async () => {
    await replaceSnapshot({
      ...base,
      appointments: [
        { id: 'appointment_b', scheduledAt: '2026-10-02T08:30:00.000Z' },
        { id: 'appointment_a', scheduledAt: '2026-10-02T08:30:00.000Z' },
        { id: 'appointment_old', scheduledAt: '2026-09-01T08:30:00.000Z' },
      ],
    })

    const snapshot = (await getSnapshot()) as Record<string, unknown>
    expect((snapshot.appointments as Array<Record<string, unknown>>).map((record) => record.id)).toEqual([
      'appointment_a', 'appointment_b', 'appointment_old',
    ])
  })

  it('keeps iOS-only fields and unknown domains across a round trip', async () => {
    await replaceSnapshot({
      ...base,
      events: [
        {
          id: 'event_1',
          type: 'pain',
          occurredAt: '2026-09-10T10:00:00.000Z',
          description: 'Spalla',
          tags: [],
          attachments: [],
          createdAt: '2026-09-10T10:00:00.000Z',
          updatedAt: '2026-09-10T10:00:00.000Z',
          // Fields only the iOS model produces today:
          bodyPoint: { x: 0.4, y: 0.6, z: 0.1 },
          source: 'healthkit',
          sourceRecordId: 'HK-123',
        },
      ],
      futureDomain: [{ id: 'future_1', payload: { nested: true } }],
    })

    const snapshot = (await getSnapshot()) as Record<string, unknown>
    const event = (snapshot.events as Array<Record<string, unknown>>)[0]
    expect(event?.bodyPoint).toEqual({ x: 0.4, y: 0.6, z: 0.1 })
    expect(event?.source).toBe('healthkit')
    expect(snapshot.futureDomain).toEqual([{ id: 'future_1', payload: { nested: true } }])
  })

  it('rejects unsafe domain identifiers', async () => {
    await expect(saveCanonicalRecord('../escape', { id: 'x' })).rejects.toThrow(/Invalid canonical domain/)
    await expect(deleteCanonicalRecord('bad domain', 'x')).rejects.toThrow(/Invalid canonical domain/)
    await expect(saveCanonicalRecord('appointments', { title: 'no id' })).rejects.toThrow(/string id/)
  })
})
