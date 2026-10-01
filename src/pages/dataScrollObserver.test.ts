import { describe, expect, it } from 'vitest'
import { DEFAULT_SECTION_ORDER, firstIntersectingSection, scrollAnchorCompensation, shouldDisarmScrollAnchor } from './DataScrollPage'

describe('scroll measurement batching', () => {
  it('keeps the section height cache stable when no measured height changes', () => {
    const current = { sonno: 420, denti: 680 }
    const updates = { sonno: 420, denti: 680 }
    const next = { ...current }
    let changed = false
    for (const [id, height] of Object.entries(updates)) {
      if (next[id as keyof typeof next] !== height) {
        next[id as keyof typeof next] = height
        changed = true
      }
    }
    expect(changed).toBe(false)
    expect(next).toEqual(current)
  })
})

function entry(id: string): IntersectionObserverEntry {
  return { target: { id } } as IntersectionObserverEntry & { boundingClientRect: DOMRect }
}

describe('data scroll observer selection', () => {
  it('selects the highest visible section without sorting or mutating entries', () => {
    const entries = [
      { ...entry('second'), isIntersecting: true, boundingClientRect: { top: 120 } },
      { ...entry('hidden'), isIntersecting: false, boundingClientRect: { top: 20 } },
      { ...entry('first'), isIntersecting: true, boundingClientRect: { top: 40 } },
    ] as unknown as IntersectionObserverEntry[]
    expect(firstIntersectingSection(entries)).toBe('first')
    expect(entries.map((value) => value.target.id)).toEqual(['second', 'hidden', 'first'])
  })

  it('returns undefined when no section intersects', () => {
    expect(firstIntersectingSection([{ ...entry('hidden'), isIntersecting: false, boundingClientRect: { top: 0 } }] as unknown as IntersectionObserverEntry[])).toBeUndefined()
  })
})

describe('data scroll anchors', () => {
  it('compensates exactly for a measured shift above a deep-link target', () => {
    const beforeMountTop = 88
    const afterMountTop = 436
    const correction = scrollAnchorCompensation(beforeMountTop, afterMountTop)

    expect(correction).toBe(348)
    expect(afterMountTop - correction).toBe(beforeMountTop)
  })

  it('ignores sub-pixel layout noise', () => {
    expect(scrollAnchorCompensation(88, 88.4)).toBe(0)
  })

  it('disarms on the first manual interaction but preserves a programmatic scroll event', () => {
    let armed = true
    const apply = (event: Event, programmaticScroll = false) => {
      if (shouldDisarmScrollAnchor(event, programmaticScroll)) armed = false
    }

    apply(new Event('scroll'), true)
    expect(armed).toBe(true)

    apply(new Event('wheel'))
    expect(armed).toBe(false)

    armed = true
    for (const eventType of ['scroll', 'touchstart', 'wheel', 'keydown']) {
      expect(shouldDisarmScrollAnchor(new Event(eventType))).toBe(true)
    }
    apply(new Event('scroll'))
    expect(armed).toBe(false)
  })

  it('treats the compensation scroll as programmatic while it is being applied', () => {
    expect(shouldDisarmScrollAnchor(new Event('scroll'), true)).toBe(false)
    expect(shouldDisarmScrollAnchor(new Event('wheel'), true)).toBe(true)
  })
})

describe('default data section order', () => {
  it('matches the canonical unified-page order', () => {
    expect(DEFAULT_SECTION_ORDER).toEqual([
      'dolori',
      'misure',
      'cuore',
      'movimento',
      'sonno',
      'alimentazione',
      'farmaci',
      'ciclo',
      'palestra',
      'analisi',
      'allergie',
      'vista',
      'intestino',
      'denti',
      'sessuale',
    ])
  })
})
