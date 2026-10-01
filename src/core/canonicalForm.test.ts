import { describe, expect, it } from 'vitest'
import { CANONICAL_DOMAIN_SPECS } from './canonicalDomains'
import { validateCanonicalFields } from './canonicalForm'

describe('canonical form validation', () => {
  it('rejects invalid optional numbers and dates', () => {
    const spec = CANONICAL_DOMAIN_SPECS.labResults!
    expect(validateCanonicalFields(spec, { analyte: 'Ferritina', value: 'NaN', collectedAt: '2026-09-20T10:00' })).toBe('value')
    expect(validateCanonicalFields(spec, { analyte: 'Ferritina', value: '20', collectedAt: 'not-a-date' })).toBe('collectedAt')
  })

  it('returns the missing required field key', () => {
    expect(validateCanonicalFields(CANONICAL_DOMAIN_SPECS.appointments!, { scheduledAt: '2026-09-20T10:00' })).toBe('title')
  })
})
