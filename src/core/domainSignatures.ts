import { MEASUREMENT_MODULE_TYPES } from './healthModules'
import { measurementSubsetSignature } from './measurementSignatures'
import type { Measurement, MeasurementType } from './types'

/**
 * The complete measurement contract consumed by the Movimento section.
 *
 * Keep this list in the core layer instead of duplicating it in the page:
 * section invalidation and section selection must agree on the same domain.
 * A new HealthKit activity metric belongs here before it is rendered.
 */
export const MOVEMENT_DOMAIN_TYPES: readonly MeasurementType[] = Object.freeze(
  [...MEASUREMENT_MODULE_TYPES.activity] as MeasurementType[],
)

/**
 * Revision key for Movimento only. Unrelated measurement types deliberately
 * do not affect this value, so callers can retain the previous domain slice.
 */
export function movementMeasurementSignature(measurements: readonly Measurement[]): string {
  return measurementSubsetSignature(measurements, MOVEMENT_DOMAIN_TYPES)
}
