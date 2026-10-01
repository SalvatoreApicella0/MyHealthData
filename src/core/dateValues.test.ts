import { describe, expect, it } from 'vitest'
import { dateInputValue, sortDateLike } from './dateValues'

describe('date values shared by Web/iOS forms', () => {
  it('normalizes an ISO datetime for an HTML date input', () => {
    expect(dateInputValue('2026-09-20T18:30:00.000Z')).toBe('2026-09-20')
    expect(dateInputValue('2026-09-20')).toBe('2026-09-20')
    expect(dateInputValue('not-a-date')).toBe('')
  })

  it('sorts without mutating the source array', () => {
    const source = [{ date: '2026-01-01' }, { date: '2026-09-01' }]
    expect(sortDateLike(source, (item) => item.date).map((item) => item.date)).toEqual(['2026-09-01', '2026-01-01'])
    expect(source[0]?.date).toBe('2026-01-01')
  })
})
