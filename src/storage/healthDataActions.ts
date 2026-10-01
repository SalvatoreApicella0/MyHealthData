import type { AttachmentMetadata, HealthDataSnapshot, HealthDocument, HealthEvent, LocalProfile, Measurement } from '../core/types'
import {
  deleteCanonicalRecord as deleteLocalCanonicalRecord,
  deleteDocument as deleteLocalDocument,
  deleteEvent as deleteLocalEvent,
  deleteMeasurement as deleteLocalMeasurement,
  getAttachmentBlob,
  queueHubSync,
  saveAttachmentBlob,
  saveCanonicalRecord as saveLocalCanonicalRecord,
  saveDocument as saveLocalDocument,
  saveEvent as saveLocalEvent,
  saveMeasurement as saveLocalMeasurement,
  saveProfile as saveLocalProfile,
} from './repository'
import { deleteHubMeasurement, deleteHubRecord, saveHubAttachment, saveHubMeasurement, saveHubRecord } from './hubRepository'
import { isDocumentSyncConfirmed } from './syncStatus'

export interface HealthAttachmentInput {
  metadata: AttachmentMetadata
  file: Blob | ArrayBuffer
}

export interface HealthDataActionContext {
  hubMode: boolean
  snapshot: HealthDataSnapshot
  onDocumentConfirmed: (documentId: string) => void
}

export interface HealthDataActions {
  saveProfile: (profile: LocalProfile) => Promise<void>
  saveEvent: (event: HealthEvent, attachments?: HealthAttachmentInput[]) => Promise<void>
  deleteEvent: (eventId: string) => Promise<void>
  saveMeasurement: (measurement: Measurement) => Promise<void>
  deleteMeasurement: (measurementId: string) => Promise<void>
  saveDocument: (document: HealthDocument, file?: Blob | ArrayBuffer) => Promise<void>
  deleteDocument: (documentId: string) => Promise<void>
  saveCanonicalRecord: (domain: string, record: Record<string, unknown>) => Promise<void>
  deleteCanonicalRecord: (domain: string, id: string) => Promise<void>
}

/**
 * Coordinates local writes with best-effort Hub delivery. The local repository
 * remains the source of truth: every remote failure becomes an outbox intent.
 */
