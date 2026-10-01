import { describe, expect, it } from 'vitest'
import { parseLabReportText } from './labReportParser'

describe('lab report parser', () => {
  it('extracts conservative values and ranges for review', () => {
    const parsed = parseLabReportText('Emoglobina: 13,4 g/dL (12-17)\nGlicemia 104 mg/dL')
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ analyte: 'Emoglobina', value: 13.4, referenceLow: 12, referenceHigh: 17, selected: true })
    expect(parsed[1]).toMatchObject({ analyte: 'Glicemia', value: 104, selected: true })
  })

  it('does not invent a value when a line has no numeric result', () => {
    expect(parseLabReportText('Emoglobina: non disponibile\nNota: campione emolizzato')).toEqual([])
  })
})
