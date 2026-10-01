import { describe, expect, it } from 'vitest'
import { resolveVerifiedAttachment } from './attachmentResolution'
import { sha256Hex } from './attachmentIntegrity'

describe('verified attachment resolution', () => {
  it('prefers a valid local copy', async () => {
    const local = new Blob(['local'])
    await expect(resolveVerifiedAttachment({ local, remote: new Blob(['remote']) }, await sha256Hex(local))).resolves.toMatchObject({ source: 'local', status: 'ok' })
  })

  it('falls back to a valid remote copy and reports corruption', async () => {
    const remote = new Blob(['remote'])
    await expect(resolveVerifiedAttachment({ remote }, await sha256Hex(remote))).resolves.toMatchObject({ source: 'remote', status: 'ok' })
    await expect(resolveVerifiedAttachment({ remote }, '0'.repeat(64))).resolves.toMatchObject({ status: 'hash_mismatch' })
  })

  it('distinguishes a corrupt local cache from a missing attachment', async () => {
    const local = new Blob(['corrupt'])
    const expected = '0'.repeat(64)
    expect(expected).toBeDefined()
    await expect(resolveVerifiedAttachment({ local }, expected!)).resolves.toMatchObject({ status: 'hash_mismatch' })
  })
})
