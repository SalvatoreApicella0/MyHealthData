import { beforeEach, describe, expect, it } from 'vitest'
import { canonicalDomainKeys, iosSnapshotFixture } from '../test/fixtures/iosSnapshot'
import { createExportFile, parseMhdExportFile } from '../core/schema'
import { clearAllData, getSnapshot, replaceSnapshot } from './repository'
import type { HealthDataSnapshot } from '../core/types'

/**
 * Parity guard for `docs/hub/IOS_WEB_PARITY.md` invariant 1: an iOS snapshot and
 * a Web snapshot are the same logical graph, and a Web round trip keeps every
 * canonical domain intact.
 */
describe('iOS → Web → export round trip', () => {
  /**
   * The Web vault keeps collections sorted for display (newest first), so the
   * assertions compare record *sets* by id instead of storage order.
   */
  const normalise = (value: unknown): unknown => {
    if (!Array.isArray(value)) {
      return value
    }
    return [...value].sort((left, right) => {
      const leftId = typeof left?.id === 'string' ? left.id : ''
      const rightId = typeof right?.id === 'string' ? right.id : ''
      return leftId.localeCompare(rightId)
    })
  }

  beforeEach(async () => {
    await clearAllData()
  })

  it('stores every canonical domain and returns it unchanged', async () => {
    await replaceSnapshot(iosSnapshotFixture as unknown as HealthDataSnapshot)
    const snapshot = (await getSnapshot()) as unknown as Record<string, unknown>

    for (const key of canonicalDomainKeys) {
      expect(normalise(snapshot[key]), key).toEqual(
        normalise((iosSnapshotFixture as unknown as Record<string, unknown>)[key]),
      )
    }
    expect(snapshot.profile).toEqual(iosSnapshotFixture.profile)
  })

  it('keeps iOS-only fields through an export and re-import', async () => {
    await replaceSnapshot(iosSnapshotFixture as unknown as HealthDataSnapshot)
    const first = (await getSnapshot()) as unknown as HealthDataSnapshot
    const exported = createExportFile(first)
    const reparsed = parseMhdExportFile(JSON.parse(JSON.stringify(exported)) as unknown)

    const event = reparsed.events[0]
    expect(event?.bodyPoint).toEqual({ x: 0, y: 0.94, z: -0.34 })
    expect(event?.source).toBe('manual')
    expect(event?.attachments[0]?.sha256).toBe('a'.repeat(64))
    expect(event?.attachments[0]?.vaultFileName).toBe('vault/referto.pdf')

    const document = reparsed.documents[0]
    expect(document?.linkedModuleId).toBe('bloodwork')
    expect(document?.linkedAppointmentId).toBe('appointment_fixture_1')
    expect(document?.ocrText).toBe('Emocromo nella norma')

    // The four "core" collections must survive a full re-import too.
    await replaceSnapshot(reparsed as unknown as HealthDataSnapshot)
    const second = (await getSnapshot()) as unknown as Record<string, unknown>
    for (const key of canonicalDomainKeys) {
      expect(normalise(second[key]), key).toEqual(
        normalise((iosSnapshotFixture as unknown as Record<string, unknown>)[key]),
      )
    }
  })
})
