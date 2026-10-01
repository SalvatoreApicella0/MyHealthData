/**
 * Measurement helpers shared by the Web dashboards.
 *
 * The aggregation rules mirror the iOS app: cumulative HealthKit quantities
 * (steps, energy, distance, water, food) are summed per day, while
 * physiological point metrics are averaged per day.
 */

import type { CanonicalSnapshotLike } from './healthModules'

const CUMULATIVE_TYPES: ReadonlySet<string> = new Set([
  'step_count',
  'active_energy_burned',
  'basal_energy_burned',
  'distance_walking_running',
  'distance_cycling',
  'distance_swimming',
  'distance_wheelchair',
  'flights_climbed',
  'exercise_minutes',
  'stand_minutes',
  'daylight_minutes',
  'workout_minutes',
  'mindful_minutes',
  'swimming_stroke_count',
  'wheelchair_push_count',
  'dietary_water',
  'dietary_energy',
  'dietary_caffeine',
  'alcohol_units',
  'treadmill_corrected_distance',
  'treadmill_corrected_energy',
])

export function isCumulativeMeasurement(type: string): boolean {
  return CUMULATIVE_TYPES.has(type)
}

export interface MeasurementRecord {
  id: string
  type: string
  value: number
  unit: string
  measuredAt: string
  note?: string
  createdAt?: string
}

type MeasurementSource = readonly unknown[]

// The unified page asks for the same measurement type from several tiles,
// averages and sparklines. The repository preserves array references for
// unchanged domains, so a WeakMap lets all those readers share one sorted,
// normalized index without retaining old snapshots.
const measurementIndexCache = new WeakMap<MeasurementSource, Map<string, MeasurementRecord[]>>()
const measurementTypesCache = new WeakMap<MeasurementSource, ReadonlySet<string>>()
const dailyAggregateCache = new WeakMap<MeasurementSource, Map<string, DailyAggregate[]>>()
const dailyTotalCache = new WeakMap<MeasurementSource, Map<string, number>>()
const weeklyTotalCache = new WeakMap<MeasurementSource, Map<string, number>>()

export function measurementRecords(snapshot: CanonicalSnapshotLike, type?: string): MeasurementRecord[] {
  const source = snapshot.measurements
  if (!Array.isArray(source)) return []

  let byType = measurementIndexCache.get(source)
  if (!byType) {
    const all = source
    .filter((entry) => typeof entry.value === 'number' && typeof entry.measuredAt === 'string')
    .map((entry) => ({
      id: String(entry.id ?? ''),
      type: String(entry.type ?? ''),
      value: entry.value as number,
      unit: String(entry.unit ?? ''),
      measuredAt: entry.measuredAt as string,
      note: typeof entry.note === 'string' ? entry.note : undefined,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : undefined,
    }))
    .sort((left, right) => new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime())

    byType = new Map([['', all]])
    for (const record of all) {
      const records = byType.get(record.type)
      if (records) records.push(record)
      else byType.set(record.type, [record])
    }
    measurementIndexCache.set(source, byType)
  }

  return byType.get(type ?? '') ?? []
}

/** Returns the set of measurement types represented in the current snapshot. */
export function measurementTypesWithValues(snapshot: CanonicalSnapshotLike): ReadonlySet<string> {
  const source = snapshot.measurements
  if (!Array.isArray(source)) return new Set()
  const cached = measurementTypesCache.get(source)
  if (cached) return cached
  let byType = measurementIndexCache.get(source)
  if (!byType) {
    measurementRecords(snapshot)
    byType = measurementIndexCache.get(source)
  }
  const types = new Set([...byType?.keys() ?? []].filter((type) => type.length > 0))
  measurementTypesCache.set(source, types)
  return types
}

