import type { BodyRegionId, EventType, HealthEvent } from '../core/types'

export const WEB_BODY_MODEL_VERSION = 'bodyparts3d-4.0'

export interface BodyEventMarker {
  eventId: string
  x: number
  y: number
  z: number
  color: string
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  pain: '#e5484d',
  discomfort: '#2f7d6d',
  burning: '#f27a2f',
  swelling: '#8f5cf6',
  stiffness: '#2f7d6d',
  tingling: '#315f8f',
  wound: '#b72d3a',
  general_symptom: '#2f7d6d',
  measurement: '#5b6b74',
  note: '#5b6b74',
  medication: '#5b6b74',
  document: '#5b6b74',
  other: '#5b6b74',
  sexual_activity: '#5b6b74',
  masturbation: '#5b6b74',
  allergy: '#5b6b74',
  vision_prescription: '#5b6b74',
  digestive_health: '#5b6b74',
  dental_care: '#5b6b74',
}

export function markerColorForEvent(event: HealthEvent): string {
  if ((event.intensity ?? 0) >= 8) return '#ff385c'
  return EVENT_TYPE_COLORS[event.type] ?? '#2f7d6d'
}

export function markersForEvents(events: HealthEvent[]): BodyEventMarker[] {
  const markers: BodyEventMarker[] = []
  for (const event of events) {
    const point = event.bodyPoint
    if (!point || point.modelVersion !== WEB_BODY_MODEL_VERSION) continue
    markers.push({ eventId: event.id, x: point.x, y: point.y, z: point.z, color: markerColorForEvent(event) })
  }
  return markers
}

export function regionCountsForEvents(events: HealthEvent[]): Map<BodyRegionId, { count: number; maxIntensity: number }> {
  const counts = new Map<BodyRegionId, { count: number; maxIntensity: number }>()
  for (const event of events) {
    if (!event.bodyRegionId) continue
    const current = counts.get(event.bodyRegionId) ?? { count: 0, maxIntensity: 0 }
    current.count += 1
    current.maxIntensity = Math.max(current.maxIntensity, event.intensity ?? 0)
    counts.set(event.bodyRegionId, current)
  }
  return counts
}
