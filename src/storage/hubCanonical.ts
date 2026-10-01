/**
 * Helpers for Hub ↔ Web canonical domain replication.
 *
 * The Hub stores each record with envelope metadata (`createdAt`, `updatedAt`,
 * `originDeviceId`, `provenance`, `revision`, `deleted`) that is not part of the
 * canonical iOS snapshot. `createdAt` and `updatedAt` are also canonical iOS
 * fields, so the Hub timestamps are restored under those names when the Hub
 * has stripped client payload fields. The remaining bookkeeping never leaks
 * into `MHDDataSnapshot`.
 */

export interface HubRecord {
  id: string
  revision?: number
  deleted?: boolean
  [key: string]: unknown
}

const HUB_ENVELOPE_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'originDeviceId',
  'provenance',
  'revision',
  'deleted',
])

export function stripHubEnvelope(record: HubRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    if (!HUB_ENVELOPE_KEYS.has(key)) {
      payload[key] = value
    }
  }
  for (const key of ['createdAt', 'updatedAt']) {
    if (typeof record[key] === 'string') payload[key] = record[key]
  }
  return payload
}

/**
 * Applies Hub changes (upserts and tombstones) on top of the local domain.
 * Local records that the Hub does not mention are kept: a missing record is not
 * a deletion (see `docs/hub/SYNC_PROTOCOL.md`).
 */
export function mergeHubDomain(
  local: unknown,
  changes: HubRecord[],
): Array<Record<string, unknown>> {
  const base = Array.isArray(local) ? (local as Array<Record<string, unknown>>) : []
  const byId = new Map<string, Record<string, unknown>>()
  for (const record of base) {
    if (typeof record?.id === 'string') {
      byId.set(record.id, record)
    }
  }
  for (const record of changes) {
    if (typeof record?.id !== 'string') {
      continue
    }
    if (record.deleted) {
      byId.delete(record.id)
    } else {
      byId.set(record.id, stripHubEnvelope(record))
    }
  }
  return [...byId.values()]
}
