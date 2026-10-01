import { describe, expect, it } from 'vitest'
import { eyeSummary, isVisionIssue, parsePrescriptionDescription, prescriptionParts } from './visionModel'

describe('visionModel', () => {
  it('parses legacy prescription descriptions and preserves tag precedence', () => {
    expect(parsePrescriptionDescription('OD +1.25 OS -2,00')).toEqual({ rs: '+1.25', ls: '-2,00' })
    expect(prescriptionParts({
      description: 'OD +1.25 OS -2,00',
      tags: ['kind=Lenti a contatto', 'rs=+2.00'],
    })).toMatchObject({ kind: 'Lenti a contatto', rs: '+2.00', ls: '-2,00' })
  })

  it('summarizes refractive findings in the selected language', () => {
    expect(eyeSummary('it', 'r', '-1.25', '-0.50')).toBe('Occhio destro: miopia -1.25 + astigmatismo -0.50')
    expect(eyeSummary('en', 'l')).toBe('Eye left: no correction')
  })

  it('recognizes issue records without requiring a full event object', () => {
    expect(isVisionIssue({ tags: ['record=issue'] })).toBe(true)
    expect(isVisionIssue({ tags: ['record=note'] })).toBe(false)
  })
})
