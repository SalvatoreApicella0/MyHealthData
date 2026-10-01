import { db } from './db'
import type { AttachmentBlobRecord, SyncOutboxEntry } from './db'
import { blobArrayBuffer, sha256Hex } from '../core/attachmentIntegrity'
import { sortCanonicalRecords } from '../core/canonicalOrdering'
import { parseHealthDataSnapshot } from '../core/schema'
import type { HealthDataSnapshot, HealthDocument, HealthEvent, LocalProfile, Measurement } from '../core/types'
import {
  HUB_SYNC_RETRY_MAX_BATCH_SIZE,
  hubSyncErrorCode,
  hubSyncRetryAt,
  isHubSyncEntryDue,
} from './hubSyncRetry'

async function readBlobBytes(file: Blob): Promise<ArrayBuffer> {
  return blobArrayBuffer(file)
}

async function validateAttachmentBytes(metadata: NonNullable<HealthDocument['attachment']>, bytes: ArrayBuffer): Promise<void> {
  if (bytes.byteLength !== metadata.size) throw new Error('attachment_size_mismatch')
  if (!metadata.sha256) return
  const actual = await sha256Hex(new Blob([bytes], { type: metadata.type }))
  if (actual && actual.toLowerCase() !== metadata.sha256.toLowerCase()) throw new Error('attachment_hash_mismatch')
}

export async function getSnapshot(): Promise<HealthDataSnapshot> {
  const [profile, events, measurements, documents, canonical] = await Promise.all([
    db.profile.get('local-profile'),
    db.events.orderBy('occurredAt').reverse().toArray(),
    db.measurements.orderBy('measuredAt').reverse().toArray(),
    db.documents.orderBy('documentDate').reverse().toArray(),
    db.canonicalSnapshot.get('ios-canonical'),
  ])

  const canonicalData = Object.fromEntries(
    Object.entries(canonical?.data ?? {}).map(([domain, value]) => [
      domain,
      Array.isArray(value)
        ? sortCanonicalRecords(domain, value as Array<Record<string, unknown>>)
        : value,
    ]),
  )
  return { ...canonicalData, profile, events, measurements, documents } as HealthDataSnapshot
}

/** Reads only the requested snapshot parts after a targeted domain refresh. */
export async function getSnapshotParts(domains: readonly string[]): Promise<Partial<HealthDataSnapshot>> {
  const unique = new Set(domains)
  const next: Partial<HealthDataSnapshot> = {}
  const reads: Promise<void>[] = []
  if (unique.has('profile')) reads.push(db.profile.get('local-profile').then((value) => { next.profile = value }))
  if (unique.has('events')) reads.push(db.events.orderBy('occurredAt').reverse().toArray().then((value) => { next.events = value }))
  if (unique.has('measurements')) reads.push(db.measurements.orderBy('measuredAt').reverse().toArray().then((value) => { next.measurements = value }))
  if (unique.has('documents')) reads.push(db.documents.orderBy('documentDate').reverse().toArray().then((value) => { next.documents = value }))

  const canonicalDomains = [...unique].filter((domain) => !['profile', 'events', 'measurements', 'documents'].includes(domain))
  if (canonicalDomains.length > 0) {
    reads.push(db.canonicalSnapshot.get('ios-canonical').then((canonical) => {
      const data = (canonical?.data ?? {}) as Record<string, unknown>
      for (const domain of canonicalDomains) {
        if (Object.prototype.hasOwnProperty.call(data, domain)) {
          const value = data[domain]
          next[domain] = Array.isArray(value)
            ? sortCanonicalRecords(domain, value as Array<Record<string, unknown>>) as never
            : value as never
        }
      }
    }))
  }
  await Promise.all(reads)
  return next
}

export async function saveProfile(profile: LocalProfile): Promise<void> {
  await db.profile.put(profile)
}

export async function saveEvent(event: HealthEvent): Promise<void> {
  await db.events.put(event)
}

export async function queueHubSync(entry: Omit<SyncOutboxEntry, 'id' | 'createdAt'>): Promise<void> {
  const id = `${entry.domain}:${entry.recordId}`
  // One deterministic key per domain/record is the idempotency boundary. A
  // newer local mutation replaces the old payload and gets an immediate,
  // fresh delivery attempt instead of inheriting stale backoff state.
  await db.syncOutbox.put({
    ...entry,
    id,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    nextAttemptAt: Date.now(),
    lastAttemptAt: undefined,
    lastError: undefined,
  })
}

export async function getHubSyncQueue(): Promise<SyncOutboxEntry[]> {
  return db.syncOutbox.orderBy('createdAt').toArray()
}

/** Make one user-requested retry immediately claimable without resetting its backoff history. */
export async function forceHubSyncRetry(domain: string, recordId: string): Promise<boolean> {
  const id = `${domain}:${recordId}`
  return db.transaction('rw', db.syncOutbox, async () => {
    const current = await db.syncOutbox.get(id)
    if (!current) return false
    await db.syncOutbox.put({ ...current, nextAttemptAt: Date.now(), lastError: undefined })
    return true
  })
}

