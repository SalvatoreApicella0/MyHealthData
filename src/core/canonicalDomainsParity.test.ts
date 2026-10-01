import { describe, expect, it } from 'vitest'
import { CANONICAL_DOMAIN_SPECS } from './canonicalDomains'

describe('Web/iOS canonical field parity', () => {
  it('keeps the appointment editor aligned with the iOS fields', () => {
    const fields = new Set(CANONICAL_DOMAIN_SPECS.appointments?.fields.map((field) => field.key))
    expect([...fields]).toEqual(expect.arrayContaining([
      'title', 'scheduledAt', 'category', 'clinician', 'reason', 'preparationNotes',
      'reminderMinutesBefore', 'linkedDocumentId',
    ]))
  })

  it('keeps appointment follow-up as a full instant', () => {
    expect(CANONICAL_DOMAIN_SPECS.appointments?.fields.find((field) => field.key === 'followUpAt')?.type).toBe('datetime')
  })

  it('keeps the complete iOS lab result range and document linkage', () => {
    const fields = new Set(CANONICAL_DOMAIN_SPECS.labResults?.fields.map((field) => field.key))
    expect(fields).toEqual(new Set([
      'analyte', 'panelName', 'value', 'unit', 'referenceRange', 'collectedAt',
      'referenceLow', 'referenceHigh', 'comparator', 'laboratoryFlag', 'linkedDocumentId', 'note',
    ]))
  })
})
