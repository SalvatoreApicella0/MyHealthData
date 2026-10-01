import { describe, expect, it } from 'vitest'
import { dentalSummaryCounts } from './SpecialtySections'

describe('dental summary counts', () => {
  it('counts every tooth with recorded activity, including unclassified actions', () => {
    const state = new Map([['11', 'caries' as const], ['21', 'treated' as const]])
    const entries = new Map([
      ['11', []],
      ['21', []],
      ['31', [{ id: 'note' } as never]],
    ])
    expect(dentalSummaryCounts(state, entries)).toEqual({ tracked: 3, treated: 1, caries: 1, removed: 0 })
  })
})
