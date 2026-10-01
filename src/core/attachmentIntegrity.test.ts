import { describe, expect, it } from 'vitest'
import { attachmentMatchesHash, classifyAttachment, sha256Hex } from './attachmentIntegrity'

describe('attachment integrity', () => {
  it('computes and verifies SHA-256 for a blob', async () => {
    const blob = new Blob(['referto'])
    const hash = await sha256Hex(blob)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await attachmentMatchesHash(blob, hash)).toBe(true)
    expect(await attachmentMatchesHash(blob, '0'.repeat(64))).toBe(false)
  })

  it('classifies missing and corrupted attachments for user-facing recovery', async () => {
    const blob = new Blob(['referto'])
    const hash = await sha256Hex(blob)
    expect(await classifyAttachment(undefined, hash)).toBe('missing')
    expect(await classifyAttachment(blob, '0'.repeat(64))).toBe('hash_mismatch')
    expect(await classifyAttachment(blob, hash)).toBe('ok')
  })
})
