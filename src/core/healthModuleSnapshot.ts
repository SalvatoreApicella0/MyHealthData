import { MEASUREMENT_MODULE_TYPES } from './healthModuleMeasurements'
import { resolveHealthModuleId } from './healthModuleCatalog'
import type { HealthModuleId } from './healthModuleCatalog'

export type CanonicalSnapshotLike = Record<string, unknown>

export function snapshotRecords(snapshot: CanonicalSnapshotLike, key: string): Array<Record<string, unknown>> {
  const value = snapshot[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
}

const records = snapshotRecords

function dayKey(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length < 10) {
    return undefined
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function measurementTypes(snapshot: CanonicalSnapshotLike): string[] {
  return records(snapshot, 'measurements')
    .map((entry) => entry.type)
    .filter((type): type is string => typeof type === 'string')
}

function measurementDays(snapshot: CanonicalSnapshotLike, types: readonly string[]): Set<string> {
  const wanted = new Set(types)
  const days = new Set<string>()
  for (const measurement of records(snapshot, 'measurements')) {
    const type = measurement.type
    if (typeof type !== 'string' || !wanted.has(type)) {
      continue
    }
    const day = dayKey(measurement.measuredAt)
    if (day) {
      days.add(day)
    }
  }
  return days
}

function eventDays(snapshot: CanonicalSnapshotLike, eventType: string): Set<string> {
  const days = new Set<string>()
  for (const event of records(snapshot, 'events')) {
    if (event.type !== eventType) {
      continue
    }
    const day = dayKey(event.occurredAt)
    if (day) {
      days.add(day)
    }
  }
  return days
}

function domainDays(snapshot: CanonicalSnapshotLike, key: string, field: string): Set<string> {
  const days = new Set<string>()
  for (const entry of records(snapshot, key)) {
    const day = dayKey(entry[field])
    if (day) {
      days.add(day)
    }
  }
  return days
}

export function totalRecordCount(snapshot: CanonicalSnapshotLike): number {
  const collectionKeys = [
    'events',
    'measurements',
    'documents',
    'cycleEntries',
    'sleepSessions',
    'foodLogEntries',
    'foodRecipes',
    'gymPlans',
    'gymWorkouts',
    'appointments',
    'medications',
    'medicationDoseEvents',
    'conditionEpisodes',
    'conditionCheckIns',
    'labResults',
  ]
  return collectionKeys.reduce((total, key) => total + records(snapshot, key).length, snapshot.profile ? 1 : 0)
}

export interface ModuleMetricStrings {
  noDays: string
  oneDay: string
  dataDays: (count: number) => string
  vaultRecords: (count: number) => string
  customPackage: string
}

/**
 * Mirrors `HealthFeature.metric(in:)`: the number of distinct days with data
 * for the module, which is what the iOS tiles show under each card.
 */
export function moduleMetric(
  id: HealthModuleId,
  snapshot: CanonicalSnapshotLike,
  strings: ModuleMetricStrings,
): string {
  const canonicalId = resolveHealthModuleId(id)
  const covered = coveredDaysForModule(canonicalId, snapshot)

  if (canonicalId === 'backupSync') {
    return strings.vaultRecords(totalRecordCount(snapshot))
  }
  if (canonicalId === 'shareForCare') {
    return strings.customPackage
  }
  if (covered.size === 0) {
    return strings.noDays
  }
  return covered.size === 1 ? strings.oneDay : strings.dataDays(covered.size)
}

export function coveredDaysForModule(id: HealthModuleId, snapshot: CanonicalSnapshotLike): Set<string> {
  switch (resolveHealthModuleId(id)) {
    case 'body': {
      const days = new Set<string>()
      for (const event of records(snapshot, 'events')) {
        if (event.bodyPoint === undefined && event.bodyRegionId === undefined) {
          continue
        }
        const day = dayKey(event.occurredAt)
        if (day) {
          days.add(day)
        }
      }
      return days
    }
    case 'cycle':
      return domainDays(snapshot, 'cycleEntries', 'date')
    case 'sexualHealth': {
      const days = eventDays(snapshot, 'sexual_activity')
      for (const day of eventDays(snapshot, 'masturbation')) {
        days.add(day)
      }
      return days
    }
    case 'allergies':
      return eventDays(snapshot, 'allergy')
    case 'vision':
      return eventDays(snapshot, 'vision_prescription')
    case 'gutHealth':
      return eventDays(snapshot, 'digestive_health')
    case 'dental':
      return eventDays(snapshot, 'dental_care')
    case 'sleep': {
      const days = domainDays(snapshot, 'sleepSessions', 'startAt')
      for (const day of measurementDays(snapshot, ['sleep_hours'])) {
        days.add(day)
      }
      return days
    }
    case 'gym':
      return domainDays(snapshot, 'gymWorkouts', 'startedAt')
    case 'nutrition': {
      const days = measurementDays(snapshot, MEASUREMENT_MODULE_TYPES.nutrition)
      for (const day of domainDays(snapshot, 'foodLogEntries', 'loggedAt')) {
        days.add(day)
      }
      return days
    }
    case 'medications':
      return domainDays(snapshot, 'medicationDoseEvents', 'recordedAt')
    case 'bloodwork':
      return domainDays(snapshot, 'labResults', 'collectedAt')
    case 'trends':
      return domainDays(snapshot, 'measurements', 'measuredAt')
    case 'heart':
      return measurementDays(snapshot, MEASUREMENT_MODULE_TYPES.heart)
    case 'activity':
      return measurementDays(snapshot, MEASUREMENT_MODULE_TYPES.activity)
    case 'bodyMeasurements':
      return measurementDays(snapshot, MEASUREMENT_MODULE_TYPES.bodyMeasurements)
    case 'backupSync':
    case 'shareForCare':
      return new Set(measurementTypes(snapshot))
    default:
      return new Set<string>()
  }
}
