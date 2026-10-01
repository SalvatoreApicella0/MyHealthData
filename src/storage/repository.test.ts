import { beforeEach, describe, expect, it } from 'vitest'
import { createId } from '../core/id'
import type { HealthDocument, HealthEvent, LocalProfile } from '../core/types'
import { claimHubSync, clearAllData, deleteDocument, deleteEvent, getAttachmentBlob, getDueHubSyncQueue, getHubSyncQueue, getSnapshot, markHubSyncFailure, queueHubSync, removeHubSync, replaceSnapshot, saveAttachmentBlob, saveDocument, saveEvent, saveProfile } from './repository'

const now = new Date('2026-07-05T12:00:00.000Z').toISOString()

function makeEvent(): HealthEvent {
  return {
    id: createId('event'),
    type: 'stiffness',
    bodyRegionId: 'neck',
    occurredAt: now,
    description: 'Neck stiffness after long desk session',
    tags: ['desk'],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }
}

describe('local repository', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('persists profile and events in IndexedDB', async () => {
    const profile: LocalProfile = {
      id: 'local-profile',
      alias: 'Local user',
      updatedAt: now,
    }
    const event = makeEvent()

    await saveProfile(profile)
    await saveEvent(event)

    const snapshot = await getSnapshot()

    expect(snapshot.profile?.alias).toBe('Local user')
    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.events[0]?.bodyRegionId).toBe('neck')
  })

  it('replaces the full snapshot atomically', async () => {
    await saveEvent(makeEvent())
    await replaceSnapshot({ events: [], measurements: [], documents: [] })

    const snapshot = await getSnapshot()

    expect(snapshot.events).toHaveLength(0)
    expect(snapshot.measurements).toHaveLength(0)
    expect(snapshot.documents).toHaveLength(0)
  })

  it('keeps a selected attachment available until its document is deleted', async () => {
    const now = new Date('2026-07-05T12:00:00.000Z').toISOString()
    const document: HealthDocument = {
      id: 'document-1',
      title: 'Referto',
      documentType: 'medical_report',
      documentDate: '2026-07-05',
      attachment: { id: 'attachment-1', name: 'referto.pdf', type: 'application/pdf', size: 3 },
      createdAt: now,
      updatedAt: now,
    }
    await saveDocument(document, new ArrayBuffer(3))

    expect(await getAttachmentBlob('attachment-1')).toBeInstanceOf(Blob)
    await deleteDocument(document.id)
    expect(await getAttachmentBlob('attachment-1')).toBeUndefined()
  })

  it('preserves the attachment MIME type for ArrayBuffer uploads', async () => {
    const document: HealthDocument = {
      id: 'document-arraybuffer',
      title: 'Referto PDF',
      documentType: 'medical_report',
      documentDate: '2026-07-05',
      attachment: { id: 'attachment-arraybuffer', name: 'referto.pdf', type: 'application/pdf', size: 4 },
      createdAt: now,
      updatedAt: now,
    }
    await saveDocument(document, new ArrayBuffer(4))
    expect((await getAttachmentBlob('attachment-arraybuffer'))?.type).toBe('application/pdf')
  })

  it('rejects attachment bytes that do not match declared metadata', async () => {
    const document: HealthDocument = {
      id: 'document-invalid-attachment',
      title: 'Referto non valido',
      documentType: 'medical_report',
      documentDate: '2026-07-05',
      attachment: { id: 'attachment-invalid', name: 'referto.pdf', type: 'application/pdf', size: 4 },
      createdAt: now,
      updatedAt: now,
    }

    await expect(saveDocument(document, new ArrayBuffer(3))).rejects.toThrow('attachment_size_mismatch')
    expect(await getAttachmentBlob('attachment-invalid')).toBeUndefined()
  })

  it('removes a replaced attachment blob without affecting the document', async () => {
    const document: HealthDocument = {
      id: 'document-replace',
      title: 'Referto aggiornato',
      documentType: 'medical_report',
      documentDate: '2026-07-05',
      attachment: { id: 'attachment-old', name: 'old.pdf', type: 'application/pdf', size: 3 },
      createdAt: now,
      updatedAt: now,
    }
    await saveDocument(document, new ArrayBuffer(3))
    await saveDocument({ ...document, attachment: { id: 'attachment-new', name: 'new.pdf', type: 'application/pdf', size: 4 } }, new ArrayBuffer(4))

    expect(await getAttachmentBlob('attachment-old')).toBeUndefined()
    expect(await getAttachmentBlob('attachment-new')).toBeInstanceOf(Blob)
    expect((await getSnapshot()).documents[0]?.attachment?.id).toBe('attachment-new')
  })

  it('removes event attachment blobs when the event is deleted', async () => {
    const attachment = { id: 'event-attachment', name: 'foto.jpg', type: 'image/jpeg', size: 3 }
    const event = { ...makeEvent(), attachments: [attachment] }
    await saveEvent(event)
    await saveAttachmentBlob(attachment, { arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer } as Blob)

    await deleteEvent(event.id)

    expect(await getAttachmentBlob(attachment.id)).toBeUndefined()
    expect((await getSnapshot()).events).toHaveLength(0)
  })

  it('keeps one retry intent per record and removes it after delivery', async () => {
    await queueHubSync({ domain: 'events', operation: 'upsert', recordId: 'event-1', record: { id: 'event-1', type: 'pain' } })
    await queueHubSync({ domain: 'events', operation: 'upsert', recordId: 'event-1', record: { id: 'event-1', type: 'updated' } })

    const pending = await getHubSyncQueue()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.record?.type).toBe('updated')

    await removeHubSync(pending[0]!.id)
    expect(await getHubSyncQueue()).toHaveLength(0)
  })

  it('claims each queued PDF intent once and persists bounded retry state', async () => {
    await queueHubSync({
      domain: 'documents',
      operation: 'upsert',
      recordId: 'document-retry',
      record: { id: 'document-retry', title: 'Referto' },
      attachmentId: 'attachment-retry',
    })

    const attemptAt = Date.now()
    const claimed = await claimHubSync('documents:document-retry', attemptAt)
    expect(claimed?.retryCount).toBe(1)
    expect(claimed?.nextAttemptAt).toBe(attemptAt + 5_000)
    expect(await claimHubSync('documents:document-retry', attemptAt + 1)).toBeUndefined()

    await markHubSyncFailure('documents:document-retry', attemptAt, new Error('private/referto.pdf'))
    const failed = (await getHubSyncQueue())[0]
    expect(failed?.lastError).toBe('hub_sync_failed')
    expect(failed?.nextAttemptAt).toBe(attemptAt + 5_000)
    expect((await getDueHubSyncQueue(attemptAt + 4_999))).toHaveLength(0)
    expect((await getDueHubSyncQueue(attemptAt + 5_000))).toHaveLength(1)
  })

  it('does not delete a newer mutation when an older upload finishes', async () => {
    await queueHubSync({ domain: 'documents', operation: 'upsert', recordId: 'document-race', record: { id: 'document-race', version: 1 } })
    const attemptAt = Date.now()
    const claimed = await claimHubSync('documents:document-race', attemptAt)
    expect(claimed?.lastAttemptAt).toBe(attemptAt)

    await queueHubSync({ domain: 'documents', operation: 'upsert', recordId: 'document-race', record: { id: 'document-race', version: 2 } })
    await removeHubSync('documents:document-race', attemptAt)

    const pending = await getHubSyncQueue()
    expect(pending).toHaveLength(1)
    expect(pending[0]?.record?.version).toBe(2)
  })
})
