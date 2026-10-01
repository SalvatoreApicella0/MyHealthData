import { describe, expect, it } from 'vitest'
import { DENTAL_QUADRANTS, dentalToneByTooth, resolveDentalEvents } from '../../core/dental'
import type { HealthEvent } from '../../core/types'

const dental = (action: string, occurredAt: string): HealthEvent => ({
  id: `${action}-${occurredAt}`,
  type: 'dental_care',
  occurredAt,
  description: action,
  tags: [`tooth=16`, `action=${action}`],
  attachments: [],
  createdAt: occurredAt,
  updatedAt: occurredAt,
})

describe('Web dental projection', () => {
  it('keeps front-view FDI quadrant order stable', () => {
    expect(DENTAL_QUADRANTS.upper.flatMap((quadrant) => quadrant.teeth)).toEqual([
      '18', '17', '16', '15', '14', '13', '12', '11',
      '21', '22', '23', '24', '25', '26', '27', '28',
    ])
    expect(DENTAL_QUADRANTS.lower.flatMap((quadrant) => quadrant.teeth)).toEqual([
      '48', '47', '46', '45', '44', '43', '42', '41',
      '31', '32', '33', '34', '35', '36', '37', '38',
    ])
  })

  it('uses the newest status while preserving history elsewhere', () => {
    const projection = resolveDentalEvents([
      dental('caries', '2026-01-01T10:00:00.000Z'),
      dental('filling', '2026-02-01T10:00:00.000Z'),
    ])
    expect(dentalToneByTooth(projection).get('16')).toBe('treated')
    expect(projection.byTooth.get('16')?.history).toHaveLength(2)
  })

  it('keeps an extracted tooth removed until an explicit restore exists', () => {
    expect(dentalToneByTooth(resolveDentalEvents([
      dental('extraction', '2026-01-01T10:00:00.000Z'),
      dental('orthodontics', '2026-02-01T10:00:00.000Z'),
    ])).get('16')).toBe('extraction')
  })

  it('keeps brushing neutral instead of presenting it as treatment', () => {
    expect(dentalToneByTooth(resolveDentalEvents([dental('brushing', '2026-02-01T10:00:00.000Z')])).has('16')).toBe(false)
  })

  it('keeps the latest known state independent for each tooth', () => {
    const other = { ...dental('caries', '2026-03-01T10:00:00.000Z'), id: 'caries-17', tags: ['tooth=17', 'action=caries'] }
    const states = dentalToneByTooth(resolveDentalEvents([dental('filling', '2026-02-01T10:00:00.000Z'), other]))
    expect(states.get('16')).toBe('treated')
    expect(states.get('17')).toBe('caries')
  })
})
