import { describe, expect, it } from 'vitest'
import type { HealthEvent } from '../../core/types'
import { byDateDesc, hasTag, locale, partnerAlias, tagValue } from './specialtyModel'

function event(id: string, occurredAt: string, tags: string[] = []): HealthEvent {
  return {
    id,
    type: 'allergy',
    occurredAt,
    description: id,
    tags,
    attachments: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  }
}

describe('specialtyModel', () => {
  it('normalizes locale and reads tag values without empty payloads', () => {
    expect(locale('en-US')).toBe('it')
    expect(locale('en')).toBe('en')
    expect(tagValue(['severity=  Grave  '], 'severity')).toBe('Grave')
    expect(tagValue(['severity='], 'severity')).toBeUndefined()
    expect(hasTag(['confirmed'], 'confirmed')).toBe(true)
  })

  it('sorts events without mutating the source array', () => {
    const records = [event('old', '2026-09-20T10:00:00Z'), event('new', '2026-09-25T10:00:00Z')]
    expect(byDateDesc(records).map((record) => record.id)).toEqual(['new', 'old'])
    expect(records.map((record) => record.id)).toEqual(['old', 'new'])
  })

  it('supports both partner tag separators', () => {
    expect(partnerAlias(event('one', '2026-09-25T10:00:00Z', ['partner: Luca']))).toBe('Luca')
    expect(partnerAlias(event('two', '2026-09-25T10:00:00Z', ['partner=Sara']))).toBe('Sara')
    expect(partnerAlias(event('three', '2026-09-25T10:00:00Z', ['partner=']))).toBeUndefined()
  })
})
