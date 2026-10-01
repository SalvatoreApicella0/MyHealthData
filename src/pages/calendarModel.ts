export type AppointmentStatus = 'planned' | 'awaitingReport' | 'completed' | 'cancelled'

export interface CalendarAppointmentLike {
  scheduledAt?: unknown
  date?: unknown
  status?: unknown
}

/**
 * Single source of truth for the appointment cards labelled "In programma".
 * A future date is not enough: completed and cancelled records remain visible
 * in the calendar/history but must never inflate the upcoming count.
 */
export function isUpcomingAppointment(record: CalendarAppointmentLike, now = Date.now()): boolean {
  const status = record.status === undefined ? 'planned' : String(record.status)
  if (status !== 'planned') return false
  const rawDate = record.scheduledAt ?? record.date
  const timestamp = new Date(String(rawDate ?? '')).getTime()
  return Number.isFinite(timestamp) && timestamp >= now
}

/** Values bound to the native controls in both appointment editors. */
export interface AppointmentFormValues {
  title: string
  scheduledAt: string
  category: string
  clinician: string
  reason: string
  preparationNotes: string
  outcome: string
  recurrenceNote: string
  reportCollectionAt: string
  questions: string
  followUpAt: string
  reminderMinutesBefore: string
  linkedDocumentId: string
  status?: string
}

export interface AppointmentRecordDraft extends Record<string, unknown> {
  id: string
  title: string
  scheduledAt: string
  category: string
  clinician?: string
  reason?: string
  preparationNotes?: string
  outcome?: string
  recurrenceNote?: string
  reportCollectionAt?: string
  questions?: string[]
  followUpAt?: string
  reminderMinutesBefore?: number
  linkedDocumentId?: string
  status: AppointmentStatus
  createdAt: string
  updatedAt: string
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function optionalIsoDate(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const date = new Date(trimmed)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

function optionalQuestions(value: string): string[] | undefined {
  const questions = value.split(/\r?\n/).map((question) => question.trim()).filter(Boolean)
  return questions.length > 0 ? questions : undefined
}

function reminderValue(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

export function appointmentValidationError(values: AppointmentFormValues): string | undefined {
  if (!values.title.trim()) return 'title'
  if (!optionalIsoDate(values.scheduledAt)) return 'scheduledAt'
  for (const key of ['reportCollectionAt', 'followUpAt'] as const) {
    if (values[key].trim() && !optionalIsoDate(values[key])) return key
  }
  if (values.reminderMinutesBefore.trim() && reminderValue(values.reminderMinutesBefore) === undefined) {
    return 'reminderMinutesBefore'
  }
  return undefined
}

function statusValue(raw: string | undefined, fallback: unknown): AppointmentStatus {
  const candidate = raw || (typeof fallback === 'string' ? fallback : '')
  return candidate === 'awaitingReport' || candidate === 'completed' || candidate === 'cancelled' ? candidate : 'planned'
}

/**
 * Builds a canonical appointment while preserving every field from an
 * imported/legacy record that the current Web editor does not know about.
 * Pass `baseRecord` for edits so newer iOS fields survive a Web round-trip.
 */
export function appointmentRecordFromForm(
  values: AppointmentFormValues,
  metadata: { id: string; now: string },
  baseRecord: Record<string, unknown> = {},
): AppointmentRecordDraft | undefined {
  if (appointmentValidationError(values)) return undefined
  const scheduledAt = optionalIsoDate(values.scheduledAt)
  const reminder = reminderValue(values.reminderMinutesBefore)
  if (!scheduledAt) return undefined

  const record: AppointmentRecordDraft = {
    ...baseRecord,
    id: metadata.id,
    title: values.title.trim(),
    scheduledAt,
    category: values.category || 'general',
    status: statusValue(values.status, baseRecord.status),
    createdAt: typeof baseRecord.createdAt === 'string' ? baseRecord.createdAt : metadata.now,
    updatedAt: metadata.now,
  }

  // The spread preserves fields newer than this Web editor. Undefined clears
  // an editable canonical field when the user intentionally removes it.
  record.clinician = optionalText(values.clinician)
  record.reason = optionalText(values.reason)
  record.preparationNotes = optionalText(values.preparationNotes)
  record.outcome = optionalText(values.outcome)
  record.recurrenceNote = optionalText(values.recurrenceNote)
  record.reportCollectionAt = optionalIsoDate(values.reportCollectionAt)
  record.questions = optionalQuestions(values.questions)
  record.followUpAt = optionalIsoDate(values.followUpAt)
  record.reminderMinutesBefore = reminder
  record.linkedDocumentId = optionalText(values.linkedDocumentId)
  return record
}

export function appointmentFormValuesFromRecord(record: Record<string, unknown>): AppointmentFormValues {
  const questions = Array.isArray(record.questions)
    ? record.questions.filter((question): question is string => typeof question === 'string').join('\n')
    : typeof record.questions === 'string' ? record.questions : ''
  const reminder = typeof record.reminderMinutesBefore === 'number' && Number.isFinite(record.reminderMinutesBefore)
    ? String(record.reminderMinutesBefore)
    : ''

  return {
    title: typeof record.title === 'string' ? record.title : '',
    scheduledAt: localDateTimeValue(record.scheduledAt),
    category: typeof record.category === 'string' && record.category ? record.category : 'general',
    clinician: typeof record.clinician === 'string' ? record.clinician : '',
    reason: typeof record.reason === 'string' ? record.reason : '',
    preparationNotes: typeof record.preparationNotes === 'string' ? record.preparationNotes : '',
    outcome: typeof record.outcome === 'string' ? record.outcome : '',
    recurrenceNote: typeof record.recurrenceNote === 'string' ? record.recurrenceNote : '',
    reportCollectionAt: localDateValue(record.reportCollectionAt),
    questions,
    followUpAt: localDateTimeValue(record.followUpAt),
    reminderMinutesBefore: reminder,
    linkedDocumentId: typeof record.linkedDocumentId === 'string' ? record.linkedDocumentId : '',
    status: typeof record.status === 'string' ? record.status : 'planned',
  }
}

function localDateTimeValue(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function localDateValue(value: unknown): string {
  return localDateTimeValue(value).slice(0, 10)
}