export async function getDueHubSyncQueue(now = Date.now(), limit = HUB_SYNC_RETRY_MAX_BATCH_SIZE): Promise<SyncOutboxEntry[]> {
  const boundedLimit = Math.max(1, Math.floor(limit))
  const indexedDue = await db.syncOutbox.where('nextAttemptAt').belowOrEqual(now).toArray()
  const legacyDue = indexedDue.length >= boundedLimit
    ? []
    : await db.syncOutbox.toCollection().filter((entry) => typeof entry.nextAttemptAt !== 'number').toArray()

  return [...indexedDue, ...legacyDue]
    .filter((entry) => isHubSyncEntryDue(entry, now))
    .sort((lhs, rhs) => lhs.createdAt.localeCompare(rhs.createdAt) || lhs.id.localeCompare(rhs.id))
    .slice(0, boundedLimit)
}

/** Claims one entry before network I/O, preventing duplicate work after a
 * second lifecycle event or a second refresh in the same browser context. */
export async function claimHubSync(id: string, now = Date.now()): Promise<SyncOutboxEntry | undefined> {
  return db.transaction('rw', db.syncOutbox, async () => {
    const current = await db.syncOutbox.get(id)
    if (!current || !isHubSyncEntryDue(current, now)) return undefined
    const retryCount = (current.retryCount ?? 0) + 1
    const claimed: SyncOutboxEntry = {
      ...current,
      retryCount,
      lastAttemptAt: now,
      nextAttemptAt: hubSyncRetryAt(now, retryCount),
      lastError: undefined,
    }
    await db.syncOutbox.put(claimed)
    return claimed
  })
}

export async function markHubSyncFailure(id: string, attemptAt: number, cause: unknown): Promise<void> {
  await db.transaction('rw', db.syncOutbox, async () => {
    const current = await db.syncOutbox.get(id)
    // A newer local mutation owns this id now; do not overwrite its retry
    // state with the result of an older in-flight upload.
    if (!current || current.lastAttemptAt !== attemptAt) return
    await db.syncOutbox.put({ ...current, lastError: hubSyncErrorCode(cause) })
  })
}

export async function removeHubSync(id: string, expectedAttemptAt?: number): Promise<boolean> {
  if (expectedAttemptAt === undefined) {
    const current = await db.syncOutbox.get(id)
    await db.syncOutbox.delete(id)
    return current !== undefined
  }
  return db.transaction('rw', db.syncOutbox, async () => {
    const current = await db.syncOutbox.get(id)
    if (current?.lastAttemptAt !== expectedAttemptAt) return false
    await db.syncOutbox.delete(id)
    return true
  })
}

export async function deleteEvent(eventId: string): Promise<void> {
  const event = await db.events.get(eventId)
  await db.transaction('rw', [db.events, db.attachments], async () => {
    await db.events.delete(eventId)
    for (const attachment of event?.attachments ?? []) {
      await db.attachments.delete(attachment.id)
    }
  })
}

export async function saveMeasurement(measurement: Measurement): Promise<void> {
  await db.measurements.put(measurement)
}

export async function deleteMeasurement(measurementId: string): Promise<void> {
  await db.measurements.delete(measurementId)
}

export async function saveDocument(document: HealthDocument, file?: Blob | ArrayBuffer): Promise<void> {
  const previous = await db.documents.get(document.id)
  await db.transaction('rw', [db.documents, db.attachments], async () => {
    await db.documents.put(document)
    if (previous?.attachment && previous.attachment.id !== document.attachment?.id) {
      await db.attachments.delete(previous.attachment.id)
    }
    if (file && document.attachment) {
      const bytes = file instanceof ArrayBuffer ? file : await readBlobBytes(file)
      await validateAttachmentBytes(document.attachment, bytes)
      const record: AttachmentBlobRecord = { ...document.attachment, data: bytes, storedAt: document.attachment.storedAt ?? new Date().toISOString() }
      await db.attachments.put(record)
    }
  })
}

export async function deleteDocument(documentId: string): Promise<void> {
  const document = await db.documents.get(documentId)
  await db.transaction('rw', [db.documents, db.attachments], async () => {
    await db.documents.delete(documentId)
    if (document?.attachment) await db.attachments.delete(document.attachment.id)
  })
}

export async function getAttachmentBlob(attachmentId: string): Promise<Blob | undefined> {
  const record = await db.attachments.get(attachmentId)
  return record ? new Blob([record.data], { type: record.type || 'application/octet-stream' }) : undefined
}

export async function saveAttachmentBlob(metadata: HealthDocument['attachment'], file: Blob): Promise<void> {
  if (!metadata) return
  const bytes = await readBlobBytes(file)
  await validateAttachmentBytes(metadata, bytes)
  const record: AttachmentBlobRecord = { ...metadata, data: bytes, storedAt: metadata.storedAt ?? new Date().toISOString() }
  await db.attachments.put(record)
}

