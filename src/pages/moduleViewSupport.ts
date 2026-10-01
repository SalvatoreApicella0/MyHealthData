import type { CSSProperties } from 'react'
import { createId } from '../core/id'
import type { Measurement, MeasurementType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'

export function tintStyle(tint: string): CSSProperties {
  return { '--tint': tint } as CSSProperties
}

export function toDateTimeLocalValue(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function useSaveMeasurement(data: HealthDataController) {
  return async (type: string, value: number, unit: string, measuredAt: string, note?: string) => {
    const now = new Date().toISOString()
    const measurement: Measurement = {
      id: createId('measurement'),
      type: type as MeasurementType,
      value,
      unit,
      measuredAt: new Date(measuredAt).toISOString(),
      note,
      createdAt: now,
    }
    await data.saveMeasurement(measurement)
  }
}
