/**
 * Incremental Hub → Web sync for the canonical snapshot domains.
 *
 * Body measurements have their own endpoints; every other `MHDDataSnapshot`
 * domain (appointments, cycle, sleep, nutrition, gym, medications, condition
 * episodes/check-ins, labs) is replicated through the generic record API. The
 * per-domain cursor is persisted so a reconnect only downloads new revisions and
 * tombstones (see `docs/hub/IOS_WEB_PARITY.md`, invariant 3).
 */

import { CANONICAL_DOMAIN_SPECS } from '../core/canonicalDomains'
import { classifyAttachment } from '../core/attachmentIntegrity'
import type { AttachmentMetadata } from '../core/types'
import { getAttachmentBlob, getCanonicalDomain, replaceCanonicalDomain, saveAttachmentBlob } from './repository'
import { getHubAttachment, getHubRecordChanges } from './hubRepository'
import { mergeHubDomain } from './hubCanonical'

const CURSOR_KEY = 'mhd.hub.canonical-cursors'
const ATTACHMENT_RETRY_KEY = 'mhd.hub.attachment-retries'
const MAX_PAGES = 1000

// Canonical array domains without a Web editor yet still replicate through the
// generic record API so an iOS-created recipe or plan is not lost. Events and
// documents live in dedicated tables but use the same record replication.
const READ_ONLY_CANONICAL_DOMAINS = ['foodRecipes', 'gymPlans', 'events', 'documents']
const ATTACHMENT_WARMUP_CONCURRENCY = 4
const attachmentWarmups = new Map<string, Promise<boolean>>()
const ATTACHMENT_DOMAINS = ['events', 'documents'] as const
type AttachmentDomain = (typeof ATTACHMENT_DOMAINS)[number]
type AttachmentRetryState = Record<AttachmentDomain, Set<string>>
let lastDocumentSyncResult: { confirmed: string[]; removed: string[] } = { confirmed: [], removed: [] }
let lastCanonicalSyncFailedDomains: string[] = []

export const canonicalSyncDomains = [
  ...new Set([...Object.keys(CANONICAL_DOMAIN_SPECS), ...READ_ONLY_CANONICAL_DOMAINS]),
]

function readCursors(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CURSOR_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    const cursors: Record<string, number> = {}
    for (const [domain, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        cursors[domain] = value
      }
    }
    return cursors
  } catch {
    return {}
  }
}

function writeCursors(cursors: Record<string, number>): void {
  try {
    localStorage.setItem(CURSOR_KEY, JSON.stringify(cursors))
  } catch {
    /* storage disabled: sync still works, it just restarts from zero next time */
  }
}

function emptyAttachmentRetryState(): AttachmentRetryState {
  return { events: new Set(), documents: new Set() }
}

function readAttachmentRetries(): AttachmentRetryState {
  const state = emptyAttachmentRetryState()
  try {
    const raw = localStorage.getItem(ATTACHMENT_RETRY_KEY)
    const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    for (const domain of ATTACHMENT_DOMAINS) {
      const values = parsed[domain]
      if (Array.isArray(values)) {
        state[domain] = new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))
      }
    }
  } catch {
    /* A missing queue only delays a retry; it must never block the vault. */
  }
  return state
}

function writeAttachmentRetries(state: AttachmentRetryState): void {
  try {
    localStorage.setItem(ATTACHMENT_RETRY_KEY, JSON.stringify({
      events: [...state.events].sort(),
      documents: [...state.documents].sort(),
    }))
  } catch {
    /* storage disabled: the current pull still completes safely */
  }
}

function isAttachmentDomain(domain: string): domain is AttachmentDomain {
  return ATTACHMENT_DOMAINS.includes(domain as AttachmentDomain)
}

/**
 * Pulls new revisions and tombstones for each canonical domain and applies them
 * to the local vault. Returns the number of changes applied.
 */
interface DomainSyncResult {
  applied: number
  cursor: number
  domain: string
  confirmedDocumentIds: string[]
  removedDocumentIds: string[]
  attachmentRetryRecordIds?: string[]
}

function warmAttachment(metadata: AttachmentMetadata): Promise<boolean> {
  const running = attachmentWarmups.get(metadata.id)
  if (running) return running

  const job = (async () => {
    const local = await getAttachmentBlob(metadata.id)
    if (local && local.size === metadata.size && await classifyAttachment(local, metadata.sha256) === 'ok') return true

    const blob = await getHubAttachment(metadata.id)
    if (blob.size !== metadata.size) throw new Error('attachment_size_mismatch')
    if (await classifyAttachment(blob, metadata.sha256) !== 'ok') throw new Error('attachment_hash_mismatch')
    await saveAttachmentBlob(metadata, blob)
    return true
  })().catch(() => false).finally(() => {
    attachmentWarmups.delete(metadata.id)
  })
  attachmentWarmups.set(metadata.id, job)
  return job
}

async function warmAttachments(attachments: AttachmentMetadata[]): Promise<Set<string>> {
  const unique = [...new Map(attachments.map((attachment) => [attachment.id, attachment])).values()]
  const verified = new Set<string>()
  for (let index = 0; index < unique.length; index += ATTACHMENT_WARMUP_CONCURRENCY) {
    const batch = await Promise.all(unique.slice(index, index + ATTACHMENT_WARMUP_CONCURRENCY).map(async (attachment) => [attachment.id, await warmAttachment(attachment)] as const))
    for (const [id, ok] of batch) if (ok) verified.add(id)
  }
  return verified
}

