import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sha256Hex } from '../core/attachmentIntegrity'
import type { SyncOutboxEntry } from './db'
import { clearAllData, forceHubSyncRetry, getHubSyncQueue, queueHubSync, saveAttachmentBlob } from './repository'
import { flushHubSyncQueue } from './hubSyncQueue'
import { documentSyncState, isDocumentSyncConfirmed, summarizeHealthSync } from './syncStatus'

const entry = (overrides: Partial<SyncOutboxEntry>): SyncOutboxEntry => ({
  id: `${overrides.domain ?? 'documents'}:${overrides.recordId ?? 'record-1'}`,
  domain: overrides.domain ?? 'documents',
  operation: 'upsert',
  recordId: overrides.recordId ?? 'record-1',
  createdAt: '2026-09-21T10:00:00.000Z',
  ...overrides,
})

const jsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: (): string => 'application/json' },
  json: async () => body,
})

describe('health sync status', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await clearAllData()
  })

  it('projects pending and failed document intents without exposing their payloads', () => {
    const status = summarizeHealthSync([
      entry({ recordId: 'document-pending' }),
      entry({ recordId: 'document-failed', lastError: 'attachment_hash_mismatch', record: { title: 'Private report' } }),
      entry({ domain: 'events', recordId: 'event-1', lastError: 'hub_sync_failed', record: { description: 'Private note' } }),
    ], false)

    expect(status.pendingCount).toBe(3)
    expect(status.failedCount).toBe(2)
    expect(status.documentStates).toEqual({
      'document-pending': 'pending',
      'document-failed': 'error',
    })
    expect(JSON.stringify(status)).not.toContain('Private')
  })

  it('covers local, error and confirmed success without trusting Hub availability alone', () => {
    const queued = summarizeHealthSync([
      entry({ recordId: 'document-1' }),
      entry({ recordId: 'document-1', lastError: 'hub_sync_failed' }),
    ], true)

    expect(documentSyncState(queued, 'document-1')).toBe('error')
    expect(documentSyncState(summarizeHealthSync([], true), 'document-2')).toBe('local')
    expect(documentSyncState(summarizeHealthSync([], true, ['document-3']), 'document-3')).toBe('synced')
    expect(documentSyncState(summarizeHealthSync([], false), 'document-3')).toBe('local')
  })

  it('requires the acknowledged record and the expected attachment digest before confirming a document', () => {
    const expected = { id: 'document-4', attachment: { id: 'attachment-4', size: 4, sha256: 'b'.repeat(64) } }
    expect(isDocumentSyncConfirmed('document-4', expected, { id: 'document-4' })).toBe(false)
    expect(isDocumentSyncConfirmed('document-4', expected, {
      id: 'document-4',
      attachment: { id: 'attachment-4', size: 4, sha256: 'a'.repeat(63) },
    })).toBe(false)
    expect(isDocumentSyncConfirmed('document-4', expected, {
      id: 'document-4',
      attachment: { id: 'attachment-4', size: 4, sha256: 'a'.repeat(64) },
    })).toBe(false)
    expect(isDocumentSyncConfirmed('document-4', expected, {
      id: 'document-4',
      attachment: { id: 'attachment-4', size: 4, sha256: 'B'.repeat(64) },
    })).toBe(true)
  })

  it('confirms a local record without an attachment when Hub acknowledges the record', () => {
    expect(isDocumentSyncConfirmed('document-local', { id: 'document-local' }, { id: 'document-local' })).toBe(true)
  })

  it('leaves a digest mismatch retryable and confirms it after a matching retry', async () => {
    const bytes = new Blob(['safe-bytes'], { type: 'application/pdf' })
    const expectedDigest = await sha256Hex(bytes)
    if (!expectedDigest) throw new Error('digest unavailable')
    const metadata = {
      id: 'attachment-retry',
      name: 'document.pdf',
      type: 'application/pdf',
      size: bytes.size,
      sha256: expectedDigest,
    }
    await saveAttachmentBlob(metadata, bytes)
    await queueHubSync({
      domain: 'documents',
      operation: 'upsert',
      recordId: 'document-retry',
      record: { id: 'document-retry', attachment: metadata },
      attachmentId: metadata.id,
    })

    let mismatch = true
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/attachments/')) return jsonResponse(metadata)
      if (url.includes('/records/documents')) {
        return jsonResponse({
          id: 'document-retry',
          attachment: { ...metadata, sha256: mismatch ? 'a'.repeat(64) : expectedDigest },
        })
      }
      throw new Error('unexpected_request')
    }) as unknown as typeof fetch

    await flushHubSyncQueue()
    expect((await getHubSyncQueue())[0]).toMatchObject({
      recordId: 'document-retry',
      lastError: 'document_sync_unconfirmed',
    })

    expect(await forceHubSyncRetry('documents', 'document-retry')).toBe(true)
    expect((await getHubSyncQueue())[0]?.lastError).toBeUndefined()

    mismatch = false
    await flushHubSyncQueue()
    expect(await getHubSyncQueue()).toHaveLength(0)
  })
})
