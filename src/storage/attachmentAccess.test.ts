import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sha256Hex } from '../core/attachmentIntegrity'
import { AttachmentAccessError, loadVerifiedAttachment } from './attachmentAccess'

const { localAttachment, hubAttachment, saveAttachment } = vi.hoisted(() => ({
  localAttachment: vi.fn<() => Promise<Blob | undefined>>(),
  hubAttachment: vi.fn<() => Promise<Blob>>(),
  saveAttachment: vi.fn<() => Promise<void>>(),
}))

vi.mock('./repository', () => ({
  getAttachmentBlob: localAttachment,
  saveAttachmentBlob: saveAttachment,
}))

vi.mock('./hubRepository', () => ({
  getHubAttachment: hubAttachment,
}))

describe('verified attachment access', () => {
  beforeEach(() => {
    localAttachment.mockReset()
    hubAttachment.mockReset()
    saveAttachment.mockReset()
    saveAttachment.mockResolvedValue(undefined)
  })

  it('returns a verified local copy without contacting the Hub', async () => {
    const local = new Blob(['local'], { type: 'application/octet-stream' })
    localAttachment.mockResolvedValue(local)
    const metadata = { id: 'attachment-local', name: 'report.bin', type: local.type, size: local.size, sha256: await sha256Hex(local) }

    await expect(loadVerifiedAttachment(metadata)).resolves.toBe(local)
    expect(hubAttachment).not.toHaveBeenCalled()
    expect(saveAttachment).not.toHaveBeenCalled()
  })

  it('falls back to a verified Hub copy, normalizes PDFs, and caches it', async () => {
    const local = new Blob(['stale'], { type: 'application/octet-stream' })
    const remote = new Blob(['remote'], { type: 'application/octet-stream' })
    localAttachment.mockResolvedValue(local)
    hubAttachment.mockResolvedValue(remote)
    const metadata = { id: 'attachment-remote', name: 'report.pdf', type: 'application/pdf', size: remote.size, sha256: await sha256Hex(remote) }

    const result = await loadVerifiedAttachment(metadata)

    expect(result.type).toBe('application/pdf')
    expect(result.size).toBe(remote.size)
    expect(hubAttachment).toHaveBeenCalledWith(metadata.id)
    expect(saveAttachment).toHaveBeenCalledWith(metadata, result)
  })

  it('reports a hash mismatch instead of returning corrupted bytes', async () => {
    const remote = new Blob(['corrupted'])
    localAttachment.mockResolvedValue(undefined)
    hubAttachment.mockResolvedValue(remote)
    const metadata = { id: 'attachment-corrupt', name: 'report.pdf', type: 'application/pdf', size: remote.size, sha256: '0'.repeat(64) }

    await expect(loadVerifiedAttachment(metadata)).rejects.toMatchObject({
      name: 'AttachmentAccessError',
      code: 'hash_mismatch',
    } satisfies Partial<AttachmentAccessError>)
  })
})
