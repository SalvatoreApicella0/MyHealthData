import type { HealthEvent } from './types'

const cache = new WeakMap<readonly HealthEvent[], Map<string, string>>()

export function eventSubsetSignature(events: readonly HealthEvent[], eventTypes: readonly string[]): string {
  let signatures = cache.get(events)
  if (!signatures) {
    signatures = new Map<string, string>()
    cache.set(events, signatures)
  }
  const key = eventTypes.join('|')
  const cached = signatures.get(key)
  if (cached !== undefined) return cached
  const allowed = new Set(eventTypes)
  const signature = events.filter((event) => allowed.has(event.type)).map((event) => [
    event.id, event.type, event.occurredAt, event.updatedAt, event.description,
    event.tags.join(','), event.attachments.map((attachment) => attachment.id).join(','),
  ].map((part) => String(part ?? '')).join(':')).sort().join('|')
  signatures.set(key, signature)
  return signature
}

export function eventsForTypes(events: readonly HealthEvent[], eventTypes: readonly string[]): HealthEvent[] {
  const allowed = new Set(eventTypes)
  return events.filter((event) => allowed.has(event.type))
}