function attachmentsForRecord(record: Record<string, unknown>): AttachmentMetadata[] {
  const candidates: unknown[] = []
  if (record.attachment && typeof record.attachment === 'object') candidates.push(record.attachment)
  if (Array.isArray(record.attachments)) candidates.push(...record.attachments)
  return candidates.filter((value): value is AttachmentMetadata => (
    Boolean(value)
    && typeof value === 'object'
    && typeof (value as { id?: unknown }).id === 'string'
    && (value as { id: string }).id.length > 0
  ))
}

interface RecordAttachmentStatus {
  isWarm: boolean
  isConfirmed: boolean
}

async function warmRecordAttachments(records: readonly Record<string, unknown>[]): Promise<Map<string, RecordAttachmentStatus>> {
  const attachmentsByRecord = new Map<string, AttachmentMetadata[]>()
  for (const record of records) {
    if (typeof record.id !== 'string') continue
    attachmentsByRecord.set(record.id, attachmentsForRecord(record))
  }

  const verified = await warmAttachments([...attachmentsByRecord.values()].flat())
  return new Map([...attachmentsByRecord.entries()].map(([id, attachments]) => [id, {
    isWarm: attachments.every((attachment) => verified.has(attachment.id)),
    isConfirmed: attachments.every((attachment) => (
      typeof attachment.sha256 === 'string'
      && attachment.sha256.length === 64
      && verified.has(attachment.id)
    )),
  }]))
}

async function syncCanonicalDomain(
  domain: string,
  initialCursor: number,
  initialAttachmentRetries: ReadonlySet<string> = new Set(),
): Promise<DomainSyncResult> {
  let since = initialCursor
  let applied = 0
  const confirmedDocumentIds: string[] = []
  const removedDocumentIds: string[] = []
  const attachmentRetries = isAttachmentDomain(domain) ? new Set(initialAttachmentRetries) : undefined
  const retryCandidates = new Set(initialAttachmentRetries)
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await getHubRecordChanges(domain, since)
    let merged: Array<Record<string, unknown>> | undefined
    if (result.changes.length > 0) {
      const local = await getCanonicalDomain(domain)
      merged = mergeHubDomain(local, result.changes.map((change) => change.record))
      // Dedicated event/document tables are materialized by this single bulk
      // replacement. Replaying the same changes record by record would only
      // duplicate IndexedDB writes and cannot change the merged result.
      await replaceCanonicalDomain(domain, merged)
      applied += result.changes.length
    }

    if (attachmentRetries) {
      const changedIDs = new Set(result.changes.map((change) => change.record.id))
      const retryIDs = new Set([...retryCandidates, ...changedIDs])
      const records = (merged ?? (retryIDs.size > 0 ? await getCanonicalDomain(domain) : []))
        .filter((record) => typeof record.id === 'string' && retryIDs.has(record.id))
      const statuses = await warmRecordAttachments(records)
      const presentIDs = new Set(records.map((record) => record.id as string))

      for (const id of retryCandidates) {
        if (!presentIDs.has(id)) {
          attachmentRetries.delete(id)
          retryCandidates.delete(id)
        }
      }
      for (const [id, status] of statuses) {
        retryCandidates.delete(id)
        if (status.isWarm) attachmentRetries.delete(id)
        else attachmentRetries.add(id)
        if (domain === 'documents' && status.isConfirmed) confirmedDocumentIds.push(id)
      }
      for (const change of result.changes) {
        if (change.record.deleted !== true) continue
        attachmentRetries.delete(change.record.id)
        if (domain === 'documents') removedDocumentIds.push(change.record.id)
      }
    }

    if (result.nextCursor <= since) {
      since = Math.max(since, result.nextCursor)
      break
    }
    since = result.nextCursor
  }
  return {
    applied,
    cursor: since,
    domain,
    confirmedDocumentIds,
    removedDocumentIds,
    attachmentRetryRecordIds: attachmentRetries ? [...attachmentRetries].sort() : undefined,
  }
}

export async function syncCanonicalDomainsFromHub(domains: string[] = canonicalSyncDomains): Promise<number> {
  lastDocumentSyncResult = { confirmed: [], removed: [] }
  lastCanonicalSyncFailedDomains = []
  const cursors = readCursors()
  const attachmentRetries = readAttachmentRetries()
  const uniqueDomains = [...new Set(domains)]
  // Domains are independent tables. Keep pagination ordered within each table,
  // but pull different tables concurrently so one slow domain does not delay
  // the rest of the initial snapshot.
  const settled = await Promise.allSettled(uniqueDomains.map((domain) => syncCanonicalDomain(
    domain,
    cursors[domain] ?? 0,
    isAttachmentDomain(domain) ? attachmentRetries[domain] : undefined,
  )))
  const results = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  lastCanonicalSyncFailedDomains = settled.flatMap((result, index) => result.status === 'rejected' ? [uniqueDomains[index]!] : [])
  for (const result of results) {
    cursors[result.domain] = result.cursor
    if (isAttachmentDomain(result.domain) && result.attachmentRetryRecordIds) {
      attachmentRetries[result.domain] = new Set(result.attachmentRetryRecordIds)
    }
  }
  lastDocumentSyncResult = {
    confirmed: [...new Set(results.flatMap((result) => result.confirmedDocumentIds))],
    removed: [...new Set(results.flatMap((result) => result.removedDocumentIds))],
  }
  writeCursors(cursors)
  writeAttachmentRetries(attachmentRetries)
  return results.reduce((total, result) => total + result.applied, 0)
}

/** Failed domain names only; never expose remote error payloads or record data. */
export function getLastCanonicalSyncFailedDomains(): readonly string[] {
  return [...lastCanonicalSyncFailedDomains]
}

export function getLastDocumentSyncResult(): { confirmed: readonly string[]; removed: readonly string[] } {
  return { confirmed: [...lastDocumentSyncResult.confirmed], removed: [...lastDocumentSyncResult.removed] }
}