export function latestMeasurement(snapshot: CanonicalSnapshotLike, type: string): MeasurementRecord | undefined {
  const records = measurementRecords(snapshot, type)
  return records[records.length - 1]
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface DailyAggregate {
  day: string
  value: number
  samples: number
}

/** Daily aggregates for the last `days` days, oldest first. */
export function dailyAggregates(
  snapshot: CanonicalSnapshotLike,
  type: string,
  days: number,
  now: Date = new Date(),
): DailyAggregate[] {
  const source = snapshot.measurements
  if (!Array.isArray(source)) return []
  const cacheKey = `${type}|${days}|${dayKey(now)}`
  let cachedByKey = dailyAggregateCache.get(source)
  if (!cachedByKey) {
    cachedByKey = new Map()
    dailyAggregateCache.set(source, cachedByKey)
  }
  const cached = cachedByKey.get(cacheKey)
  if (cached) return cached

  const buckets = new Map<string, { total: number; samples: number }>()
  const firstDay = startOfDay(new Date(now.getTime() - (days - 1) * 86_400_000))

  for (const record of measurementRecords(snapshot, type)) {
    const date = new Date(record.measuredAt)
    if (Number.isNaN(date.getTime()) || startOfDay(date) < firstDay) {
      continue
    }
    const key = dayKey(date)
    const bucket = buckets.get(key) ?? { total: 0, samples: 0 }
    bucket.total += record.value
    bucket.samples += 1
    buckets.set(key, bucket)
  }

  const cumulative = isCumulativeMeasurement(type)
  const result: DailyAggregate[] = []
  for (let index = 0; index < days; index += 1) {
    const date = new Date(firstDay.getTime() + index * 86_400_000)
    const key = dayKey(date)
    const bucket = buckets.get(key)
    if (!bucket) {
      continue
    }
    result.push({
      day: key,
      value: cumulative ? bucket.total : bucket.total / bucket.samples,
      samples: bucket.samples,
    })
  }
  cachedByKey.set(cacheKey, result)
  return result
}

/** Mean of the daily aggregates over the last `days` days (days without data are skipped). */
export function averageDailyValue(
  snapshot: CanonicalSnapshotLike,
  type: string,
  days: number,
  now: Date = new Date(),
): number | undefined {
  const aggregates = dailyAggregates(snapshot, type, days, now)
  if (aggregates.length === 0) {
    return undefined
  }
  return aggregates.reduce((total, entry) => total + entry.value, 0) / aggregates.length
}

export function totalForDay(snapshot: CanonicalSnapshotLike, type: string, day: Date = new Date()): number {
  const key = dayKey(day)
  const source = snapshot.measurements
  if (!Array.isArray(source)) return 0
  let cachedByKey = dailyTotalCache.get(source)
  if (!cachedByKey) {
    cachedByKey = new Map()
    dailyTotalCache.set(source, cachedByKey)
  }
  const cacheKey = `${type}|${key}`
  const cached = cachedByKey.get(cacheKey)
  if (cached !== undefined) return cached

  const total = measurementRecords(snapshot, type)
    .filter((record) => dayKey(new Date(record.measuredAt)) === key)
    .reduce((total, record) => total + record.value, 0)
  cachedByKey.set(cacheKey, total)
  return total
}

export function lastValue(snapshot: CanonicalSnapshotLike, type: string): MeasurementRecord | undefined {
  return latestMeasurement(snapshot, type)
}

/** Monday 00:00 of the ISO week containing `date`. */
function startOfIsoWeek(date: Date): Date {
  const base = startOfDay(date)
  const offset = (base.getDay() + 6) % 7
  return new Date(base.getTime() - offset * 86_400_000)
}

/** Sum of the records inside one ISO week; `weekOffset` 0 is the current week. */
export function totalForWeek(
  snapshot: CanonicalSnapshotLike,
  type: string,
  weekOffset = 0,
  now: Date = new Date(),
): number {
  const source = snapshot.measurements
  if (!Array.isArray(source)) return 0
  const cacheKey = `${type}|${weekOffset}|${dayKey(now)}`
  let cachedByKey = weeklyTotalCache.get(source)
  if (!cachedByKey) {
    cachedByKey = new Map()
    weeklyTotalCache.set(source, cachedByKey)
  }
  const cached = cachedByKey.get(cacheKey)
  if (cached !== undefined) return cached

  const start = startOfIsoWeek(new Date(now.getTime() - weekOffset * 7 * 86_400_000))
  const end = new Date(start.getTime() + 7 * 86_400_000)
  const total = measurementRecords(snapshot, type)
    .filter((record) => {
      const at = new Date(record.measuredAt)
      return !Number.isNaN(at.getTime()) && at >= start && at < end
    })
    .reduce((total, record) => total + record.value, 0)
  cachedByKey.set(cacheKey, total)
  return total
}

/** Mean of the weekly totals over the last `weeks` ISO weeks (including the current one). */
export function averageWeeklyTotal(
  snapshot: CanonicalSnapshotLike,
  type: string,
  weeks: number,
  now: Date = new Date(),
): number | undefined {
  if (weeks <= 0) {
    return undefined
  }
  let total = 0
  for (let index = 0; index < weeks; index += 1) {
    total += totalForWeek(snapshot, type, index, now)
  }
  return total / weeks
}

/** Walking speed (m/s or km/h) as pace in minutes per kilometre. */
export function walkingPaceMinPerKm(value: number | undefined, unit: string | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  const normalized = (unit ?? '').toLowerCase()
  if (normalized === 'm/s') {
    return 1000 / (value * 60)
  }
  if (normalized === 'km/h' || normalized === 'kmh') {
    return 60 / value
  }
  return undefined
}

/** `min/km` rendered as `m:ss`. */
export function formatPace(minutesPerKm: number): string {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) {
    return '—'
  }
  const totalSeconds = Math.round(minutesPerKm * 60)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/** Stair speed in m/s as an estimated floors per minute (3 m per floor). */
export function stairFloorsPerMinute(value: number | undefined, unit: string | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  if ((unit ?? '').toLowerCase() === 'm/s') {
    return (value * 60) / 3
  }
  return undefined
}

/** Signed delta between two values, rendered like the iOS "Δ" chips. */
export function formatDelta(delta: number, digits = 1): string {
  if (!Number.isFinite(delta)) {
    return '—'
  }
  const formatted = Math.abs(delta) >= 100 ? Math.round(Math.abs(delta)).toString() : Math.abs(delta).toFixed(digits)
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '±'
  return `${sign}${formatted}`
}

export function formatValue(value: number, unit: string): string {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2
  const formatted = Number(value.toFixed(digits)).toLocaleString(undefined, { maximumFractionDigits: digits })
  return unit ? `${formatted} ${unit}` : formatted
}
