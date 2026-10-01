import { describe, expect, it } from 'vitest'
import { decryptMhdExport, encryptMhdExport, isEncryptedMhdExport } from './mhdCrypto'
import { createExportFile } from '../core/schema'
import type { HealthDataSnapshot } from '../core/types'

function snapshot(): HealthDataSnapshot {
  const now = new Date('2026-09-13T10:00:00.000Z').toISOString()
  return {
    events: [
      {
        id: 'event_1',
        type: 'pain',
        bodyRegionId: 'lower_back',
        occurredAt: now,
        intensity: 4,
        description: 'Test event',
        tags: [],
        attachments: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    measurements: [
      { id: 'measurement_1', type: 'weight', value: 71.5, unit: 'kg', measuredAt: now, createdAt: now },
    ],
    documents: [],
  }
}

describe('encrypted MHD export', () => {
  it('round-trips a snapshot through AES-GCM', async () => {
    const file = createExportFile(snapshot())
    const encrypted = await encryptMhdExport(file, 'a-long-passphrase-123')

    expect(isEncryptedMhdExport(encrypted)).toBe(true)
    expect(encrypted.crypto.iterations).toBeGreaterThanOrEqual(100_000)

    const decrypted = await decryptMhdExport(encrypted, 'a-long-passphrase-123')
    expect(decrypted.measurements[0]?.value).toBe(71.5)
    expect(decrypted.events[0]?.description).toBe('Test event')
  })

  it('rejects short passphrases', async () => {
    await expect(encryptMhdExport(createExportFile(snapshot()), 'short')).rejects.toThrow(/12 characters/)
  })

  it('fails closed on a wrong passphrase', async () => {
    const encrypted = await encryptMhdExport(createExportFile(snapshot()), 'a-long-passphrase-123')
    await expect(decryptMhdExport(encrypted, 'a-different-passphrase')).rejects.toThrow()
  })

  it('rejects tampered envelopes before deriving a key', async () => {
    const encrypted = await encryptMhdExport(createExportFile(snapshot()), 'a-long-passphrase-123')

    await expect(
      decryptMhdExport({ ...encrypted, crypto: { ...encrypted.crypto, salt: 'AAAA' } }, 'a-long-passphrase-123'),
    ).rejects.toThrow(/salt length/)

    await expect(
      decryptMhdExport({ ...encrypted, crypto: { ...encrypted.crypto, iv: 'AAAA' } }, 'a-long-passphrase-123'),
    ).rejects.toThrow(/IV length/)

    await expect(
      decryptMhdExport({ ...encrypted, crypto: { ...encrypted.crypto, iterations: 10 } }, 'a-long-passphrase-123'),
    ).rejects.toThrow(/iterations/)
  })
})
