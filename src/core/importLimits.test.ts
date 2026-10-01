import { describe, expect, it } from 'vitest'
import { IMPORT_LIMITS, parseHealthDataSnapshot } from './schema'

const base = { events: [], measurements: [], documents: [] }

describe('import hardening', () => {
  it('accepts a canonical snapshot with unknown domains', () => {
    const parsed = parseHealthDataSnapshot({
      ...base,
      cycleEntries: [{ id: 'cycle_1', date: '2026-09-01' }],
      futureDomain: { anything: true },
    })
    expect(parsed.cycleEntries).toEqual([{ id: 'cycle_1', date: '2026-09-01' }])
    expect(parsed.futureDomain).toEqual({ anything: true })
  })

  it('rejects an oversized text value', () => {
    expect(() =>
      parseHealthDataSnapshot({ ...base, annotation: 'x'.repeat(IMPORT_LIMITS.maxStringLength + 1) }),
    ).toThrow(/text value is longer/)
  })

  it('rejects a domain with too many records', () => {
    expect(() =>
      parseHealthDataSnapshot({
        ...base,
        fakeDomain: Array.from({ length: IMPORT_LIMITS.maxRecordsPerDomain + 1 }, (_, index) => ({ index })),
      }),
    ).toThrow(/more than/)
  })

  it('rejects paths nested beyond the depth cap', () => {
    let node: Record<string, unknown> = { leaf: true }
    for (let index = 0; index < IMPORT_LIMITS.maxDepth + 3; index += 1) {
      node = { nested: node }
    }
    expect(() => parseHealthDataSnapshot({ ...base, deep: node })).toThrow(/nested deeper/)
  })
})
