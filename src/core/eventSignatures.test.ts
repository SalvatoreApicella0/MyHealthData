import { describe, expect, it } from 'vitest'
import type { HealthEvent } from './types'
import { eventSubsetSignature, eventsForTypes } from './eventSignatures'

const event = (overrides: Partial<HealthEvent> = {}): HealthEvent => ({
  id: 'event-1', type: 'dental_care', occurredAt: '2026-09-20T10:00:00.000Z', description: 'Controllo',
  tags: [], attachments: [], createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z', ...overrides,
})

describe('eventSubsetSignature', () => {
  it('ignores unrelated events', () => {
    const body = event({ id: 'body-1', type: 'pain' })
    const dental = event({ id: 'dental-1' })
    expect(eventSubsetSignature([body], ['pain', 'discomfort'])).toBe(eventSubsetSignature([body, dental], ['pain', 'discomfort']))
  })
  it('detects relevant edits', () => {
    const original = event({ id: 'dental-1' })
    const edited = event({ id: 'dental-1', updatedAt: '2026-09-20T11:00:00.000Z' })
    expect(eventSubsetSignature([original], ['dental_care'])).not.toBe(eventSubsetSignature([edited], ['dental_care']))
  })
  it('supports masturbation in the sexual section', () => {
    expect(eventSubsetSignature([event({ type: 'masturbation' })], ['sexual_activity', 'masturbation'])).not.toBe('')
  })
  it('returns only events from the requested domain', () => {
    const dental = event({ id: 'dental-1' })
    const pain = event({ id: 'pain-1', type: 'pain' })
    expect(eventsForTypes([dental, pain], ['dental_care'])).toEqual([dental])
  })
})
