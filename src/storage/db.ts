import Dexie, { type Table } from 'dexie'
import type { AttachmentMetadata, HealthDocument, HealthEvent, LocalProfile, Measurement } from '../core/types'

export interface CanonicalSnapshotRecord { id: 'ios-canonical'; data: Record<string, unknown>; updatedAt: string }
export interface AttachmentBlobRecord extends AttachmentMetadata { data: ArrayBuffer }
export interface SyncOutboxEntry {
  id: string
  domain: string
  operation: 'upsert' | 'delete'
  record?: Record<string, unknown>
  recordId: string
  attachmentId?: string
  createdAt: string
  /** Number of claimed delivery attempts; retained across reloads. */
  retryCount?: number
  /** Epoch milliseconds after which another claim is allowed. */
  nextAttemptAt?: number
  /** Epoch milliseconds of the most recent claim. */
  lastAttemptAt?: number
  /** Safe error code only; never a raw network/error message. */
  lastError?: string
}

export class MyHealthDataDatabase extends Dexie {
  profile!: Table<LocalProfile, string>
  events!: Table<HealthEvent, string>
  measurements!: Table<Measurement, string>
  documents!: Table<HealthDocument, string>
  attachments!: Table<AttachmentBlobRecord, string>
  canonicalSnapshot!: Table<CanonicalSnapshotRecord, string>
  syncOutbox!: Table<SyncOutboxEntry, string>

  constructor() {
    super('myhealthdata-v01')

    this.version(1).stores({
      profile: '&id, updatedAt',
      events: '&id, type, bodyRegionId, occurredAt, updatedAt',
      measurements: '&id, type, measuredAt, createdAt',
      documents: '&id, documentType, documentDate, bodyRegionId, updatedAt',
    })
    this.version(2).stores({ canonicalSnapshot: '&id, updatedAt' })
    this.version(3).stores({ attachments: '&id, storedAt' })
    this.version(4).stores({ syncOutbox: '&id, createdAt, domain, recordId' })
    this.version(5).stores({ syncOutbox: '&id, createdAt, domain, recordId, nextAttemptAt' })
  }
}

export const db = new MyHealthDataDatabase()
