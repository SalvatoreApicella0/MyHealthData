import { describe, expect, it } from 'vitest'
import { appointmentFormValuesFromRecord, appointmentRecordFromForm, isUpcomingAppointment } from './calendarModel'

function groupByDay(records: Array<{ scheduledAt?: string; date?: string }>): Map<string, number> {
  const result = new Map<string, number>()
  for (const record of records) {
    const date = new Date(String(record.scheduledAt ?? record.date ?? ''))
    if (Number.isNaN(date.getTime())) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    result.set(key, (result.get(key) ?? 0) + 1)
  }
  return result
}

describe('calendar appointment grouping', () => {
  it('groups scheduled appointments by local day and ignores invalid dates', () => {
    const grouped = groupByDay([
      { scheduledAt: '2026-09-20T09:00:00.000Z' },
      { scheduledAt: '2026-09-20T15:00:00.000Z' },
      { scheduledAt: 'not-a-date' },
    ])
    expect([...grouped.values()].reduce((total, count) => total + count, 0)).toBe(2)
  })

  it('counts only future planned appointments as upcoming', () => {
    const now = Date.parse('2026-09-21T10:00:00.000Z')
    const future = '2026-09-22T10:00:00.000Z'
    expect(isUpcomingAppointment({ scheduledAt: future, status: 'planned' }, now)).toBe(true)
    expect(isUpcomingAppointment({ scheduledAt: future, status: 'completed' }, now)).toBe(false)
    expect(isUpcomingAppointment({ scheduledAt: future, status: 'cancelled' }, now)).toBe(false)
    expect(isUpcomingAppointment({ scheduledAt: '2026-09-20T10:00:00.000Z', status: 'planned' }, now)).toBe(false)
    expect(isUpcomingAppointment({ scheduledAt: future }, now)).toBe(true)
  })
})

describe('calendar appointment form contract', () => {
  it('normalizes the fields shared with the iOS appointment editor', () => {
    const record = appointmentRecordFromForm({
      title: '  Controllo  ',
      scheduledAt: '2026-09-20T09:00:00.000Z',
      category: 'cardiology',
      clinician: '  Dr. Rossi ',
      reason: '  Follow-up ',
      preparationNotes: 'Portare gli esami',
      outcome: '',
      recurrenceNote: '',
      reportCollectionAt: '',
      questions: '',
      followUpAt: '',
      reminderMinutesBefore: '1440',
      linkedDocumentId: 'document-1',
    }, { id: 'appointment-1', now: '2026-09-01T10:00:00.000Z' })

    expect(record).toMatchObject({
      id: 'appointment-1',
      title: 'Controllo',
      category: 'cardiology',
      clinician: 'Dr. Rossi',
      reason: 'Follow-up',
      preparationNotes: 'Portare gli esami',
      reminderMinutesBefore: 1440,
      linkedDocumentId: 'document-1',
      status: 'planned',
    })
  })

  it('rejects incomplete or invalid reminder input before persistence', () => {
    const base = {
      title: 'Controllo',
      scheduledAt: '2026-09-20T09:00:00.000Z',
      category: 'general',
      clinician: '',
      reason: '',
      preparationNotes: '',
      outcome: '',
      recurrenceNote: '',
      reportCollectionAt: '',
      questions: '',
      followUpAt: '',
      linkedDocumentId: '',
    }

    expect(appointmentRecordFromForm({ ...base, reminderMinutesBefore: '0' }, { id: 'x', now: 'now' })).toBeUndefined()
    expect(appointmentRecordFromForm({ ...base, reminderMinutesBefore: 'not-a-number' }, { id: 'x', now: 'now' })).toBeUndefined()
    expect(appointmentRecordFromForm({ ...base, title: '   ', reminderMinutesBefore: '' }, { id: 'x', now: 'now' })).toBeUndefined()
  })

  it('round-trips advanced fields and preserves unknown legacy fields while editing', () => {
    const original = {
      id: 'appointment-legacy',
      title: 'Controllo',
      scheduledAt: '2026-09-20T09:00:00.000Z',
      category: 'cardiology',
      clinician: 'Dr. Rossi',
      reason: 'Follow-up',
      preparationNotes: 'Portare gli esami',
      outcome: 'Tutto bene',
      recurrenceNote: 'Ogni 6 mesi',
      reportCollectionAt: '2026-09-24T00:00:00.000Z',
      questions: ['Lente progressiva?', 'Serve un altro controllo?'],
      followUpAt: '2027-03-20T09:00:00.000Z',
      reminderMinutesBefore: 1440,
      linkedDocumentId: 'document-1',
      status: 'awaitingReport',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      parentAppointmentId: 'appointment-parent',
      futureIosField: { keep: true },
    }
    const values = appointmentFormValuesFromRecord(original)
    expect(values.questions).toBe('Lente progressiva?\nServe un altro controllo?')

    const edited = appointmentRecordFromForm({ ...values, title: 'Controllo aggiornato' }, {
      id: original.id,
      now: '2026-09-02T10:00:00.000Z',
    }, original)

    expect(edited).toMatchObject({
      title: 'Controllo aggiornato',
      outcome: 'Tutto bene',
      recurrenceNote: 'Ogni 6 mesi',
      reportCollectionAt: original.reportCollectionAt,
      questions: original.questions,
      followUpAt: original.followUpAt,
      reminderMinutesBefore: 1440,
      linkedDocumentId: 'document-1',
      status: 'awaitingReport',
      parentAppointmentId: 'appointment-parent',
      futureIosField: { keep: true },
      createdAt: original.createdAt,
      updatedAt: '2026-09-02T10:00:00.000Z',
    })
  })

  it('clears editable advanced fields without dropping unrelated record fields', () => {
    const edited = appointmentRecordFromForm({
      title: 'Controllo',
      scheduledAt: '2026-09-20T09:00',
      category: 'general',
      clinician: '',
      reason: '',
      preparationNotes: '',
      outcome: '',
      recurrenceNote: '',
      reportCollectionAt: '',
      questions: '',
      followUpAt: '',
      reminderMinutesBefore: '',
      linkedDocumentId: '',
      status: 'planned',
    }, { id: 'x', now: '2026-09-02T10:00:00.000Z' }, {
      id: 'x', title: 'Old', scheduledAt: '2026-09-19T09:00:00.000Z', category: 'general',
      outcome: 'Old outcome', questions: ['Old question'], futureIosField: 'keep',
      createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z', status: 'planned',
    })

    expect(edited).toMatchObject({ futureIosField: 'keep', createdAt: '2026-09-01T10:00:00.000Z' })
    expect(edited?.outcome).toBeUndefined()
    expect(edited?.questions).toBeUndefined()
  })
})
