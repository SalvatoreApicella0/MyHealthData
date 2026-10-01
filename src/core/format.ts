import { BODY_REGION_LABELS } from './bodyRegions'
import { DOCUMENT_TYPES, EVENT_TYPES, MEASUREMENT_TYPES } from './constants'
import type { BodyRegionId, DocumentType, EventType, MeasurementType } from './types'

export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function fromDateTimeLocal(value: string): string {
  return value ? new Date(value).toISOString() : new Date().toISOString()
}

export function labelForEventType(type: EventType): string {
  return EVENT_TYPES.find((item) => item.id === type)?.label ?? type
}

export function labelForMeasurementType(type: MeasurementType): string {
  return MEASUREMENT_TYPES.find((item) => item.id === type)?.label ?? type
}

export function defaultUnitForMeasurement(type: MeasurementType): string {
  return MEASUREMENT_TYPES.find((item) => item.id === type)?.defaultUnit ?? ''
}

export function labelForDocumentType(type: DocumentType): string {
  return DOCUMENT_TYPES.find((item) => item.id === type)?.label ?? type
}

export function labelForBodyRegion(regionId?: BodyRegionId): string {
  return regionId ? BODY_REGION_LABELS[regionId] : 'Unlinked'
}

export function splitTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function joinTags(tags: string[]): string {
  return tags.join(', ')
}
