import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllData, getAttachmentBlob, getCanonicalDomain, getSnapshot, replaceCanonicalDomain, saveAttachmentBlob } from './repository'
import { sha256Hex } from '../core/attachmentIntegrity'
import { mergeHubDomain, stripHubEnvelope, type HubRecord } from './hubCanonical'
import { canonicalSyncDomains, getLastCanonicalSyncFailedDomains, syncCanonicalDomainsFromHub } from './canonicalHubSync'

const jsonResponse = (body: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: (): string => 'application/json' },
  json: async () => body,
})

const hubRecord = (overrides: Partial<HubRecord> & { id: string }): HubRecord => ({
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  originDeviceId: 'web',
  provenance: 'web',
  revision: 1,
  deleted: false,
  ...overrides,
})

describe('hub canonical helpers', () => {
  it('strips the Hub envelope and keeps the canonical payload', () => {
    const stripped = stripHubEnvelope(hubRecord({ id: 'appointment_1', title: 'Visita', status: 'planned' }))
    expect(stripped).toEqual({
      id: 'appointment_1',
      title: 'Visita',
      status: 'planned',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })
  })

  it('applies upserts and tombstones while keeping local-only records', () => {
    const local = [{ id: 'keep_1', title: 'Local' }, { id: 'remove_1', title: 'Old' }]
    const merged = mergeHubDomain(local, [
      hubRecord({ id: 'remove_1', deleted: true }),
      hubRecord({ id: 'add_1', title: 'From Hub', revision: 3 }),
    ])
    const byId = Object.fromEntries(merged.map((record) => [record.id as string, record]))
    expect(byId.keep_1).toEqual({ id: 'keep_1', title: 'Local' })
    expect(byId.add_1).toEqual({
      id: 'add_1',
      title: 'From Hub',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })
    expect(byId.remove_1).toBeUndefined()
  })
})

