import { describe, expect, it } from 'vitest'
import { DENTAL_ARCHES, dentalActionIdFromTags, dentalRestorationTags, dentalToneByTooth, dentalToothKind, dentalToneFromTags, FDI_TEETH, resolveDentalEvents } from './dental'
import type { HealthEvent } from './types'

function dentalEvent({
  id,
  action,
  occurredAt,
  tags = [],
  updatedAt = occurredAt,
}: {
  id: string
  action: string
  occurredAt: string
  tags?: string[]
  updatedAt?: string
}): HealthEvent {
  return {
    id,
    type: 'dental_care',
    occurredAt,
    description: action,
    tags: [`tooth=16`, `action=${action}`, ...tags],
    attachments: [],
    createdAt: occurredAt,
    updatedAt,
  }
}

describe('dental catalog', () => {
  it('contains the complete permanent FDI dentition exactly once', () => {
    expect(FDI_TEETH).toHaveLength(32)
    expect(new Set(FDI_TEETH).size).toBe(32)
    expect(DENTAL_ARCHES.flatMap((arch) => arch.teeth)).toEqual(FDI_TEETH)
  })

  it('classifies each tooth by anatomical family', () => {
    expect(dentalToothKind('11')).toBe('incisor')
    expect(dentalToothKind('23')).toBe('canine')
    expect(dentalToothKind('15')).toBe('premolar')
    expect(dentalToothKind('48')).toBe('molar')
  })

  it('normalizes Web and iOS clinical tags to the same visual tone', () => {
    expect(dentalToneFromTags(['action=caries'])).toBe('caries')
    expect(dentalToneFromTags(['state=removed', 'intervention=check'])).toBe('extraction')
    expect(dentalToneFromTags(['state=treated', 'intervention=rootCanal'])).toBe('treated')
    expect(dentalToneFromTags(['action=implant'])).toBe('treated')
    expect(dentalToneFromTags(['action=checkup'])).toBeUndefined()
  })

  it('normalizes legacy and localized action labels for the shared history', () => {
    expect(dentalActionIdFromTags(['intervention=Devitalizzazione'])).toBe('rootCanal')
    expect(dentalActionIdFromTags(['action=Estrazione'])).toBe('extraction')
    expect(dentalActionIdFromTags(['action=flossing'])).toBe('flossing')
    expect(dentalActionIdFromTags(['action=Ripristino dente'])).toBe('restoration')
    expect(dentalActionIdFromTags(['action=ROOT-CANAL'])).toBe('rootCanal')
  })

  it('replays events chronologically even when input is out of order', () => {
    const projection = resolveDentalEvents([
      dentalEvent({ id: 'filling', action: 'filling', occurredAt: '2026-03-01T10:00:00.000Z' }),
      dentalEvent({ id: 'caries', action: 'carie', occurredAt: '2026-01-01T10:00:00.000Z' }),
    ])
    expect(projection.events.map((entry) => entry.event.id)).toEqual(['caries', 'filling'])
    expect(dentalToneByTooth(projection).get('16')).toBe('treated')
  })

  it('collapses duplicate IDs to the newest record revision', () => {
    const first = dentalEvent({ id: 'same-event', action: 'caries', occurredAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:01:00.000Z' })
    const duplicate = dentalEvent({ id: 'same-event', action: 'filling', occurredAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-01-01T10:02:00.000Z' })
    const projection = resolveDentalEvents([duplicate, first])
    expect(projection.events).toHaveLength(1)
    expect(dentalToneByTooth(projection).get('16')).toBe('treated')
  })

  it('keeps extraction monotonic until restored=true appears', () => {
    const projection = resolveDentalEvents([
      dentalEvent({ id: 'later-treatment', action: 'filling', occurredAt: '2026-03-01T10:00:00.000Z' }),
      dentalEvent({ id: 'restore', action: 'checkup', occurredAt: '2026-02-01T10:00:00.000Z', tags: ['state=healthy', 'restored=true'] }),
      dentalEvent({ id: 'ordinary-after-extraction', action: 'crown', occurredAt: '2026-04-01T10:00:00.000Z' }),
      dentalEvent({ id: 'extraction', action: 'Estrazione', occurredAt: '2026-01-01T10:00:00.000Z', tags: ['state=removed'] }),
    ])
    const tooth = projection.byTooth.get('16')
    expect(tooth?.removed).toBe(false)
    expect(tooth?.state).toBe('crown')
    expect(dentalToneByTooth(projection).get('16')).toBe('treated')
  })

  it('does not let a normal event resurrect a removed tooth without restoration', () => {
    const projection = resolveDentalEvents([
      dentalEvent({ id: 'normal-after-extraction', action: 'filling', occurredAt: '2026-02-01T10:00:00.000Z' }),
      dentalEvent({ id: 'extraction', action: 'extraction', occurredAt: '2026-01-01T10:00:00.000Z' }),
    ])
    expect(projection.byTooth.get('16')?.state).toBe('removed')
    expect(dentalToneByTooth(projection).get('16')).toBe('extraction')
  })

  it('round-trips an explicit restoration using the shared iOS tags', () => {
    const removed = dentalEvent({ id: 'removed', action: 'extraction', occurredAt: '2026-01-01T10:00:00.000Z' })
    const restored: HealthEvent = {
      ...dentalEvent({ id: 'restored', action: 'Ripristino dente', occurredAt: '2026-02-01T10:00:00.000Z', tags: dentalRestorationTags('16') }),
      description: 'Ripristino dente',
    }
    const projection = resolveDentalEvents([restored, removed])
    expect(projection.byTooth.get('16')).toMatchObject({ removed: false, state: 'healthy' })
    expect(projection.byTooth.get('16')?.history.at(-1)?.isRestoration).toBe(true)
    expect(dentalActionIdFromTags(dentalRestorationTags('16'))).toBe('restoration')
  })

  it('ignores invalid FDI identifiers in the tooth projection but preserves their history event', () => {
    const invalid = dentalEvent({ id: 'invalid', action: 'caries', occurredAt: '2026-01-01T10:00:00.000Z', tags: ['tooth=19'] })
    const projection = resolveDentalEvents([invalid])
    expect(projection.events).toHaveLength(1)
    expect(projection.byTooth.size).toBe(0)
  })
})
