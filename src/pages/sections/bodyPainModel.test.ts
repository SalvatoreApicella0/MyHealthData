import { describe, expect, it } from 'vitest'
import type { HealthEvent } from '../../core/types'
import {
  BODY_PAIN_EVENT_TYPES,
  COPY,
  emptyDraft,
  excerpt,
  intensityWord,
  isPainEvent,
  locale,
} from './bodyPainModel'

describe('body pain model', () => {
  it('keeps the event vocabulary and locale fallback stable', () => {
    expect(BODY_PAIN_EVENT_TYPES).toContain('pain')
    expect(BODY_PAIN_EVENT_TYPES).toContain('tingling')
    expect(locale('en')).toBe('en')
    expect(locale('fr')).toBe('it')
    expect(COPY.it.steps).toEqual(['Dettagli', 'Zona', 'Conferma'])
  })

  it('creates a local draft and classifies intensity consistently', () => {
    const draft = emptyDraft()
    expect(draft.type).toBe('pain')
    expect(draft.attachments).toEqual([])
    expect(intensityWord(2, 'it')).toBe('Lieve')
    expect(intensityWord(9, 'en')).toBe('Severe')
    expect(excerpt('x'.repeat(100))).toHaveLength(96)
  })

  it('recognizes only the configured pain event types', () => {
    expect(isPainEvent({ type: 'pain' } as HealthEvent)).toBe(true)
    expect(isPainEvent({ type: 'sleep' } as unknown as HealthEvent)).toBe(false)
  })
})
