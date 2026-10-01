import type { AttachmentMetadata, HealthDocument, HealthEvent, Measurement } from '../core/types'
import { deleteHubMeasurement, deleteHubRecord, saveHubAttachment, saveHubMeasurement, saveHubRecord } from './hubRepository'
import { getAttachmentBlob, getDueHubSyncQueue, getHubSyncQueue, markHubSyncFailure, claimHubSync, removeHubSync, saveDocument, saveEvent } from './repository'
import { HUB_SYNC_RETRY_CONCURRENCY } from './hubSyncRetry'
import { isDocumentSyncConfirmed } from './syncStatus'

/** Flushes a bounded batch of local intents while preserving newer mutations. */
let hubSyncFlushInFlight: Promise<Set<string>> | undefined

export async function flushHubSyncQueue(): Promise<Set<string>> {
  if (hubSyncFlushInFlight) return hubSyncFlushInFlight
  const run = async () => {
    const pending = await getDueHubSyncQueue()
    const confirmedDocuments = new Set<string>()
    const flushEntry = async (entry: Awaited<ReturnType<typeof getHubSyncQueue>>[number]) => {
      const claimed = await claimHubSync(entry.id)
      if (!claimed) return
      const attemptAt = claimed.lastAttemptAt
      if (attemptAt === undefined) return
      try {
        let recordToPersist: Record<string, unknown> | undefined
        if (claimed.domain === 'measurements') {
          if (claimed.operation === 'delete') await deleteHubMeasurement(claimed.recordId)
          else if (claimed.record) await saveHubMeasurement(claimed.record as unknown as Measurement)
        } else if (claimed.operation === 'delete') {
          try {
            await deleteHubRecord(claimed.domain, claimed.recordId)
          } catch (cause) {
            if (!(cause instanceof Error && cause.message === 'record_not_found')) throw cause
          }
        } else if (claimed.record) {
          let record = claimed.record
          const attachmentRecords: Array<{ id: string; metadata: AttachmentMetadata }> = []
          if (claimed.attachmentId && claimed.record.attachment && typeof claimed.record.attachment === 'object') {
            attachmentRecords.push({ id: claimed.attachmentId, metadata: claimed.record.attachment as AttachmentMetadata })
          }
          if (Array.isArray(claimed.record.attachments)) {
            for (const value of claimed.record.attachments) {
              if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).id === 'string') {
                const metadata = value as AttachmentMetadata
                attachmentRecords.push({ id: metadata.id, metadata })
              }
            }
          }
          for (const { id, metadata } of attachmentRecords) {
            const attachment = await getAttachmentBlob(id)
            if (!attachment) throw new Error('attachment_missing_locally')
            const storedAttachment = await saveHubAttachment(metadata, attachment)
            const nextAttachment = { ...metadata, ...storedAttachment }
            if (record.attachment && typeof record.attachment === 'object' && (record.attachment as Record<string, unknown>).id === id) {
              record = { ...record, attachment: nextAttachment }
            }
            if (Array.isArray(record.attachments)) {
              record = {
                ...record,
                attachments: record.attachments.map((value) => value && typeof value === 'object' && (value as Record<string, unknown>).id === id ? nextAttachment : value),
              }
            }
          }
          const acknowledged = await saveHubRecord(claimed.domain, record)
          if (claimed.domain === 'documents' && !isDocumentSyncConfirmed(claimed.recordId, record, acknowledged)) {
            throw new Error('document_sync_unconfirmed')
          }
          // Keep the local graph aligned with the metadata returned by Hub,
          // including hashes generated during an offline retry.
          recordToPersist = record
        }
        const completed = await removeHubSync(claimed.id, attemptAt)
        // A newer local mutation may have replaced this outbox row while the
        // network request was running. Its local graph must win over the old
        // server response, and its new outbox intent must remain queued.
        if (!completed || !recordToPersist) return
        if (claimed.domain === 'events') await saveEvent(recordToPersist as unknown as HealthEvent)
        if (claimed.domain === 'documents') {
          await saveDocument(recordToPersist as unknown as HealthDocument)
          confirmedDocuments.add(claimed.recordId)
        }
      } catch (cause) {
        // Keep the intent for the next refresh. No PHI is logged and one failed
        // attachment must not prevent unrelated records from retrying.
        await markHubSyncFailure(claimed.id, attemptAt, cause)
      }
    }
    // Attachments and records are independent intents. Keep a small window so
    // a slow PDF upload cannot serialize every other offline change, while
    // avoiding an unbounded burst against the local Hub.
    const concurrency = HUB_SYNC_RETRY_CONCURRENCY
    for (let index = 0; index < pending.length; index += concurrency) {
      await Promise.all(pending.slice(index, index + concurrency).map(flushEntry))
    }
    return confirmedDocuments
  }
  hubSyncFlushInFlight = run().finally(() => {
    hubSyncFlushInFlight = undefined
  })
  return hubSyncFlushInFlight
}
