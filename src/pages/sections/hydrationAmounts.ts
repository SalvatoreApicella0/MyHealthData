import type { Measurement } from '../../core/types'

/** Display conversion only; stored values and units remain untouched. */
export function hydrationAmount(measurement: Pick<Measurement, 'type' | 'value' | 'unit'>): number | undefined {
  const value = Number(measurement.value)
  if (!Number.isFinite(value) || value < 0) return undefined
  const unit = measurement.unit.trim().toLowerCase()
  if (measurement.type === 'dietary_water') {
    if (unit === 'ml') return value
    if (unit === 'l') return value * 1000
  }
  if (measurement.type === 'dietary_caffeine') {
    if (unit === 'mg') return value
    if (unit === 'g') return value * 1000
  }
  if (measurement.type === 'alcohol_units' && unit === 'ua') return value
  return undefined
}

export function hydrationSummary(measurements: readonly Measurement[], day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime()
  const since = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 6).getTime()
  let waterToday = 0
  let caffeineWeek = 0
  let alcoholWeek = 0
  let unsupported = 0
  for (const measurement of measurements) {
    if (!['dietary_water', 'dietary_caffeine', 'alcohol_units'].includes(measurement.type)) continue
    const time = new Date(measurement.measuredAt).getTime()
    if (!Number.isFinite(time) || time >= end || time < (measurement.type === 'dietary_water' ? start : since)) continue
    const value = hydrationAmount(measurement)
    if (value === undefined) { unsupported += 1; continue }
    if (measurement.type === 'dietary_water') waterToday += value
    if (measurement.type === 'dietary_caffeine') caffeineWeek += value
    if (measurement.type === 'alcohol_units') alcoholWeek += value
  }
  return { waterToday, caffeineWeek, alcoholWeek, unsupported }
}
