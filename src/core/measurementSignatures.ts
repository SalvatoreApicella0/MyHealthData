import type { Measurement } from './types'

/**
 * The Web snapshot currently models `updatedAt` as optional for measurements,
 * while newer Hub/iOS payloads may provide it. Keep that field optional here so
 * the helper can cover both shapes without changing the internal measurement
 * model or the export schema.
 */
export type MeasurementSignatureRecord = Pick<
  Measurement,
  'id' | 'type' | 'measuredAt' | 'value' | 'unit' | 'note'
> & {
  updatedAt?: string
}

type MeasurementSource = readonly MeasurementSignatureRecord[]
interface CacheEntry<T extends MeasurementSignatureRecord> {
  records?: readonly T[]
  signature?: string
}

const cache = new WeakMap<MeasurementSource, Map<string, CacheEntry<MeasurementSignatureRecord>>>()

function cacheKey(measurementTypes: readonly string[]): string {
  return JSON.stringify([...new Set(measurementTypes)].sort())
}

function entryFor<T extends MeasurementSignatureRecord>(
  measurements: readonly T[],
  measurementTypes: readonly string[],
): CacheEntry<T> {
  const source = measurements as MeasurementSource
  let entries = cache.get(source) as Map<string, CacheEntry<T>> | undefined
  if (!entries) {
    entries = new Map<string, CacheEntry<T>>()
    cache.set(source, entries as Map<string, CacheEntry<MeasurementSignatureRecord>>)
  }
  const key = cacheKey(measurementTypes)
  let entry = entries.get(key)
  if (!entry) {
    entry = {}
    entries.set(key, entry)
  }
  return entry
}

/**
 * Returns measurements whose type is in `measurementTypes`, preserving source
 * order and returning a cached, immutable array. The source is never sorted or
 * mutated. The array is frozen once, so referential reuse cannot expose the
 * cache to accidental `push`/`splice` mutations.
 */
export function measurementForTypes<T extends MeasurementSignatureRecord>(
  measurements: readonly T[],
  measurementTypes: readonly string[],
): readonly T[] {
  const entry = entryFor(measurements, measurementTypes)
  if (entry.records) return entry.records

  const allowed = new Set(measurementTypes)
  const records = Object.freeze(
    measurements.filter((measurement) => allowed.has(measurement.type)),
  )
  entry.records = records
  return records
}

/**
 * Stable invalidation key for only the requested measurement types.
 *
 * Each record includes every value that can change a metric section. Sorting
 * the encoded records makes the result independent of source-array order while
 * leaving the caller's array untouched.
 */
export function measurementSubsetSignature<T extends MeasurementSignatureRecord>(
  measurements: readonly T[],
  measurementTypes: readonly string[],
): string {
  const entry = entryFor(measurements, measurementTypes)
  if (entry.signature !== undefined) return entry.signature

  const signature = measurementForTypes(measurements, measurementTypes)
    .map((measurement) => JSON.stringify([
      measurement.id,
      measurement.type,
      measurement.measuredAt,
      measurement.updatedAt ?? '',
      measurement.value,
      measurement.unit,
      measurement.note ?? '',
    ]))
    .sort()
    .join('|')
  entry.signature = signature
  return signature
}
