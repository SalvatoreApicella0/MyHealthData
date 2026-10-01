/**
 * Deterministic ordering for canonical snapshot arrays.
 *
 * IndexedDB gives stable ordering for the four dedicated collections, but the
 * canonical iOS graph is stored as one object and is updated by concurrent
 * domain syncs. Keeping its arrays ordered here makes exports, comparisons and
 * derived views deterministic without mutating the stored records.
 */

const DATE_FIELDS: Readonly<Record<string, string>> = {
  appointments: 'scheduledAt',
  cycleEntries: 'date',
  sleepSessions: 'startAt',
  foodLogEntries: 'loggedAt',
  gymWorkouts: 'startedAt',
  medications: 'startDate',
  medicationDoseEvents: 'recordedAt',
  conditionEpisodes: 'startedAt',
  conditionCheckIns: 'recordedAt',
  labResults: 'collectedAt',
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function timestamp(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function recordId(value: unknown): string {
  return value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string'
    ? (value as Record<string, unknown>).id as string
    : ''
}

function recordValue(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : undefined
}

/** Sorts newest-first, placing undated records last and breaking ties by id. */
export function sortCanonicalRecords(
  domain: string,
  records: readonly Record<string, unknown>[],
): Array<Record<string, unknown>> {
  const dateField = DATE_FIELDS[domain]
  return [...records].sort((left, right) => {
    const leftTime = dateField ? timestamp(recordValue(left, dateField)) : undefined
    const rightTime = dateField ? timestamp(recordValue(right, dateField)) : undefined
    if (leftTime !== undefined || rightTime !== undefined) {
      if (leftTime === undefined) return 1
      if (rightTime === undefined) return -1
      if (leftTime !== rightTime) return rightTime - leftTime
    }
    return compareStrings(
      recordId(left),
      recordId(right),
    )
  })
}
