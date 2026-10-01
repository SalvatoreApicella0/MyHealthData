import { describe, expect, it } from 'vitest'
import { dailyAggregates, lastValue, measurementRecords, measurementTypesWithValues, totalForDay, totalForWeek } from './metrics'

describe('measurement index', () => {
  it('exposes available types from the normalized source index', () => {
    const measurements = [
      { id: 'one', type: 'weight', value: 70, unit: 'kg', measuredAt: '2026-01-01T00:00:00.000Z' },
      { id: 'two', type: 'heart_rate', value: 60, unit: 'bpm', measuredAt: '2026-01-01T00:00:00.000Z' },
    ]
    const snapshot = { measurements }
    const types = measurementTypesWithValues(snapshot)
    expect(types).toEqual(new Set(['weight', 'heart_rate']))
    expect(measurementTypesWithValues(snapshot)).toBe(types)
    expect(snapshot.measurements).toBe(measurements)
  })

  it('reuses the normalized index for repeated reads of the same source array', () => {
    const measurements = [
      { id: 'older', type: 'weight', value: 70, unit: 'kg', measuredAt: '2026-01-01T00:00:00.000Z' },
      { id: 'newer', type: 'weight', value: 69, unit: 'kg', measuredAt: '2026-02-01T00:00:00.000Z' },
    ]
    const snapshot = { measurements }
    const first = measurementRecords(snapshot, 'weight')
    const second = measurementRecords(snapshot, 'weight')

    expect(second).toBe(first)
    expect(lastValue(snapshot, 'weight')?.id).toBe('newer')
  })

  it('does not reuse an index after the repository replaces the source array', () => {
    const firstSnapshot = { measurements: [{ id: 'first', type: 'weight', value: 70, unit: 'kg', measuredAt: '2026-01-01T00:00:00.000Z' }] }
    const secondSnapshot = { measurements: [{ id: 'second', type: 'weight', value: 68, unit: 'kg', measuredAt: '2026-02-01T00:00:00.000Z' }] }

    expect(lastValue(firstSnapshot, 'weight')?.id).toBe('first')
    expect(lastValue(secondSnapshot, 'weight')?.id).toBe('second')
  })

  it('reuses daily aggregates for the same source, type, window and day', () => {
    const measurements = [
      { id: 'one', type: 'step_count', value: 1000, unit: 'count', measuredAt: '2026-02-01T08:00:00.000Z' },
      { id: 'two', type: 'step_count', value: 500, unit: 'count', measuredAt: '2026-02-01T12:00:00.000Z' },
    ]
    const snapshot = { measurements }
    const now = new Date('2026-02-01T18:00:00.000Z')
    const first = dailyAggregates(snapshot, 'step_count', 7, now)
    const second = dailyAggregates(snapshot, 'step_count', 7, now)

    expect(second).toBe(first)
    expect(first).toEqual([{ day: '2026-02-01', value: 1500, samples: 2 }])
  })

  it('reuses weekly totals without sharing values across source arrays', () => {
    const firstSnapshot = {
      measurements: [{ id: 'one', type: 'exercise_minutes', value: 30, unit: 'min', measuredAt: '2026-02-02T10:00:00.000Z' }],
    }
    const secondSnapshot = {
      measurements: [{ id: 'two', type: 'exercise_minutes', value: 45, unit: 'min', measuredAt: '2026-02-02T10:00:00.000Z' }],
    }
    const now = new Date('2026-02-04T18:00:00.000Z')

    expect(totalForWeek(firstSnapshot, 'exercise_minutes', 0, now)).toBe(30)
    expect(totalForWeek(firstSnapshot, 'exercise_minutes', 0, now)).toBe(30)
    expect(totalForWeek(secondSnapshot, 'exercise_minutes', 0, now)).toBe(45)
  })

  it('reuses daily totals for the same source, type and local day', () => {
    const measurements = [
      { id: 'one', type: 'step_count', value: 1000, unit: 'count', measuredAt: '2026-02-01T08:00:00.000Z' },
      { id: 'two', type: 'step_count', value: 500, unit: 'count', measuredAt: '2026-02-01T12:00:00.000Z' },
    ]
    const snapshot = { measurements }
    const day = new Date('2026-02-01T18:00:00.000Z')

    expect(totalForDay(snapshot, 'step_count', day)).toBe(1500)
    expect(totalForDay(snapshot, 'step_count', day)).toBe(1500)
    expect(totalForDay({ measurements: [...measurements, { id: 'three', type: 'step_count', value: 250, unit: 'count', measuredAt: '2026-02-01T14:00:00.000Z' }] }, 'step_count', day)).toBe(1750)
  })
})
