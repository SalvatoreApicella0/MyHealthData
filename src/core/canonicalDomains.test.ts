import { describe, expect, it } from 'vitest'
import { domainSpec } from './canonicalDomains'

describe('canonical medication contract', () => {
  it('writes the iOS MedicationStatement shape from the Web form', () => {
    const spec = domainSpec('medications')
    expect(spec?.dateField).toBe('startDate')
    expect(spec?.fields.map((field) => field.key)).toEqual(expect.arrayContaining([
      'name', 'dose', 'schedule', 'status', 'scheduleStyle', 'startDate', 'endDate',
      'intervalHours', 'stockQuantity', 'refillThreshold', 'remindersEnabled',
    ]))
    expect(spec?.fields.some((field) => field.key === 'active')).toBe(false)
    expect(spec?.fields.some((field) => field.key === 'startedAt')).toBe(false)
    expect(spec?.fields.find((field) => field.key === 'dose')?.type).toBe('text')
  })

  it('exposes the iOS AppointmentRecord contract from the Web form', () => {
    const spec = domainSpec('appointments')
    const fieldKeys = spec?.fields.map((field) => field.key) ?? []
    expect(fieldKeys).toEqual(expect.arrayContaining([
      'title', 'scheduledAt', 'category', 'status', 'outcome', 'reportCollectionAt',
      'questions', 'preparationNotes', 'followUpAt', 'reminderMinutesBefore', 'linkedDocumentId',
    ]))
    expect(new Set(fieldKeys).size).toBe(fieldKeys.length)
    expect(spec?.fields.find((field) => field.key === 'category')?.options).toHaveLength(42)
    expect(spec?.fields.find((field) => field.key === 'questions')?.type).toBe('text-list')
    expect(spec?.fields.find((field) => field.key === 'status')?.options).toEqual(['planned', 'awaitingReport', 'completed', 'cancelled'])
  })
})
