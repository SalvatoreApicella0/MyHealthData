import { expect, it } from 'vitest'
import type { Measurement } from '../../core/types'
import { hydrationAmount, hydrationSummary } from './hydrationAmounts'

it('normalizes supported display units and rejects unusable values', () => {
  expect(hydrationAmount({ type: 'dietary_water', value: 1.5, unit: 'L' })).toBe(1500)
  expect(hydrationAmount({ type: 'dietary_caffeine', value: .08, unit: 'g' })).toBe(80)
  expect(hydrationAmount({ type: 'dietary_water', value: 2, unit: 'cups' })).toBeUndefined()
  expect(hydrationAmount({ type: 'alcohol_units', value: -1, unit: 'UA' })).toBeUndefined()
})

it('uses the selected calendar day and seven-day window without future records', () => {
  const make = (type: Measurement['type'], value: number, unit: string, date: number): Measurement => ({
    id: `${type}-${date}-${unit}`, type, value, unit,
    measuredAt: new Date(2026, 8, date, 12).toISOString(), createdAt: '2026-09-01T00:00:00Z',
  })
  const records = [make('dietary_water', 1, 'L', 10), make('dietary_water', 250, 'mL', 10),
    make('dietary_water', 500, 'mL', 9), make('dietary_caffeine', .08, 'g', 4),
    make('dietary_caffeine', 120, 'mg', 3), make('alcohol_units', 2, 'UA', 10),
    make('alcohol_units', 10, 'UA', 11), make('dietary_water', 1, 'cups', 10)]
  expect(hydrationSummary(records, new Date(2026, 8, 10))).toEqual({ waterToday: 1250, caffeineWeek: 80, alcoholWeek: 2, unsupported: 1 })
  expect(records[0]?.unit).toBe('L')
})