export async function replaceSnapshot(snapshot: HealthDataSnapshot): Promise<void> {
  const parsed = parseHealthDataSnapshot(snapshot)

  await db.transaction('rw', [db.profile, db.events, db.measurements, db.documents, db.attachments, db.canonicalSnapshot, db.syncOutbox], async () => {
    await Promise.all([db.profile.clear(), db.events.clear(), db.measurements.clear(), db.documents.clear(), db.attachments.clear(), db.syncOutbox.clear()])

    if (parsed.profile) {
      await db.profile.put(parsed.profile)
    }

    await Promise.all([
      db.events.bulkPut(parsed.events),
      db.measurements.bulkPut(parsed.measurements),
      db.documents.bulkPut(parsed.documents),
      db.canonicalSnapshot.put({ id: 'ios-canonical', data: parsed as Record<string, unknown>, updatedAt: new Date().toISOString() }),
    ])
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.profile, db.events, db.measurements, db.documents, db.attachments, db.canonicalSnapshot, db.syncOutbox], async () => {
    await Promise.all([db.profile.clear(), db.events.clear(), db.measurements.clear(), db.documents.clear(), db.attachments.clear(), db.canonicalSnapshot.clear(), db.syncOutbox.clear()])
  })
}

/* ------------------------------------------------------- canonical domains */

const CANONICAL_DOMAIN_PATTERN = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/

function assertCanonicalDomain(domain: string): void {
  if (!CANONICAL_DOMAIN_PATTERN.test(domain)) {
    throw new Error('Invalid canonical domain.')
  }
}

async function updateCanonicalDomain(
  domain: string,
  update: (current: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
): Promise<void> {
  assertCanonicalDomain(domain)
  await db.transaction('rw', db.canonicalSnapshot, async () => {
    const existing = await db.canonicalSnapshot.get('ios-canonical')
    const data = (existing?.data ?? {}) as Record<string, unknown>
    const current = Array.isArray(data[domain]) ? (data[domain] as Array<Record<string, unknown>>) : []
    const next = update(current)

    await db.canonicalSnapshot.put({
      id: 'ios-canonical',
      data: { ...data, [domain]: sortCanonicalRecords(domain, next) },
      updatedAt: new Date().toISOString(),
    })
  })
}

/**
 * Writes one record of a canonical iOS domain (appointments, cycleEntries,
 * sleepSessions, foodLogEntries, gymWorkouts, medications, medicationDoseEvents,
 * conditionEpisodes, conditionCheckIns, labResults...).
 *
 * The Web vault keeps the canonical graph in a single encrypted-export-friendly
 * blob so unknown domains and unknown fields survive untouched, exactly as
 * `docs/hub/IOS_WEB_PARITY.md` requires.
 */
export async function saveCanonicalRecord(domain: string, record: Record<string, unknown>): Promise<void> {
  if (typeof record.id !== 'string' || record.id.length === 0) {
    throw new Error('Canonical records need a string id.')
  }

  await updateCanonicalDomain(domain, (current) => {
    const index = current.findIndex((entry) => entry?.id === record.id)
    return index >= 0 ? current.map((entry, position) => (position === index ? record : entry)) : [...current, record]
  })
}

export async function deleteCanonicalRecord(domain: string, id: string): Promise<void> {
  await updateCanonicalDomain(domain, (current) => {
    return current.filter((entry) => entry?.id !== id)
  })
}

export async function getCanonicalDomain(domain: string): Promise<Array<Record<string, unknown>>> {
  assertCanonicalDomain(domain)

  if (domain === 'events') {
    return (await db.events.toArray()) as unknown as Array<Record<string, unknown>>
  }

  if (domain === 'documents') {
    return (await db.documents.toArray()) as unknown as Array<Record<string, unknown>>
  }

  const existing = await db.canonicalSnapshot.get('ios-canonical')
  const data = (existing?.data ?? {}) as Record<string, unknown>
  return Array.isArray(data[domain])
    ? sortCanonicalRecords(domain, data[domain] as Array<Record<string, unknown>>)
    : []
}

/**
 * Replaces one domain wholesale, used by the Hub change merge. Events and
 * documents live in their own tables (`getSnapshot` overrides the canonical
 * blob with them), so they are written there instead of the blob.
 */
export async function replaceCanonicalDomain(domain: string, records: Array<Record<string, unknown>>): Promise<void> {
  assertCanonicalDomain(domain)

  if (domain === 'events') {
    await db.transaction('rw', db.events, async () => {
      await db.events.clear()
      if (records.length > 0) await db.events.bulkPut(records as never[])
    })
    return
  }

  if (domain === 'documents') {
    await db.transaction('rw', db.documents, async () => {
      await db.documents.clear()
      if (records.length > 0) await db.documents.bulkPut(records as never[])
    })
    return
  }

  await updateCanonicalDomain(domain, () => records)
}
