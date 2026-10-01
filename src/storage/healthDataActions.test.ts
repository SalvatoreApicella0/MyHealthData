import { beforeEach, describe, expect, it } from 'vitest'
import type { HealthDocument, HealthEvent, Measurement } from '../core/types'
import { clearAllData, getAttachmentBlob, getCanonicalDomain, getHubSyncQueue, getSnapshot, saveCanonicalRecord } from './repository'
import { createHealthDataActions } from './healthDataActions'

const now = '2026-09-25T12:00:00.000Z'

function makeEvent(): HealthEvent {
  return {
    id: 'event-actions-1',
    type: 'stiffness',
    bodyRegionId: 'neck',
    occurredAt: now,
    description: 'Neck stiffness',
    tags: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  }
}

function makeMeasurement(): Measurement {
  return {
    id: 'measurement-actions-1',
    type: 'weight',
    value: 72,
    unit: 'kg',
    measuredAt: now,
    createdAt: now,
  }
}

describe('health data actions', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('persists local writes and queues their Hub intents while offline', async () => {
    const actions = createHealthDataActions({
      hubMode: false,
      snapshot: { events: [], measurements: [], documents: [] },
      onDocumentConfirmed: () => undefined,
    })

    await actions.saveEvent(makeEvent())
    await actions.saveMeasurement(makeMeasurement())

    const snapshot = await getSnapshot()
    const queue = await getHubSyncQueue()

    expect(snapshot.events).toHaveLength(1)
    expect(snapshot.measurements).toHaveLength(1)
    expect(queue.map((entry) => `${entry.domain}:${entry.operation}:${entry.recordId}`)).toEqual([
      'events:upsert:event-actions-1',
      'measurements:upsert:measurement-actions-1',
    ])
  })

  it('deletes a document and its linked lab while preserving retry intents', async () => {
    const document: HealthDocument = {
      id: 'document-actions-1',
      title: 'Referto',
      documentType: 'medical_report',
      documentDate: '2026-09-25',
      attachment: { id: 'attachment-actions-1', name: 'referto.pdf', type: 'application/pdf', size: 3 },
      createdAt: now,
      updatedAt: now,
    }
    await saveCanonicalRecord('labResults', { id: 'lab-actions-1', linkedDocumentId: document.id })

    const actions = createHealthDataActions({
      hubMode: false,
      snapshot: {
        events: [],
        measurements: [],
        documents: [document],
        labResults: [{ id: 'lab-actions-1', linkedDocumentId: document.id }],
      },
      onDocumentConfirmed: () => undefined,
    })

    await actions.saveDocument(document, new ArrayBuffer(3))
    expect(await getAttachmentBlob(document.attachment!.id)).toBeInstanceOf(Blob)

    await actions.deleteDocument(document.id)

    expect((await getSnapshot()).documents).toHaveLength(0)
    expect(await getAttachmentBlob(document.attachment!.id)).toBeUndefined()
    expect(await getCanonicalDomain('labResults')).toEqual([])
    expect((await getHubSyncQueue()).map((entry) => `${entry.domain}:${entry.operation}:${entry.recordId}`)).toEqual([
      'documents:delete:document-actions-1',
      'labResults:delete:lab-actions-1',
    ])
  })
})