describe('canonical Hub sync', () => {
  beforeEach(async () => {
    await clearAllData()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('covers canonical array domains that have no Web editor yet', () => {
    expect(canonicalSyncDomains).toContain('foodRecipes')
    expect(canonicalSyncDomains).toContain('gymPlans')
  })

  it('pulls new revisions into the vault and advances the persisted cursor', async () => {
    const requested: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [
            {
              cursor: 1,
              record: hubRecord({ id: 'appointment_hub', title: 'Hub visite', scheduledAt: '2026-10-02T08:30:00.000Z' }),
            },
          ],
        })
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    const applied = await syncCanonicalDomainsFromHub(['appointments'])
    expect(applied).toBe(1)

    const records = await getCanonicalDomain('appointments')
    expect(records).toEqual([
      {
        id: 'appointment_hub',
        title: 'Hub visite',
        scheduledAt: '2026-10-02T08:30:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    expect(records[0]).not.toHaveProperty('revision')
    expect(records[0]).not.toHaveProperty('deleted')
    expect(JSON.parse(localStorage.getItem('mhd.hub.canonical-cursors') ?? '{}')).toEqual({ appointments: 1 })
  })

  it('removes tombstoned records from the local domain', async () => {
    await replaceCanonicalDomain('appointments', [
      { id: 'appointment_a', title: 'A' },
      { id: 'appointment_b', title: 'B' },
    ])

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('since=0')) {
        return jsonResponse({
          nextCursor: 2,
          changes: [
            { cursor: 1, record: hubRecord({ id: 'appointment_a', title: 'A updated', revision: 2 }) },
            { cursor: 2, record: hubRecord({ id: 'appointment_b', revision: 2, deleted: true }) },
          ],
        })
      }
      return jsonResponse({ nextCursor: 2, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['appointments'])
    const records = await getCanonicalDomain('appointments')
    expect(records).toEqual([{
      id: 'appointment_a',
      title: 'A updated',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }])
  })

  it('keeps successful domains when one independent domain fails', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/appointments?')) {
        return jsonResponse({
          nextCursor: 4,
          changes: [{ cursor: 4, record: hubRecord({ id: 'appointment_partial', title: 'Hub' }) }],
        })
      }
      if (url.includes('/documents?')) throw new Error('temporary_domain_failure')
      return jsonResponse({ nextCursor: 0, changes: [] })
    }) as unknown as typeof fetch

    await expect(syncCanonicalDomainsFromHub(['appointments', 'documents'])).resolves.toBe(2)
    expect(getLastCanonicalSyncFailedDomains()).toEqual(['documents'])
    expect(await getCanonicalDomain('appointments')).toEqual([{
      id: 'appointment_partial',
      title: 'Hub',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }])
    expect(JSON.parse(localStorage.getItem('mhd.hub.canonical-cursors') ?? '{}')).toMatchObject({ appointments: 4 })
    expect(JSON.parse(localStorage.getItem('mhd.hub.canonical-cursors') ?? '{}')).not.toHaveProperty('documents')

    globalThis.fetch = vi.fn(async () => jsonResponse({ nextCursor: 4, changes: [] })) as unknown as typeof fetch
    await syncCanonicalDomainsFromHub(['appointments', 'documents'])
    expect(getLastCanonicalSyncFailedDomains()).toEqual([])
  })

  it('resumes from the persisted cursor without re-applying history', async () => {
    localStorage.setItem('mhd.hub.canonical-cursors', JSON.stringify({ appointments: 7 }))
    const requested: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      requested.push(String(input))
      return jsonResponse({ nextCursor: 7, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['appointments'])
    expect(requested).toEqual(['/api/v1/records/appointments?since=7'])
  })

  it('warms every attachment on event records, not only document attachments', async () => {
    const metadata = {
      id: 'attachment_event_1',
      name: 'foto-dolore.jpg',
      type: 'image/jpeg',
      size: 4,
      lastModified: 1,
    }
    const requested: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/api/v1/records/events?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [{ cursor: 1, record: hubRecord({ id: 'event_1', attachments: [metadata] }) }],
        })
      }
      if (url.includes('/api/v1/attachments/attachment_event_1')) {
        return {
          ok: true,
          status: 200,
          headers: { get: (): string => 'application/octet-stream' },
          blob: async () => new Blob(['bytes'], { type: metadata.type }),
        }
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['events'])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(requested).toContain('/api/v1/attachments/attachment_event_1')
    expect(await getAttachmentBlob(metadata.id)).toBeUndefined()
  })

  it('materializes Hub event changes in the dedicated local events table', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/records/events?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [{
            cursor: 1,
            record: hubRecord({
              id: 'event_from_iphone',
              type: 'pain',
              bodyRegionId: 'lower-back',
              occurredAt: '2026-09-19T09:00:00.000Z',
              description: 'Imported event',
              tags: [],
              attachments: [],
              createdAt: '2026-09-19T09:00:00.000Z',
              updatedAt: '2026-09-19T09:00:00.000Z',
            }),
          }],
        })
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['events'])

    const snapshot = await getSnapshot()
    expect(snapshot.events).toEqual([
      expect.objectContaining({
        id: 'event_from_iphone',
        type: 'pain',
        bodyRegionId: 'lower-back',
        createdAt: '2026-09-19T09:00:00.000Z',
        updatedAt: '2026-09-19T09:00:00.000Z',
      }),
    ])
  })

  it('materializes document changes in the local table and removes tombstones', async () => {
    let deleted = false
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/records/documents?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: deleted
            ? [{ cursor: 1, record: hubRecord({ id: 'document_from_iphone', deleted: true }) }]
            : [{ cursor: 1, record: hubRecord({
              id: 'document_from_iphone',
              title: 'Referto importato',
              documentType: 'medical_report',
              documentDate: '2026-09-19',
              createdAt: '2026-09-19T09:00:00.000Z',
              updatedAt: '2026-09-19T09:00:00.000Z',
            }) }],
        })
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['documents'])
    expect((await getSnapshot()).documents).toEqual([
      expect.objectContaining({ id: 'document_from_iphone', title: 'Referto importato' }),
    ])

    localStorage.clear()
    deleted = true
    await syncCanonicalDomainsFromHub(['documents'])
    expect((await getSnapshot()).documents).toEqual([])
  })

  it('preserves iOS attachment metadata when materializing a document', async () => {
    const metadata = {
      id: 'attachment_ios_pdf',
      name: 'referto.pdf',
      type: 'application/pdf',
      size: 128,
      vaultFileName: 'vault/referto.pdf',
      sha256: 'a'.repeat(64),
      storedAt: '2026-09-19T09:00:00.000Z',
    }
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/v1/records/documents?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [{ cursor: 1, record: hubRecord({
            id: 'document_ios_pdf',
            title: 'Referto iPhone',
            documentType: 'medical_report',
            documentDate: '2026-09-19',
            attachment: metadata,
          }) }],
        })
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['documents'])
    const document = (await getSnapshot()).documents[0]
    expect(document?.attachment).toMatchObject({
      id: metadata.id,
      vaultFileName: metadata.vaultFileName,
      sha256: metadata.sha256,
    })
  })

  it('warms a synchronized document attachment into the local vault', async () => {
    const bytes = 'bytes'
    const hash = await sha256Hex(new Blob([bytes]))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    const metadata = {
      id: 'attachment_warm_pdf',
      name: 'referto.pdf',
      type: 'application/pdf',
      size: bytes.length,
      lastModified: 1,
      storedAt: '2026-09-19T09:00:00.000Z',
      sha256: hash,
    }
    const requested: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/api/v1/records/documents?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [{ cursor: 1, record: hubRecord({ id: 'document_warm_pdf', attachment: metadata }) }],
        })
      }
      if (url.includes('/api/v1/attachments/attachment_warm_pdf')) {
        return {
          ok: true,
          status: 200,
          headers: { get: (): string => 'application/pdf' },
          blob: async () => new Blob([bytes], { type: metadata.type }),
        }
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    expect(await syncCanonicalDomainsFromHub(['documents'])).toBe(1)
    expect(requested).toContain('/api/v1/attachments/attachment_warm_pdf')
    const cached = await getAttachmentBlob(metadata.id)
    expect(cached?.type).toBe(metadata.type)
    expect(cached?.size).toBe(bytes.length)
  })

  it('reuses a verified local attachment without downloading it again', async () => {
    const bytes = 'already cached'
    const hash = await sha256Hex(new Blob([bytes]))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    const metadata = {
      id: 'attachment_cached_pdf',
      name: 'referto.pdf',
      type: 'application/pdf',
      size: bytes.length,
      lastModified: 1,
      sha256: hash,
    }
    await saveAttachmentBlob(metadata, new Blob([bytes], { type: metadata.type }))

    const requested: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/api/v1/records/documents?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [{ cursor: 1, record: hubRecord({ id: 'document_cached_pdf', attachment: metadata }) }],
        })
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['documents'])

    expect(requested).not.toContain('/api/v1/attachments/attachment_cached_pdf')
    expect(await getAttachmentBlob(metadata.id)).toBeInstanceOf(Blob)
  })

  it('retries a failed attachment without a new record revision', async () => {
    const bytes = 'retryable attachment'
    const hash = await sha256Hex(new Blob([bytes]))
    const metadata = {
      id: 'attachment_retry_pdf',
      name: 'retry.pdf',
      type: 'application/pdf',
      size: bytes.length,
      lastModified: 1,
      sha256: hash,
    }
    let attachmentAttempts = 0
    const requested: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requested.push(url)
      if (url.includes('/api/v1/records/documents?since=0')) {
        return jsonResponse({
          nextCursor: 1,
          changes: [{ cursor: 1, record: hubRecord({ id: 'document_retry_pdf', attachment: metadata }) }],
        })
      }
      if (url.includes('/api/v1/attachments/attachment_retry_pdf')) {
        attachmentAttempts += 1
        return {
          ok: true,
          status: 200,
          headers: { get: (): string => 'application/pdf' },
          blob: async () => new Blob([attachmentAttempts === 1 ? 'bad' : bytes], { type: metadata.type }),
        }
      }
      return jsonResponse({ nextCursor: 1, changes: [] })
    }) as unknown as typeof fetch

    await syncCanonicalDomainsFromHub(['documents'])
    expect(await getAttachmentBlob(metadata.id)).toBeUndefined()

    await syncCanonicalDomainsFromHub(['documents'])

    expect(requested).toContain('/api/v1/records/documents?since=1')
    expect(attachmentAttempts).toBe(2)
    expect((await getAttachmentBlob(metadata.id))?.size).toBe(bytes.length)
  })
})