export function createHealthDataActions({ hubMode, snapshot, onDocumentConfirmed }: HealthDataActionContext): HealthDataActions {
  return {
    saveProfile: (profile) => saveLocalProfile(profile),

    saveEvent: async (event, attachments = []) => {
      await saveLocalEvent(event)
      for (const input of attachments) {
        await saveAttachmentBlob(input.metadata, input.file instanceof Blob ? input.file : new Blob([input.file], { type: input.metadata.type }))
      }

      let syncedEvent = event
      // Events are stored in their own local table, but they are also a
      // canonical Hub domain. Keep the write path symmetrical with the other
      // canonical records so body-pain and symptom entries reach other devices.
      if (hubMode) {
        try {
          if (event.attachments.length > 0) {
            const remoteAttachments = []
            for (const metadata of event.attachments) {
              const file = await getAttachmentBlob(metadata.id)
              if (!file) throw new Error('attachment_missing_locally')
              remoteAttachments.push({ ...metadata, ...(await saveHubAttachment(metadata, file)) })
            }
            syncedEvent = { ...event, attachments: remoteAttachments }
          }
          await saveHubRecord('events', syncedEvent as unknown as Record<string, unknown>)
          if (syncedEvent !== event) await saveLocalEvent(syncedEvent)
        } catch {
          await queueHubSync({ domain: 'events', operation: 'upsert', recordId: event.id, record: syncedEvent as unknown as Record<string, unknown> })
        }
      } else {
        await queueHubSync({ domain: 'events', operation: 'upsert', recordId: event.id, record: event as unknown as Record<string, unknown> })
      }
    },

    deleteEvent: async (eventId) => {
      await deleteLocalEvent(eventId)
      if (hubMode) {
        try { await deleteHubRecord('events', eventId) }
        catch { await queueHubSync({ domain: 'events', operation: 'delete', recordId: eventId }) }
      } else {
        await queueHubSync({ domain: 'events', operation: 'delete', recordId: eventId })
      }
    },

    saveMeasurement: async (measurement) => {
      await saveLocalMeasurement(measurement)
      if (hubMode) {
        try { await saveHubMeasurement(measurement) }
        catch { await queueHubSync({ domain: 'measurements', operation: 'upsert', recordId: measurement.id, record: measurement as unknown as Record<string, unknown> }) }
      } else {
        await queueHubSync({ domain: 'measurements', operation: 'upsert', recordId: measurement.id, record: measurement as unknown as Record<string, unknown> })
      }
    },

    deleteMeasurement: async (measurementId) => {
      await deleteLocalMeasurement(measurementId)
      if (hubMode) {
        try { await deleteHubMeasurement(measurementId) }
        catch { await queueHubSync({ domain: 'measurements', operation: 'delete', recordId: measurementId }) }
      } else {
        await queueHubSync({ domain: 'measurements', operation: 'delete', recordId: measurementId })
      }
    },

    saveDocument: async (document, file) => {
      await saveLocalDocument(document, file)
      let syncedDocument = document
      if (hubMode && document.attachment) {
        const attachment = file instanceof Blob ? file : await getAttachmentBlob(document.attachment.id)
        if (attachment) {
          let storedAttachment
          try {
            storedAttachment = await saveHubAttachment(document.attachment, attachment)
          } catch {
            await queueHubSync({ domain: 'documents', operation: 'upsert', recordId: document.id, record: document as unknown as Record<string, unknown>, attachmentId: document.attachment.id })
            return
          }
          syncedDocument = { ...document, attachment: { ...document.attachment, ...storedAttachment } }
          if (storedAttachment.sha256 && storedAttachment.sha256 !== document.attachment.sha256) await saveLocalDocument(syncedDocument)
        }
      }
      if (!hubMode) {
        await queueHubSync({
          domain: 'documents',
          operation: 'upsert',
          recordId: document.id,
          record: syncedDocument as unknown as Record<string, unknown>,
          attachmentId: syncedDocument.attachment?.id,
        })
        return
      }
      try {
        const acknowledged = await saveHubRecord('documents', syncedDocument as unknown as Record<string, unknown>)
        if (!isDocumentSyncConfirmed(document.id, syncedDocument as unknown as Record<string, unknown>, acknowledged)) {
          await queueHubSync({ domain: 'documents', operation: 'upsert', recordId: document.id, record: syncedDocument as unknown as Record<string, unknown>, attachmentId: syncedDocument.attachment?.id })
        } else {
          onDocumentConfirmed(document.id)
        }
      } catch {
        await queueHubSync({ domain: 'documents', operation: 'upsert', recordId: document.id, record: syncedDocument as unknown as Record<string, unknown>, attachmentId: syncedDocument.attachment?.id })
      }
    },

    deleteDocument: async (documentId) => {
      const linkedLabIds = Array.isArray(snapshot.labResults)
        ? (snapshot.labResults as Array<Record<string, unknown>>)
          .filter((record) => record.linkedDocumentId === documentId)
          .map((record) => record.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
        : []
      await deleteLocalDocument(documentId)
      if (hubMode) {
        try { await deleteHubRecord('documents', documentId) }
        catch (cause) {
          if (!(cause instanceof Error && cause.message === 'record_not_found')) await queueHubSync({ domain: 'documents', operation: 'delete', recordId: documentId })
        }
      } else {
        await queueHubSync({ domain: 'documents', operation: 'delete', recordId: documentId })
      }
      for (const labId of linkedLabIds) {
        await deleteLocalCanonicalRecord('labResults', labId)
        if (hubMode) {
          try { await deleteHubRecord('labResults', labId) }
          catch (cause) {
            if (!(cause instanceof Error && cause.message === 'record_not_found')) await queueHubSync({ domain: 'labResults', operation: 'delete', recordId: labId })
          }
        } else {
          await queueHubSync({ domain: 'labResults', operation: 'delete', recordId: labId })
        }
      }
    },

    saveCanonicalRecord: async (domain, record) => {
      await saveLocalCanonicalRecord(domain, record)
      if (hubMode) {
        try { await saveHubRecord(domain, record) }
        catch { await queueHubSync({ domain, operation: 'upsert', recordId: String(record.id), record }) }
      } else {
        await queueHubSync({ domain, operation: 'upsert', recordId: String(record.id), record })
      }
    },

    deleteCanonicalRecord: async (domain, id) => {
      await deleteLocalCanonicalRecord(domain, id)
      if (hubMode) {
        try { await deleteHubRecord(domain, id) }
        catch { await queueHubSync({ domain, operation: 'delete', recordId: id }) }
      } else {
        await queueHubSync({ domain, operation: 'delete', recordId: id })
      }
    },
  }
}
