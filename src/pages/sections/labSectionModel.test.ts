import { describe, expect, it } from 'vitest'
import { glucoseMeasurements, levelFor, specRangeValue, toRecord } from './labModel'

describe('lab section measurement bridge', () => {
  it('presents synced blood glucose in Analisi without making it deletable data', () => {
    const rows = glucoseMeasurements({
      measurements: [
        {
          id: 'glucose-1',
          type: 'blood_glucose',
          value: 92,
          unit: 'mg/dL',
          measuredAt: '2026-09-20T08:00:00.000Z',
        },
        { id: 'weight-1', type: 'weight', value: 72, unit: 'kg', measuredAt: '2026-09-20T08:00:00.000Z' },
      ],
    }, 'it')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'measurement-glucose-glucose-1',
      analyte: 'Glicemia',
      value: 92,
      unit: 'mg/dL',
      readOnly: true,
      day: '2026-09-20',
    })
  })

  it('localizes imported glucose labels', () => {
    expect(glucoseMeasurements({ measurements: [{ id: 'g', type: 'blood_glucose', value: 100, measuredAt: '2026-09-20T08:00:00.000Z' }] }, 'en')[0]?.analyte).toBe('Glucose')
  })

  it('normalizes analytes and keeps reference levels deterministic', () => {
    expect(toRecord({ id: 'lab-1', analyte: 'Hemoglobina', value: '11,9', unit: 'g/dL', collectedAt: '2026-09-20T08:00:00.000Z' }, 0)).toMatchObject({
      id: 'lab-1',
      value: 11.9,
      day: '2026-09-20',
      spec: { id: 'hemoglobin' },
    })
    expect(levelFor(12, 12, 17)).toBe('ok')
    expect(levelFor(8, 12, 17)).toBe('bad')
    expect(levelFor(12, undefined, undefined)).toBe('none')
    expect(specRangeValue({ id: 'hdl', it: 'HDL', en: 'HDL', unit: 'mg/dL', low: 40 })).toBe('>=40')
  })
})
