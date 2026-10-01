import { describe, expect, it } from 'vitest'
import type { Measurement } from './types'
import { measurementForTypes, measurementSubsetSignature } from './measurementSignatures'

type TestMeasurement = Measurement & { updatedAt?: string }

const measurement = (overrides: Partial<TestMeasurement> = {}): TestMeasurement => ({
  id: 'measurement-1',
  type: 'weight',
  value: 70,
  unit: 'kg',
  measuredAt: '2026-09-20T08:00:00.000Z',
  createdAt: '2026-09-20T08:00:00.000Z',
  ...overrides,
})

describe('measurement subset helpers', () => {
  it('filters by type without mutating the source and caches the filtered result', () => {
    const weight = measurement({ id: 'weight-1' })
    const heartRate = measurement({ id: 'heart-1', type: 'heart_rate', value: 60, unit: 'bpm' })
    const source = [weight, heartRate]
    const original = [...source]

    const selected = measurementForTypes(source, ['weight'])

    expect(selected).toEqual([weight])
    expect(selected).toBe(measurementForTypes(source, ['weight']))
    expect(source).toEqual(original)
    expect(source).toEqual([weight, heartRate])
  })

  it('keeps the referentially reused filtered array immutable', () => {
    const source = [measurement({ id: 'weight-1' })]
    const selected = measurementForTypes(source, ['weight'])

    expect(Object.isFrozen(selected)).toBe(true)
    expect(() => (selected as TestMeasurement[]).push(measurement({ id: 'weight-2' }))).toThrow(TypeError)
    expect(measurementForTypes(source, ['weight'])).toBe(selected)
    expect(measurementForTypes(source, ['weight'])).toEqual([source[0]])
  })

  it('uses a canonical type key and does not let unrelated types change the signature', () => {
    const weight = measurement({ id: 'weight-1' })
    const heartRate = measurement({ id: 'heart-1', type: 'heart_rate', value: 60, unit: 'bpm' })
    const source = [weight]
    const reorderedTypes = ['weight', 'weight']

    expect(measurementSubsetSignature(source, ['weight'])).toBe(measurementSubsetSignature(source, reorderedTypes))
    expect(measurementSubsetSignature(source, ['weight'])).toBe(measurementSubsetSignature([...source, heartRate], ['weight']))
  })

  it('covers id, type, measuredAt, updatedAt, value and unit', () => {
    const source = [measurement()]
    const fields: Array<Partial<TestMeasurement>> = [
      { id: 'measurement-2' },
      { type: 'heart_rate', unit: 'bpm' },
      { measuredAt: '2026-09-20T09:00:00.000Z' },
      { updatedAt: '2026-09-20T09:05:00.000Z' },
      { value: 71 },
      { unit: 'lb' },
      { note: 'sleep_stage=deep' },
    ]

    for (const change of fields) {
      expect(measurementSubsetSignature(source, ['weight'])).not.toBe(
        measurementSubsetSignature([measurement(change)], ['weight']),
      )
    }
  })

  it('invalidates the selective signature when updatedAt changes', () => {
    const source = [measurement({ id: 'weight-1', updatedAt: '2026-09-20T08:00:00.000Z' })]
    const original = measurementSubsetSignature(source, ['weight'])

    expect(measurementSubsetSignature(
      [measurement({ id: 'weight-1', updatedAt: '2026-09-20T08:01:00.000Z' })],
      ['weight'],
    )).not.toBe(original)
    expect(measurementSubsetSignature(
      [measurement({ id: 'weight-1', updatedAt: '2026-09-20T08:00:00.000Z' })],
      ['weight'],
    )).toBe(original)
  })

  it('is independent of source order and caches signatures by source reference', () => {
    const first = measurement({ id: 'a', measuredAt: '2026-09-20T09:00:00.000Z' })
    const second = measurement({ id: 'b', measuredAt: '2026-09-20T08:00:00.000Z' })
    const source = [first, second]
    const signature = measurementSubsetSignature(source, ['weight'])

    expect(measurementSubsetSignature([second, first], ['weight'])).toBe(signature)
    expect(measurementSubsetSignature(source, ['weight'])).toBe(signature)
    expect(source).toEqual([first, second])
  })
})
